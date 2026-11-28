// Phase 2 Worker tests: agent submission API, verifier, judge, agent chat.
// Runs locally with no network and no secrets: Supabase Auth/PostgREST are
// stubbed at globalThis.fetch with an in-memory table store, Workers AI is
// a fake binding, and R2 is unused by these routes. The suite runs against
// BOTH Worker copies, which the repo requires to stay byte-identical.
import test from "node:test";
import assert from "node:assert/strict";
import canonicalWorker from "../cloudflare/executive-agent-research.mjs";
import nestedWorker from "../executiveagent/src/research-worker.mjs";

const SUPABASE_URL = "https://bimmfmydbmooarobilsq.supabase.co";
const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const USERS = {
  "owner-token":      { id: "user-owner",      email: "owner@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" },
  "researcher-token": { id: "user-researcher", email: "owner@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" },
};
const MEMBERSHIPS = {
  "owner-token":      [{ role: "owner", active: true }],
  "researcher-token": [{ role: "researcher", active: true }],
};

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const AGENT_KEY = "scout-secret-key";
const PAUSED_KEY = "paused-secret-key";
const REVOKED_KEY = "revoked-secret-key";
const AGENT_HASH = await sha256Hex(AGENT_KEY);
const PAUSED_HASH = await sha256Hex(PAUSED_KEY);
const REVOKED_HASH = await sha256Hex(REVOKED_KEY);

const recentDate = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

function seedDb() {
  return {
    agents: [
      { id: "agent-scout", name: "Scout", status: "active", submission_count: 2, api_key_hash: AGENT_HASH,
        system_prompt: "You are Scout, a research agent.", model: "@cf/meta/llama-3.1-8b-instruct",
        temperature: 0.7, max_tokens: 512, max_messages: 4, is_active: true },
      { id: "agent-gemini", name: "Gemini-named", status: "active", submission_count: 0, api_key_hash: null,
        system_prompt: "You are a helper.", model: "google/gemini-3-pro-preview",
        temperature: 0.2, max_tokens: 128, max_messages: 20, is_active: true },
      { id: "agent-paused", name: "Paused", status: "paused", submission_count: 0, api_key_hash: PAUSED_HASH },
      { id: "agent-revoked", name: "Revoked", status: "revoked", submission_count: 0, api_key_hash: REVOKED_HASH },
      { id: "agent-nochat", name: "Registry Only", status: "active", submission_count: 0, api_key_hash: null, system_prompt: null, is_active: true },
      { id: "agent-off", name: "Switched Off", status: "active", submission_count: 0, api_key_hash: null, system_prompt: "You exist.", is_active: false },
    ],
    research_entries: [
      { id: "entry-1", title: "A claim", topic: "testing", domain: "technology", summary: "The claim under test",
        body: "Body text", owner_id: "user-owner", agent_id: "agent-scout", agent_name: "Scout", status: "pending", trust_score: null },
    ],
    research_sources: [
      { id: "src-1", entry_id: "entry-1", owner_id: "user-owner", title: "Source A", url: "https://a.example/report",
        publisher: "Publisher A", published_date: recentDate(10), source_type: "other", excerpt: "Supports the claim.", check_status: "unchecked" },
      { id: "src-2", entry_id: "entry-1", owner_id: "user-owner", title: "Source B", url: "https://b.example/report",
        publisher: "Publisher B", published_date: recentDate(10), source_type: "other", excerpt: "Also relevant.", check_status: "unchecked" },
    ],
    verifications: [],
    award_categories: [
      { id: "cat-1", name: "Innovation", private_brief: "Board-only brief", public_summary: "Public summary" },
    ],
    judging_criteria: [
      { id: "crit-1", category_id: "cat-1", name: "Impact", max_points: 25, definition: "Real-world impact", anchors: [], sort_order: 1 },
      { id: "crit-2", category_id: "cat-1", name: "Craft", max_points: 25, definition: "Quality of execution", anchors: [], sort_order: 2 },
    ],
    submissions: [
      { id: "sub-1", category_id: "cat-1", category_name: "Innovation", nominee_name: "Widget", nominee_type: "platform",
        nominator_name: "Mikki", summary: "s".repeat(150), evidence: [{ label: "site", url: "https://x.example" }, { label: "repo", url: "https://y.example" }], status: "submitted" },
      { id: "sub-orphan", category_id: "cat-empty", category_name: "Empty", nominee_name: "Nobody", nominee_type: "individual",
        nominator_name: null, summary: "Nothing here", evidence: [], status: "submitted" },
    ],
    judgments: [],
    criteria_change_requests: [],
  };
}

// In-memory PostgREST stand-in covering exactly the query shapes the Worker
// issues (eq. filters, POST insert with representation, PATCH update).
function fakeFetch(db) {
  let seq = 0;
  const jsonRes = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  return async (url, init = {}) => {
    const u = new URL(url);
    const token = String(init.headers?.authorization || "").replace(/^Bearer\s+/i, "");
    if (u.origin === SUPABASE_URL && u.pathname === "/auth/v1/user") {
      const user = USERS[token];
      if (!user) return jsonRes({ error: "invalid" }, 401);
      return jsonRes(user);
    }
    if (u.origin === SUPABASE_URL && u.pathname === "/rest/v1/executive_memberships") {
      return jsonRes(MEMBERSHIPS[token] ?? []);
    }
    if (u.origin === SUPABASE_URL && u.pathname.startsWith("/rest/v1/")) {
      const table = u.pathname.slice("/rest/v1/".length);
      const rows = db[table];
      if (!rows) return jsonRes({ message: "unknown table" }, 404);
      const filters = [...u.searchParams.entries()]
        .filter(([k]) => !["select", "order", "limit", "offset"].includes(k))
        .map(([k, v]) => [k, v.replace(/^eq\./, "")]);
      const match = (row) => filters.every(([k, v]) => String(row[k]) === v);
      const method = init.method || "GET";
      if (method === "GET") return jsonRes(rows.filter(match).map(r => ({ ...r })));
      if (method === "POST") {
        const payload = JSON.parse(init.body);
        const inserted = (Array.isArray(payload) ? payload : [payload]).map(p => {
          const row = { id: "row-" + (++seq), created_at: new Date().toISOString(), ...p };
          rows.push(row);
          return { ...row };
        });
        return jsonRes(inserted, 201);
      }
      if (method === "PATCH") {
        const patch = JSON.parse(init.body);
        for (const row of rows) if (match(row)) Object.assign(row, patch);
        return new Response(null, { status: 204 });
      }
      return jsonRes({ message: "method not supported by fake" }, 405);
    }
    throw new Error("Unexpected fetch in tests: " + u.href);
  };
}

function fakeAI(handler) {
  const calls = [];
  return { calls, async run(model, inputs) { calls.push({ model, inputs }); return handler(model, inputs); } };
}

function makeEnv(db, extra = {}) {
  return {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    EXECUTIVE_OWNER_EMAILS: "owner@example.com",
    ...extra,
  };
}

function req(path, { method = "POST", token, key, body, rawBody } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  if (key) headers.authorization = "Bearer " + key;
  return new Request("https://worker.test" + path, { method, headers, body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)) });
}

function suite(name, worker) {
  const call = async (request, env, db) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch(db);
    try { return await worker.fetch(request, env); }
    finally { globalThis.fetch = realFetch; }
  };

  // --- Agent submission API -------------------------------------------------
  test(name + ": agent submission files an entry, its sources, and bumps counters", async () => {
    const db = seedDb();
    const res = await call(req("/v1/agent/research", { key: AGENT_KEY, body: {
      title: "New finding", topic: "markets", domain: "industry", summary: "A claim", body: "Details",
      sources: [
        { title: "Report", url: "https://example.com/r", publisher: "Pub", published_date: "2026-11-01", excerpt: "text" },
        { title: "Second" },
      ],
    } }), makeEnv(db), db);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, "pending");
    assert.equal(body.agent, "Scout");
    assert.equal(body.submission_count, 3);
    assert.equal(db.research_entries.length, 2);
    const filed = db.research_entries.find(e => e.id === body.id);
    assert.equal(filed.agent_id, "agent-scout");
    assert.equal(filed.agent_name, "Scout");
    assert.equal(filed.status, "pending");
    const filedSources = db.research_sources.filter(s => s.entry_id === body.id);
    assert.equal(filedSources.length, 2);
    assert.equal(filedSources[0].source_type, "other");
    const agent = db.agents.find(a => a.id === "agent-scout");
    assert.equal(agent.submission_count, 3);
    assert.ok(agent.last_submission_at);
  });

  test(name + ": agent submission without a bearer key is 401, unknown key is 401", async () => {
    const db = seedDb();
    const noKey = await call(req("/v1/agent/research", { body: { title: "x" } }), makeEnv(db), db);
    assert.equal(noKey.status, 401);
    const badKey = await call(req("/v1/agent/research", { key: "not-a-real-key", body: { title: "x" } }), makeEnv(db), db);
    assert.equal(badKey.status, 401);
    assert.equal(db.research_entries.length, 1);
  });

  test(name + ": paused and revoked agents are refused with 403", async () => {
    const db = seedDb();
    const paused = await call(req("/v1/agent/research", { key: PAUSED_KEY, body: { title: "x" } }), makeEnv(db), db);
    assert.equal(paused.status, 403);
    const revoked = await call(req("/v1/agent/research", { key: REVOKED_KEY, body: { title: "x" } }), makeEnv(db), db);
    assert.equal(revoked.status, 403);
    assert.equal(db.research_entries.length, 1);
  });

  test(name + ": agent submission without the service credential configured is 503", async () => {
    const db = seedDb();
    const env = makeEnv(db);
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await call(req("/v1/agent/research", { key: AGENT_KEY, body: { title: "x" } }), env, db);
    assert.equal(res.status, 503);
  });

  test(name + ": agent submission validates required fields and payload shape", async () => {
    const db = seedDb();
    const env = makeEnv(db);
    const noTitle = await call(req("/v1/agent/research", { key: AGENT_KEY, body: { topic: "x" } }), env, db);
    assert.equal(noTitle.status, 400);
    const badDomain = await call(req("/v1/agent/research", { key: AGENT_KEY, body: { title: "x", domain: "space" } }), env, db);
    assert.equal(badDomain.status, 400);
    const badUrl = await call(req("/v1/agent/research", { key: AGENT_KEY, body: { title: "x", sources: [{ title: "s", url: "ftp://nope" }] } }), env, db);
    assert.equal(badUrl.status, 400);
    const tooMany = await call(req("/v1/agent/research", { key: AGENT_KEY, body: { title: "x", sources: Array.from({ length: 26 }, () => ({ title: "s" })) } }), env, db);
    assert.equal(tooMany.status, 400);
    assert.equal(db.research_entries.length, 1);
  });

  test(name + ": agent submission over the payload limit is 413", async () => {
    const db = seedDb();
    const res = await call(req("/v1/agent/research", { key: AGENT_KEY, rawBody: JSON.stringify({ title: "x".repeat(70000) }) }), makeEnv(db), db);
    assert.equal(res.status, 413);
    assert.equal(db.research_entries.length, 1);
  });

  test(name + ": agent submission route rejects non-POST with 405", async () => {
    const db = seedDb();
    const res = await call(req("/v1/agent/research", { method: "GET", key: AGENT_KEY }), makeEnv(db), db);
    assert.equal(res.status, 405);
  });

  // --- Verifier -------------------------------------------------------------
  test(name + ": verifier requires an owner/admin member (401 anonymous, 403 researcher)", async () => {
    const db = seedDb();
    const anon = await call(req("/v1/verify", { body: { entry_id: "entry-1" } }), makeEnv(db), db);
    assert.equal(anon.status, 401);
    const researcher = await call(req("/v1/verify", { token: "researcher-token", body: { entry_id: "entry-1" } }), makeEnv(db), db);
    assert.equal(researcher.status, 403);
    assert.equal(db.verifications.length, 0);
  });

  test(name + ": verifier fallback scores deterministically and updates the entry", async () => {
    const db = seedDb();
    const res = await call(req("/v1/verify", { token: "owner-token", body: { entry_id: "entry-1" } }), makeEnv(db), db);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.model, "heuristic-fallback");
    assert.deepEqual(body.dimensions, { source_quality: 100, corroboration: 90, recency: 100, claim_support: 50 });
    assert.equal(body.trust_score, 85);
    assert.equal(body.verdict, "certified");
    assert.equal(db.verifications.length, 1);
    assert.equal(db.verifications[0].verifier, "SIGIL Validity Verifier");
    const entry = db.research_entries.find(e => e.id === "entry-1");
    assert.equal(entry.status, "certified");
    assert.equal(entry.trust_score, 85);
  });

  test(name + ": verifier uses Workers AI output when the binding answers with JSON", async () => {
    const db = seedDb();
    const ai = fakeAI(async () => ({ response: JSON.stringify({
      dimensions: { source_quality: 90, corroboration: 80, recency: 70, claim_support: 60 },
      source_findings: [{ source_id: "src-1", check_status: "supports", note: "Directly supports the claim." }],
    }) }));
    const res = await call(req("/v1/verify", { token: "owner-token", body: { entry_id: "entry-1" } }), makeEnv(db, { AI: ai }), db);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.model, DEFAULT_MODEL);
    assert.equal(body.trust_score, 76);
    assert.equal(body.verdict, "certified");
    assert.equal(ai.calls.length, 1);
    assert.equal(db.research_sources.find(s => s.id === "src-1").check_status, "supports");
    assert.equal(db.research_sources.find(s => s.id === "src-2").check_status, "unclear");
    const entry = db.research_entries.find(e => e.id === "entry-1");
    assert.equal(entry.trust_score, 76);
  });

  test(name + ": verifier falls back when the AI binding returns unusable output", async () => {
    const db = seedDb();
    const ai = fakeAI(async () => ({ response: "I could not verify this." }));
    const res = await call(req("/v1/verify", { token: "owner-token", body: { entry_id: "entry-1" } }), makeEnv(db, { AI: ai }), db);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.model, "heuristic-fallback");
    assert.equal(body.trust_score, 85);
  });

  test(name + ": verifier on a missing entry is 404", async () => {
    const db = seedDb();
    const res = await call(req("/v1/verify", { token: "owner-token", body: { entry_id: "nope" } }), makeEnv(db), db);
    assert.equal(res.status, 404);
  });

  // --- Judge ----------------------------------------------------------------
  test(name + ": judge fallback writes a draft judgment with correct totals", async () => {
    const db = seedDb();
    const res = await call(req("/v1/judge", { token: "owner-token", body: { submission_id: "sub-1" } }), makeEnv(db), db);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.judgment.status, "draft");
    assert.equal(body.judgment.model, "heuristic-fallback");
    assert.equal(body.judgment.total_points, 31.5);
    assert.equal(body.judgment.max_points, 50);
    assert.equal(body.judgment.percentage, 63);
    assert.equal(body.judgment.recommendation, "shortlist");
    assert.equal(body.criteria_change_requests, 0);
    assert.equal(db.judgments.length, 1);
    assert.equal(db.criteria_change_requests.length, 0);
  });

  test(name + ": judge files a criteria change request instead of changing the criterion", async () => {
    const db = seedDb();
    const ai = fakeAI(async () => ({ response: JSON.stringify({
      understanding: "A strong platform nomination.",
      assessment: "Scores well on both criteria.",
      criteria_scores: [
        { criterion_id: "crit-1", score: 20, rationale: "Clear impact." },
        { criterion_id: "crit-2", score: 22, rationale: "Polished execution." },
      ],
      criteria_change_requests: [
        { criterion_name: "Craft", proposed_definition: "Quality and originality of execution", purpose: "Clarity", intent: "Fairer scoring" },
      ],
    }) }));
    const res = await call(req("/v1/judge", { token: "owner-token", body: { submission_id: "sub-1" } }), makeEnv(db, { AI: ai }), db);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.judgment.total_points, 42);
    assert.equal(body.judgment.percentage, 84);
    assert.equal(body.judgment.recommendation, "award");
    assert.equal(body.criteria_change_requests, 1);
    assert.equal(db.criteria_change_requests.length, 1);
    const change = db.criteria_change_requests[0];
    assert.equal(change.criterion_name, "Craft");
    assert.equal(change.current_definition, "Quality of execution");
    assert.equal(change.proposed_definition, "Quality and originality of execution");
    assert.equal(change.status, "pending_review");
    assert.equal(change.judgment_id, body.judgment.id);
    // The criterion itself is untouched — the board decides.
    assert.equal(db.judging_criteria.find(c => c.id === "crit-2").definition, "Quality of execution");
  });

  test(name + ": judge on a missing submission is 404; a category without criteria is 400", async () => {
    const db = seedDb();
    const missing = await call(req("/v1/judge", { token: "owner-token", body: { submission_id: "nope" } }), makeEnv(db), db);
    assert.equal(missing.status, 404);
    const noCriteria = await call(req("/v1/judge", { token: "owner-token", body: { submission_id: "sub-orphan" } }), makeEnv(db), db);
    assert.equal(noCriteria.status, 400);
    assert.equal(db.judgments.length, 0);
  });

  // --- Agent chat -------------------------------------------------------------
  test(name + ": chat proxies to Workers AI with the agent's configuration and capped history", async () => {
    const db = seedDb();
    const ai = fakeAI(async () => ({ response: "Hello from Scout." }));
    const messages = [
      { role: "user", content: "one" }, { role: "assistant", content: "two" },
      { role: "user", content: "three" }, { role: "assistant", content: "four" },
      { role: "user", content: "five" }, { role: "user", content: "six" },
    ];
    const res = await call(req("/v1/chat", { token: "owner-token", body: { agent_id: "agent-scout", messages } }), makeEnv(db, { AI: ai }), db);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.reply, "Hello from Scout.");
    assert.equal(body.model, "@cf/meta/llama-3.1-8b-instruct");
    assert.equal(ai.calls.length, 1);
    const sent = ai.calls[0].inputs;
    assert.equal(sent.temperature, 0.7);
    assert.equal(sent.max_tokens, 512);
    // max_messages is 4: system prompt + the last 3 history messages.
    assert.equal(sent.messages.length, 4);
    assert.equal(sent.messages[0].role, "system");
    assert.equal(sent.messages[0].content, "You are Scout, a research agent.");
    assert.deepEqual(sent.messages.slice(1).map(m => m.content), ["four", "five", "six"]);
  });

  test(name + ": chat maps a non-Workers-AI model name to the default model", async () => {
    const db = seedDb();
    const ai = fakeAI(async () => ({ response: "Hi." }));
    const res = await call(req("/v1/chat", { token: "owner-token", body: { agent_id: "agent-gemini", messages: [{ role: "user", content: "hello" }] } }), makeEnv(db, { AI: ai }), db);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).model, DEFAULT_MODEL);
    assert.equal(ai.calls[0].model, DEFAULT_MODEL);
  });

  test(name + ": chat refuses agents without chat configuration or with chat disabled", async () => {
    const db = seedDb();
    const ai = fakeAI(async () => ({ response: "Hi." }));
    const env = makeEnv(db, { AI: ai });
    const noChat = await call(req("/v1/chat", { token: "owner-token", body: { agent_id: "agent-nochat", messages: [{ role: "user", content: "hi" }] } }), env, db);
    assert.equal(noChat.status, 400);
    const off = await call(req("/v1/chat", { token: "owner-token", body: { agent_id: "agent-off", messages: [{ role: "user", content: "hi" }] } }), env, db);
    assert.equal(off.status, 403);
    const missing = await call(req("/v1/chat", { token: "owner-token", body: { agent_id: "nope", messages: [{ role: "user", content: "hi" }] } }), env, db);
    assert.equal(missing.status, 404);
    assert.equal(ai.calls.length, 0);
  });

  test(name + ": chat without an AI binding is 503", async () => {
    const db = seedDb();
    const res = await call(req("/v1/chat", { token: "owner-token", body: { agent_id: "agent-scout", messages: [{ role: "user", content: "hi" }] } }), makeEnv(db), db);
    assert.equal(res.status, 503);
  });
}

suite("canonical worker phase2", canonicalWorker);
suite("nested worker phase2", nestedWorker);
