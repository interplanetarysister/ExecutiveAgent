// Agent knowledge-entry tests: POST /v1/agent/knowledge — the autonomous
// filing path by which a registered agent enters researched knowledge
// herself (executive.sources + executive.knowledge +
// public.executive_research + audit row), with the same bearer-key auth
// ladder as the submission API and the verification honesty rule.
//
// Runs locally with no network and no secrets: PostgREST is stubbed at
// globalThis.fetch with an in-memory table store. The suite runs against
// BOTH Worker copies, which the repo requires to stay byte-identical.
import test from "node:test";
import assert from "node:assert/strict";
import canonicalWorker from "../cloudflare/executive-agent-research.mjs";
import nestedWorker from "../executiveagent/src/research-worker.mjs";

const SUPABASE_URL = "https://bimmfmydbmooarobilsq.supabase.co";

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const AGENT_KEY = "michelle-secret-key";
const PAUSED_KEY = "paused-secret-key";
const REVOKED_KEY = "revoked-secret-key";
const AGENT_HASH = await sha256Hex(AGENT_KEY);
const PAUSED_HASH = await sha256Hex(PAUSED_KEY);
const REVOKED_HASH = await sha256Hex(REVOKED_KEY);

const SOURCE_URL = "https://ocw.mit.edu/courses/6-100l";

function seedDb() {
  return {
    agents: [
      { id: "agent-michelle", name: "Michelle Rogers — Executive Agent", status: "active", submission_count: 5, api_key_hash: AGENT_HASH },
      { id: "agent-paused", name: "Paused", status: "paused", submission_count: 0, api_key_hash: PAUSED_HASH },
      { id: "agent-revoked", name: "Revoked", status: "revoked", submission_count: 0, api_key_hash: REVOKED_HASH },
    ],
    sources: [],
    knowledge: [],
    executive_research: [],
    audit_log: [],
  };
}

// In-memory PostgREST stand-in covering exactly the query shapes the
// Worker issues (eq. filters, POST insert with representation, PATCH).
function fakeFetch(db) {
  let seq = 0;
  const jsonRes = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  return async (url, init = {}) => {
    const u = new URL(url);
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

function makeEnv(extra = {}) {
  return {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    EXECUTIVE_OWNER_EMAILS: "owner@example.com",
    ...extra,
  };
}

function req(path, { method = "POST", key, body, rawBody } = {}) {
  const headers = { "content-type": "application/json" };
  if (key) headers.authorization = "Bearer " + key;
  return new Request("https://worker.test" + path, { method, headers, body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)) });
}

const FINDING = {
  department: "technology",
  topic: "open-courseware",
  title: "MIT OCW 6.100L — Introduction to CS and Programming using Python",
  summary: "MIT OpenCourseWare publishes the full course free: lectures, problem sets, exams.",
  source_url: SOURCE_URL,
  source_name: "MIT OpenCourseWare",
};

function suite(name, worker) {
  const call = async (request, env, db) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = fakeFetch(db);
    try { return await worker.fetch(request, env); }
    finally { globalThis.fetch = realFetch; }
  };

  test(name + ": files knowledge, source, and research rows end-to-end (unverified by default)", async () => {
    const db = seedDb();
    const res = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: FINDING }), makeEnv(), db);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.agent, "Michelle Rogers — Executive Agent");
    assert.equal(body.deduped, false);
    assert.equal(body.verified, false);
    assert.equal(body.verification, "reported");
    assert.equal(body.submission_count, 6);

    assert.equal(db.knowledge.length, 1);
    const k = db.knowledge[0];
    assert.equal(k.id, body.knowledge_id);
    assert.equal(k.department, "technology");
    assert.equal(k.topic, "open-courseware");
    assert.equal(k.title, FINDING.title);
    assert.equal(k.summary, FINDING.summary);
    assert.equal(k.verification, "reported");

    assert.equal(db.sources.length, 1);
    assert.equal(db.sources[0].url, SOURCE_URL);
    assert.equal(db.sources[0].publisher, "MIT OpenCourseWare");
    assert.equal(k.source_id, db.sources[0].id);

    assert.equal(db.executive_research.length, 1);
    const r = db.executive_research[0];
    assert.equal(r.id, body.research_id);
    assert.equal(r.kind, "source");
    assert.equal(r.source_url, SOURCE_URL);
    assert.equal(r.verified, false);
    assert.equal(r.provenance.filed_by, "Michelle Rogers — Executive Agent");
    assert.equal(r.provenance.endpoint, "/v1/agent/knowledge");
    assert.equal(r.provenance.claimed_verification, "unverified");

    assert.equal(db.audit_log.length, 1);
    assert.equal(db.audit_log[0].actor, "Michelle Rogers — Executive Agent");
    assert.equal(db.audit_log[0].action, "record_finding");
    assert.equal(db.audit_log[0].target_id, body.knowledge_id);

    const agent = db.agents.find(a => a.id === "agent-michelle");
    assert.equal(agent.submission_count, 6);
    assert.ok(agent.last_submission_at);
  });

  test(name + ": source-checked with a source_url files as verified", async () => {
    const db = seedDb();
    const res = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: { ...FINDING, verification: "source-checked" } }), makeEnv(), db);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.verified, true);
    assert.equal(body.verification, "verified");
    assert.equal(db.knowledge[0].verification, "verified");
    assert.equal(db.executive_research[0].verified, true);
    assert.equal(db.executive_research[0].provenance.claimed_verification, "source-checked");
  });

  test(name + ": source-checked WITHOUT a source_url is downgraded to unverified (honesty rule)", async () => {
    const db = seedDb();
    const { source_url, source_name, ...noSource } = FINDING;
    const res = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: { ...noSource, verification: "source-checked" } }), makeEnv(), db);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.verified, false);
    assert.equal(body.verification, "reported");
    assert.equal(db.knowledge[0].verification, "reported");
    assert.equal(db.knowledge[0].source_id, null);
    assert.equal(db.sources.length, 0);
    const r = db.executive_research[0];
    assert.equal(r.verified, false);
    assert.equal(r.kind, "reference");
    assert.equal(r.source_url, null);
    // The claim is preserved in provenance even though it was not honoured.
    assert.equal(r.provenance.claimed_verification, "source-checked");
  });

  test(name + ": re-filing the same source_url dedupes the research row and the source", async () => {
    const db = seedDb();
    db.sources.push({ id: "src-existing", title: "MIT OpenCourseWare", url: SOURCE_URL, publisher: "MIT OpenCourseWare", source_type: "web" });
    db.executive_research.push({ id: "res-existing", title: "Old title", kind: "source", source_url: SOURCE_URL, summary: "Old summary", verified: false, provenance: {} });
    const res = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: { ...FINDING, verification: "source-checked" } }), makeEnv(), db);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.deduped, true);
    assert.equal(body.research_id, "res-existing");
    // No duplicates created; the existing rows are reused/refreshed.
    assert.equal(db.executive_research.length, 1);
    assert.equal(db.sources.length, 1);
    const r = db.executive_research[0];
    assert.equal(r.title, FINDING.title);
    assert.equal(r.summary, FINDING.summary);
    assert.equal(r.verified, true);
    assert.ok(r.retrieved_at);
    // The knowledge entry is still filed fresh, linked to the existing source.
    assert.equal(db.knowledge.length, 1);
    assert.equal(db.knowledge[0].source_id, "src-existing");
  });

  test(name + ": filings without a source_url are never deduped (no dedupe key)", async () => {
    const db = seedDb();
    const { source_url, source_name, ...noSource } = FINDING;
    const env = makeEnv();
    const first = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: noSource }), env, db);
    const second = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: noSource }), env, db);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal((await first.json()).deduped, false);
    assert.equal((await second.json()).deduped, false);
    assert.equal(db.executive_research.length, 2);
    assert.equal(db.knowledge.length, 2);
  });

  test(name + ": auth ladder — no key 401, unknown key 401, paused/revoked 403, no service credential 503", async () => {
    const db = seedDb();
    const env = makeEnv();
    const noKey = await call(req("/v1/agent/knowledge", { body: FINDING }), env, db);
    assert.equal(noKey.status, 401);
    const badKey = await call(req("/v1/agent/knowledge", { key: "not-a-real-key", body: FINDING }), env, db);
    assert.equal(badKey.status, 401);
    const paused = await call(req("/v1/agent/knowledge", { key: PAUSED_KEY, body: FINDING }), env, db);
    assert.equal(paused.status, 403);
    const revoked = await call(req("/v1/agent/knowledge", { key: REVOKED_KEY, body: FINDING }), env, db);
    assert.equal(revoked.status, 403);
    const bare = makeEnv();
    delete bare.SUPABASE_SERVICE_ROLE_KEY;
    const unconfigured = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: FINDING }), bare, db);
    assert.equal(unconfigured.status, 503);
    assert.equal(db.knowledge.length, 0);
    assert.equal(db.executive_research.length, 0);
  });

  test(name + ": validation — required fields, verification vocabulary, URL rules", async () => {
    const db = seedDb();
    const env = makeEnv();
    for (const field of ["department", "topic", "title", "summary"]) {
      const broken = { ...FINDING };
      delete broken[field];
      const res = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: broken }), env, db);
      assert.equal(res.status, 400, `missing ${field} is 400`);
    }
    const badClaim = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: { ...FINDING, verification: "verified" } }), env, db);
    assert.equal(badClaim.status, 400);
    const ftp = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: { ...FINDING, source_url: "ftp://example.com/x" } }), env, db);
    assert.equal(ftp.status, 400);
    const garbage = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: { ...FINDING, source_url: "not a url" } }), env, db);
    assert.equal(garbage.status, 400);
    const longName = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: { ...FINDING, source_name: "n".repeat(301) } }), env, db);
    assert.equal(longName.status, 400);
    const notObject = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, body: [1, 2] }), env, db);
    assert.equal(notObject.status, 400);
    assert.equal(db.knowledge.length, 0);
  });

  test(name + ": payload over the limit is 413; non-POST is 405", async () => {
    const db = seedDb();
    const big = await call(req("/v1/agent/knowledge", { key: AGENT_KEY, rawBody: JSON.stringify({ ...FINDING, summary: "x".repeat(70000) }) }), makeEnv(), db);
    assert.equal(big.status, 413);
    const get = await call(req("/v1/agent/knowledge", { method: "GET", key: AGENT_KEY }), makeEnv(), db);
    assert.equal(get.status, 405);
    assert.equal(db.knowledge.length, 0);
  });
}

suite("canonical worker knowledge", canonicalWorker);
suite("nested worker knowledge", nestedWorker);
