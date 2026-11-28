/**
 * Michelle Rogers Executive - private R2 document API plus the Phase 2
 * Veritas Nexus feature routes (agent submissions, verifier, judge, chat).
 * Supabase Auth validates confirmed owner email addresses for the document
 * API and the console-triggered routes. The agent submission route instead
 * authenticates registered agents by bearer key and writes through the
 * Supabase service-role key held in the SUPABASE_SERVICE_ROLE_KEY Worker
 * secret (set at deploy time; never committed, never logged). AI features
 * use the Workers AI binding (env.AI) when bound and fall back to
 * deterministic heuristics when it is not. No R2 S3 key or Cloudflare
 * management token is needed.
 */
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const allowedTypes = new Set(["application/pdf","text/plain","text/markdown","application/json"]);
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: JSON_HEADERS});

function validKey(key) {
  if (!key || key.length > 180 || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(key)) return false;
  return !key.split("/").some(part => !part || part === "." || part === "..");
}

async function authenticate(request, env) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  if (!match) return { error: json({error: "Authentication required"}, 401) };
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.EXECUTIVE_OWNER_EMAILS) {
    return { error: json({error: "Executive owner authentication has not been configured"}, 503) };
  }
  let base;
  try { base = new URL(String(env.SUPABASE_URL).trim()); } catch { return { error: json({error: "Invalid authentication configuration"}, 503) }; }
  if (base.protocol !== "https:" || !base.hostname.endsWith(".supabase.co") || base.pathname !== "/") {
    return { error: json({error: "Invalid authentication configuration"}, 503) };
  }
  try {
    const response = await fetch(new URL("/auth/v1/user", base), {
      headers: { "apikey": String(env.SUPABASE_PUBLISHABLE_KEY).trim(), "authorization": "Bearer " + match[1] },
      redirect: "manual"
    });
    if (!response.ok) return { error: json({error: "Invalid session"}, 401) };
    const user = await response.json();
    const allowed = String(env.EXECUTIVE_OWNER_EMAILS).split(",").map(x => x.trim().toLowerCase());
    if (!user?.id || !user.email_confirmed_at || !allowed.includes(String(user.email || "").toLowerCase())) {
      return { error: json({error: "Not authorized for executive documents"}, 403) };
    }
    // Require an active membership in the canonical Supabase access-control table.
    const membershipUrl = new URL("/rest/v1/executive_memberships",base);
    membershipUrl.searchParams.set("user_id","eq."+user.id);
    membershipUrl.searchParams.set("select","role,active");
    const membershipResponse = await fetch(membershipUrl,{
      headers:{apikey:String(env.SUPABASE_PUBLISHABLE_KEY).trim(),authorization:"Bearer "+match[1]},redirect:"manual"
    });
    if (!membershipResponse.ok) return {error:json({error:"Membership verification unavailable"},503)};
    const memberships = await membershipResponse.json();
    if (!Array.isArray(memberships) || !memberships.some(m=>m.active && ["owner","admin"].includes(m.role))) {
      return {error:json({error:"Executive membership required"},403)};
    }
    return { id: user.id, token: match[1] };
  } catch (error) {
    console.error("Executive upstream auth error", error?.name || "unknown");
    return { error: json({error: "Authentication service unavailable"}, 503) };
  }
}

// ---------------------------------------------------------------------------
// Phase 2 — Veritas Nexus feature parity: agent submission API, verifier,
// judge, and agent chat. Database access goes through Supabase REST.
// Two credential modes are used, deliberately:
//   * Agent submissions use the service-role key from the Worker secret
//     named by SERVICE_KEY_ENV (set at deploy time; never committed) because
//     submitting agents hold no user JWT and the tables' RLS is member-only.
//   * Console-triggered verification, judging, and chat use the calling
//     member's own JWT, so RLS decides what they may read and write
//     (owner-or-admin per the Phase 1 policies).
// AI calls go through the Workers AI binding (env.AI) when bound. Each AI
// call is one replaceable function (aiText / aiJson below); when the binding
// is absent or its output is unusable, deterministic heuristic fallbacks
// keep the features working and label their output "heuristic-fallback".
// ---------------------------------------------------------------------------
const SERVICE_KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY";
const DEFAULT_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_AGENT_PAYLOAD_BYTES = 64 * 1024;
const MAX_AGENT_SOURCES = 25;
const ENTRY_DOMAINS = new Set(["technology", "industry", "policy", "other"]);
const CHECK_STATUSES = new Set(["unchecked", "supports", "contradicts", "unclear", "unreachable"]);

function supabaseBase(env) {
  if (!env.SUPABASE_URL) return null;
  let base;
  try { base = new URL(String(env.SUPABASE_URL).trim()); } catch { return null; }
  if (base.protocol !== "https:" || !base.hostname.endsWith(".supabase.co") || base.pathname !== "/") return null;
  return base;
}

// Minimal PostgREST client. Returns { ok, status, data }; never throws on
// an HTTP error status.
async function supabaseRest(env, { table, method = "GET", query = "", key, token, body, schema = "executive" }) {
  const base = supabaseBase(env);
  if (!base || !key) return { ok: false, status: 0, data: null };
  const cleanKey = String(key).trim();
  const headers = { apikey: cleanKey, authorization: "Bearer " + (token || cleanKey) };
  if (schema !== "public") headers[method === "GET" ? "accept-profile" : "content-profile"] = schema;
  // Workers supports only "follow" and "manual" redirect policies; "error"
  // throws before any request is sent (see WORKER_AUTH_REPAIR_20261126.md).
  const init = { method, headers, redirect: "manual" };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    headers.prefer = "return=representation";
    init.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(new URL("/rest/v1/" + table + (query ? "?" + query : ""), base), init);
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = null; } }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

const serviceRest = (env, opts) => supabaseRest(env, { ...opts, key: env[SERVICE_KEY_ENV] });
const memberRest = (env, token, opts) => supabaseRest(env, { ...opts, key: env.SUPABASE_PUBLISHABLE_KEY, token });

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function readJson(request, maxBytes) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return { error: json({ error: "Payload too large" }, 413) };
  try { return { value: JSON.parse(text) }; }
  catch { return { error: json({ error: "Request body must be JSON" }, 400) }; }
}

const isStr = (v, max) => typeof v === "string" && v.length <= max;
const round2 = (n) => Math.round(n * 100) / 100;
const clampScore = (n) => Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
const eq = (v) => "eq." + encodeURIComponent(v);

// Registry rows may carry a non-Workers-AI model name (the source default
// is a Gemini name); only @cf/ names are passed to the binding directly.
function workersAiModel(configured) {
  return typeof configured === "string" && configured.startsWith("@cf/") ? configured : DEFAULT_AI_MODEL;
}

// The one replaceable Workers AI call. Returns the model's text, or null
// when the binding is absent or the call fails — callers fall back.
async function aiText(env, { model, messages, temperature = 0.2, maxTokens = 1024 }) {
  if (!env.AI || typeof env.AI.run !== "function") return null;
  try {
    const result = await env.AI.run(model, { messages, temperature, max_tokens: maxTokens });
    const text = typeof result === "string" ? result : result?.response;
    return typeof text === "string" && text.trim() ? text : null;
  } catch { return null; }
}

async function aiJson(env, opts) {
  const text = await aiText(env, opts);
  if (!text) return null;
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

// --- Agent submission API (mirrors POST /api/agent/research) ---------------
// A registered agent authenticates with its bearer key: the SHA-256 hash is
// matched against executive.agents.api_key_hash. Only active agents may
// file; paused/revoked agents are refused with 403.
async function agentResearch(request, env) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  if (!match) return json({ error: "Authentication required" }, 401);
  if (!env[SERVICE_KEY_ENV]) return json({ error: "Agent submissions have not been configured" }, 503);
  const hash = await sha256Hex(match[1]);
  const found = await serviceRest(env, { table: "agents", query: "api_key_hash=" + eq(hash) + "&select=id,name,status,submission_count" });
  if (!found.ok) return json({ error: "Agent lookup unavailable" }, 503);
  const agent = Array.isArray(found.data) ? found.data[0] : null;
  if (!agent) return json({ error: "Invalid agent key" }, 401);
  if (agent.status !== "active") return json({ error: "Agent is not active" }, 403);

  const parsed = await readJson(request, MAX_AGENT_PAYLOAD_BYTES);
  if (parsed.error) return parsed.error;
  const p = parsed.value;
  const bad = (msg) => json({ error: msg }, 400);
  if (!p || typeof p !== "object" || Array.isArray(p)) return bad("Payload must be a JSON object");
  if (!isStr(p.title, 300) || !p.title.trim()) return bad("title is required");
  if (p.topic != null && !isStr(p.topic, 200)) return bad("topic is too long");
  if (p.summary != null && !isStr(p.summary, 5000)) return bad("summary is too long");
  if (p.body != null && !isStr(p.body, 20000)) return bad("body is too long");
  const domain = p.domain ?? "other";
  if (!ENTRY_DOMAINS.has(domain)) return bad("domain is not recognised");
  let ownerId = null;
  if (p.owner_id != null) {
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(p.owner_id)) return bad("owner_id must be a uuid");
    ownerId = p.owner_id;
  }
  const sources = p.sources ?? [];
  if (!Array.isArray(sources) || sources.length > MAX_AGENT_SOURCES) return bad("sources must be an array of at most " + MAX_AGENT_SOURCES);
  for (const s of sources) {
    if (!s || typeof s !== "object" || !isStr(s.title, 300) || !s.title.trim()) return bad("each source requires a title");
    if (s.url != null) {
      if (!isStr(s.url, 2000)) return bad("source url is too long");
      let u; try { u = new URL(s.url); } catch { return bad("source url is invalid"); }
      if (!["http:", "https:"].includes(u.protocol)) return bad("source url must be http(s)");
    }
    if (s.publisher != null && !isStr(s.publisher, 200)) return bad("source publisher is too long");
    if (s.published_date != null && !/^\d{4}-\d{2}-\d{2}$/.test(s.published_date)) return bad("source published_date must be YYYY-MM-DD");
    if (s.source_type != null && !isStr(s.source_type, 100)) return bad("source source_type is too long");
    if (s.excerpt != null && !isStr(s.excerpt, 5000)) return bad("source excerpt is too long");
    if (s.credibility_note != null && !isStr(s.credibility_note, 2000)) return bad("source credibility_note is too long");
  }

  const entryRes = await serviceRest(env, { table: "research_entries", method: "POST", body: {
    title: p.title.trim(), topic: p.topic?.trim() || null, domain,
    summary: p.summary ?? null, body: p.body ?? null,
    owner_id: ownerId, agent_id: agent.id, agent_name: agent.name, status: "pending",
  } });
  if (!entryRes.ok || !Array.isArray(entryRes.data) || !entryRes.data[0]) return json({ error: "Could not file the research entry" }, 502);
  const entry = entryRes.data[0];
  if (sources.length) {
    const rows = sources.map(s => ({
      entry_id: entry.id, owner_id: ownerId, title: s.title.trim(),
      url: s.url ?? null, publisher: s.publisher ?? null,
      published_date: s.published_date ?? null, source_type: s.source_type ?? "other",
      excerpt: s.excerpt ?? null, credibility_note: s.credibility_note ?? null,
    }));
    const srcRes = await serviceRest(env, { table: "research_sources", method: "POST", body: rows });
    if (!srcRes.ok) return json({ error: "Entry filed but its sources could not be stored" }, 502);
  }
  const count = (agent.submission_count ?? 0) + 1;
  await serviceRest(env, { table: "agents", method: "PATCH", query: "id=" + eq(agent.id), body: { submission_count: count, last_submission_at: new Date().toISOString() } });
  return json({ id: entry.id, status: "pending", agent: agent.name, submission_count: count }, 201);
}

// --- Verifier (mirrors verifier.server.js) --------------------------------
function verdictFor(trust) {
  return trust >= 75 ? "certified" : trust >= 50 ? "provisional" : trust >= 25 ? "stale" : "rejected";
}

function trustFromDimensions(d) {
  return round2(0.30 * d.source_quality + 0.25 * d.corroboration + 0.20 * d.recency + 0.25 * d.claim_support);
}

// Deterministic fallback: scores the filing from source metadata only.
// It never claims a source was fetched or read — findings say so, and the
// recorded model name is "heuristic-fallback".
function heuristicVerification(entry, sources) {
  const supportValue = { supports: 100, unclear: 50, unchecked: 40, contradicts: 0, unreachable: 10 };
  const avg = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  const findings = sources.map(s => {
    const kept = s.check_status && s.check_status !== "unchecked" ? s.check_status : null;
    return {
      source_id: s.id, title: s.title, url: s.url || null,
      check_status: kept || (s.url ? "unclear" : "unreachable"),
      note: "Heuristic fallback: the source was not independently fetched or read.",
    };
  });
  const dimensions = {
    source_quality: sources.length ? round2(avg(sources.map(s =>
      25 * (s.url ? 1 : 0) + 25 * (s.publisher ? 1 : 0) + 25 * (s.excerpt ? 1 : 0) + 25 * (s.published_date ? 1 : 0)))) : 0,
    corroboration: sources.length
      ? Math.min(100, new Set(sources.map(s => String(s.publisher || "").trim().toLowerCase()).filter(Boolean)).size * 40 + (sources.length > 1 ? 10 : 0))
      : 0,
    recency: sources.length ? round2(avg(sources.map(s => {
      if (!s.published_date) return 40;
      const ageDays = (Date.now() - Date.parse(s.published_date)) / 86400000;
      if (Number.isNaN(ageDays) || ageDays < 0) return 100;
      return ageDays <= 365 ? 100 : ageDays <= 730 ? 80 : ageDays <= 1825 ? 60 : ageDays <= 3650 ? 40 : 20;
    }))) : 30,
    claim_support: sources.length ? round2(avg(findings.map(f => supportValue[f.check_status] ?? 40))) : 0,
  };
  const trust_score = trustFromDimensions(dimensions);
  return { dimensions, source_findings: findings, trust_score, verdict: verdictFor(trust_score), model: "heuristic-fallback" };
}

async function aiVerification(env, entry, sources) {
  const out = await aiJson(env, {
    model: DEFAULT_AI_MODEL, temperature: 0.1, maxTokens: 1200,
    messages: [
      { role: "system", content: "You are the SIGIL Validity Verifier. Assess the research claim against its sources. Reply with JSON only: {\"dimensions\":{\"source_quality\":0-100,\"corroboration\":0-100,\"recency\":0-100,\"claim_support\":0-100},\"source_findings\":[{\"source_id\":\"<id>\",\"check_status\":\"supports|contradicts|unclear|unreachable\",\"note\":\"<short>\"}]}" },
      { role: "user", content: JSON.stringify({ title: entry.title, topic: entry.topic, claim: entry.summary, body: entry.body, sources: sources.map(s => ({ id: s.id, title: s.title, url: s.url, publisher: s.publisher, published_date: s.published_date, excerpt: s.excerpt })) }) },
    ],
  });
  if (!out || typeof out !== "object" || !out.dimensions) return null;
  const dimensions = {};
  for (const k of ["source_quality", "corroboration", "recency", "claim_support"]) {
    if (!Number.isFinite(Number(out.dimensions[k]))) return null;
    dimensions[k] = round2(clampScore(Number(out.dimensions[k])));
  }
  const byId = new Map(sources.map(s => [s.id, s]));
  const findings = [];
  for (const f of Array.isArray(out.source_findings) ? out.source_findings : []) {
    const s = byId.get(f?.source_id);
    if (!s) continue;
    findings.push({ source_id: s.id, title: s.title, url: s.url || null, check_status: CHECK_STATUSES.has(f.check_status) && f.check_status !== "unchecked" ? f.check_status : "unclear", note: isStr(f.note, 500) ? f.note : "" });
  }
  for (const s of sources) if (!findings.some(f => f.source_id === s.id)) {
    findings.push({ source_id: s.id, title: s.title, url: s.url || null, check_status: "unclear", note: "Not assessed by the model." });
  }
  const trust_score = trustFromDimensions(dimensions);
  return { dimensions, source_findings: findings, trust_score, verdict: verdictFor(trust_score), model: DEFAULT_AI_MODEL };
}

async function verifyEntry(request, env, token) {
  const parsed = await readJson(request, 4096);
  if (parsed.error) return parsed.error;
  const entryId = parsed.value?.entry_id;
  if (typeof entryId !== "string" || !entryId) return json({ error: "entry_id is required" }, 400);
  const entryRes = await memberRest(env, token, { table: "research_entries", query: "id=" + eq(entryId) + "&select=*" });
  if (!entryRes.ok) return json({ error: "Could not load the research entry" }, 502);
  const entry = Array.isArray(entryRes.data) ? entryRes.data[0] : null;
  if (!entry) return json({ error: "Research entry not found" }, 404);
  const srcRes = await memberRest(env, token, { table: "research_sources", query: "entry_id=" + eq(entryId) + "&select=*" });
  if (!srcRes.ok) return json({ error: "Could not load the entry sources" }, 502);
  const sources = Array.isArray(srcRes.data) ? srcRes.data : [];
  const result = (await aiVerification(env, entry, sources)) || heuristicVerification(entry, sources);
  const verRes = await memberRest(env, token, { table: "verifications", method: "POST", body: {
    entry_id: entry.id, owner_id: entry.owner_id, agent_name: entry.agent_name,
    verifier: "SIGIL Validity Verifier", model: result.model,
    trust_score: result.trust_score, verdict: result.verdict,
    dimensions: result.dimensions, source_findings: result.source_findings,
  } });
  if (!verRes.ok || !Array.isArray(verRes.data) || !verRes.data[0]) return json({ error: "Could not record the verification" }, 502);
  await memberRest(env, token, { table: "research_entries", method: "PATCH", query: "id=" + eq(entry.id), body: {
    trust_score: result.trust_score, dimensions: result.dimensions, status: result.verdict, updated_at: new Date().toISOString(),
  } });
  for (const f of result.source_findings) {
    const src = sources.find(s => s.id === f.source_id);
    if (src && src.check_status !== f.check_status) {
      await memberRest(env, token, { table: "research_sources", method: "PATCH", query: "id=" + eq(src.id), body: { check_status: f.check_status } });
    }
  }
  return json({ verification: verRes.data[0], trust_score: result.trust_score, verdict: result.verdict, dimensions: result.dimensions, model: result.model });
}

// --- Judge (mirrors judge.server.js) ---------------------------------------
// Governance rule carried from the source: the judge may never change a
// criterion definition. When its assessment says a definition should
// change, it files a criteria_change_requests row and a board member
// decides; the criterion itself is left untouched.
function heuristicJudgment(submission, category, criteria) {
  const evidenceCount = Array.isArray(submission.evidence) ? submission.evidence.length : 0;
  const summaryLength = String(submission.summary || "").length;
  const fraction = Math.min(0.9, 0.35 + Math.min(evidenceCount, 4) * 0.08 + (summaryLength >= 300 ? 0.2 : summaryLength >= 100 ? 0.12 : summaryLength > 0 ? 0.05 : 0));
  return {
    model: "heuristic-fallback",
    understanding: "Heuristic fallback: scored from the nomination's evidence count and summary only; the board should review before approving.",
    assessment: "Nomination for " + submission.nominee_name + " in " + (category?.name || submission.category_name || "its category") + " with " + evidenceCount + " evidence item(s). Scored at a uniform evidence-based fraction pending board review.",
    criteria_scores: criteria.map(c => ({ criterion_id: c.id, criterion_name: c.name, score: round2(Number(c.max_points) * fraction), max_points: Number(c.max_points), rationale: "Heuristic fallback score." })),
    criteria_change_requests: [],
  };
}

async function aiJudgment(env, submission, category, criteria) {
  const out = await aiJson(env, {
    model: DEFAULT_AI_MODEL, temperature: 0.2, maxTokens: 1600,
    messages: [
      { role: "system", content: "You are the awards judge for a private board. Score the submission against every criterion (score between 0 and the criterion max_points). You may NOT change any criterion definition; if a definition is unfit, request a change instead. Reply with JSON only: {\"understanding\":\"...\",\"assessment\":\"...\",\"criteria_scores\":[{\"criterion_id\":\"<id>\",\"score\":<number>,\"rationale\":\"...\"}],\"criteria_change_requests\":[{\"criterion_name\":\"...\",\"proposed_definition\":\"...\",\"purpose\":\"...\",\"intent\":\"...\"}]}" },
      { role: "user", content: JSON.stringify({ category: category ? { name: category.name, brief: category.private_brief || category.public_summary || null } : null, criteria: criteria.map(c => ({ id: c.id, name: c.name, max_points: c.max_points, definition: c.definition, anchors: c.anchors })), submission: { nominee_name: submission.nominee_name, nominee_type: submission.nominee_type, summary: submission.summary, evidence: submission.evidence } }) },
    ],
  });
  if (!out || !Array.isArray(out.criteria_scores)) return null;
  const fallback = heuristicJudgment(submission, category, criteria);
  const scores = criteria.map(c => {
    const s = out.criteria_scores.find(x => x && x.criterion_id === c.id);
    if (!s || !Number.isFinite(Number(s.score))) return fallback.criteria_scores.find(x => x.criterion_id === c.id);
    return { criterion_id: c.id, criterion_name: c.name, score: round2(Math.min(Number(c.max_points), Math.max(0, Number(s.score)))), max_points: Number(c.max_points), rationale: isStr(s.rationale, 1000) ? s.rationale : "" };
  });
  const requests = [];
  for (const r of Array.isArray(out.criteria_change_requests) ? out.criteria_change_requests : []) {
    if (!r || !isStr(r.criterion_name, 200) || !isStr(r.proposed_definition, 4000) || !r.proposed_definition.trim()) continue;
    const crit = criteria.find(c => c.name.toLowerCase() === r.criterion_name.toLowerCase());
    requests.push({ criterion_name: crit ? crit.name : r.criterion_name, current_definition: crit ? crit.definition : null, proposed_definition: r.proposed_definition, purpose: isStr(r.purpose, 2000) ? r.purpose : null, intent: isStr(r.intent, 2000) ? r.intent : null });
  }
  return { model: DEFAULT_AI_MODEL, understanding: isStr(out.understanding, 4000) ? out.understanding : "", assessment: isStr(out.assessment, 8000) ? out.assessment : "", criteria_scores: scores, criteria_change_requests: requests };
}

async function judgeSubmission(request, env, token) {
  const parsed = await readJson(request, 4096);
  if (parsed.error) return parsed.error;
  const submissionId = parsed.value?.submission_id;
  if (typeof submissionId !== "string" || !submissionId) return json({ error: "submission_id is required" }, 400);
  const subRes = await memberRest(env, token, { table: "submissions", query: "id=" + eq(submissionId) + "&select=*" });
  if (!subRes.ok) return json({ error: "Could not load the submission" }, 502);
  const submission = Array.isArray(subRes.data) ? subRes.data[0] : null;
  if (!submission) return json({ error: "Submission not found" }, 404);
  const catRes = await memberRest(env, token, { table: "award_categories", query: "id=" + eq(submission.category_id) + "&select=*" });
  const category = catRes.ok && Array.isArray(catRes.data) ? catRes.data[0] : null;
  const critRes = await memberRest(env, token, { table: "judging_criteria", query: "category_id=" + eq(submission.category_id) + "&select=*" });
  if (!critRes.ok) return json({ error: "Could not load the judging criteria" }, 502);
  const criteria = (Array.isArray(critRes.data) ? critRes.data : []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (!criteria.length) return json({ error: "This category has no judging criteria yet" }, 400);
  const result = (await aiJudgment(env, submission, category, criteria)) || heuristicJudgment(submission, category, criteria);
  const total = round2(result.criteria_scores.reduce((a, s) => a + s.score, 0));
  const max = round2(result.criteria_scores.reduce((a, s) => a + s.max_points, 0));
  const percentage = max > 0 ? round2((total / max) * 100) : 0;
  const recommendation = percentage >= 80 ? "award" : percentage >= 55 ? "shortlist" : "decline";
  const jRes = await memberRest(env, token, { table: "judgments", method: "POST", body: {
    submission_id: submission.id, category_id: submission.category_id, model: result.model,
    understanding: result.understanding, assessment: result.assessment,
    criteria_scores: result.criteria_scores, total_points: total, max_points: max,
    percentage, recommendation, status: "draft", judged_at: new Date().toISOString(),
  } });
  if (!jRes.ok || !Array.isArray(jRes.data) || !jRes.data[0]) return json({ error: "Could not record the judgment" }, 502);
  const judgment = jRes.data[0];
  let filed = 0;
  for (const r of result.criteria_change_requests) {
    const rRes = await memberRest(env, token, { table: "criteria_change_requests", method: "POST", body: {
      judgment_id: judgment.id, submission_id: submission.id, category_id: submission.category_id, ...r, status: "pending_review",
    } });
    if (rRes.ok) filed++;
  }
  return json({ judgment, criteria_change_requests: filed });
}

// --- Agent chat (mirrors category-agent.server.js + Version A chat config) -
async function agentChat(request, env, token) {
  const parsed = await readJson(request, 65536);
  if (parsed.error) return parsed.error;
  const agentId = parsed.value?.agent_id;
  const messages = parsed.value?.messages;
  if (typeof agentId !== "string" || !agentId) return json({ error: "agent_id is required" }, 400);
  if (!Array.isArray(messages) || !messages.length || messages.length > 50) return json({ error: "messages must be a non-empty array" }, 400);
  for (const m of messages) {
    if (!m || !["user", "assistant"].includes(m.role) || !isStr(m.content, 4000) || !m.content.trim()) {
      return json({ error: "each message needs a user/assistant role and content" }, 400);
    }
  }
  const aRes = await memberRest(env, token, { table: "agents", query: "id=" + eq(agentId) + "&select=id,name,system_prompt,model,temperature,max_tokens,max_messages,is_active" });
  if (!aRes.ok) return json({ error: "Could not load the agent" }, 502);
  const agent = Array.isArray(aRes.data) ? aRes.data[0] : null;
  if (!agent) return json({ error: "Agent not found" }, 404);
  if (!agent.system_prompt) return json({ error: "This agent has no chat configuration" }, 400);
  if (agent.is_active === false) return json({ error: "This agent's chat is disabled" }, 403);
  if (!env.AI || typeof env.AI.run !== "function") return json({ error: "AI is not configured on this Worker" }, 503);
  const maxMessages = Math.min(100, Math.max(2, Number(agent.max_messages) || 20));
  const history = messages.slice(-(maxMessages - 1)).map(m => ({ role: m.role, content: m.content }));
  const model = workersAiModel(agent.model);
  let result;
  try {
    result = await env.AI.run(model, { messages: [{ role: "system", content: agent.system_prompt }, ...history], temperature: Number(agent.temperature ?? 0.7), max_tokens: Number(agent.max_tokens ?? 4096) });
  } catch { return json({ error: "The AI service could not be reached" }, 502); }
  const reply = typeof result === "string" ? result : result?.response;
  if (typeof reply !== "string") return json({ error: "The AI service returned no reply" }, 502);
  return json({ reply, model, agent: agent.name });
}

async function handle(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({service:"executive-agent-research",status:env.RESEARCH_BUCKET?"ok":"storage-unavailable"});
    }
    if (url.pathname === "/v1/agent/research") {
      if (request.method !== "POST") return json({error:"Method not allowed"},405);
      return agentResearch(request, env);
    }
    if (["/v1/verify", "/v1/judge", "/v1/chat"].includes(url.pathname)) {
      if (request.method !== "POST") return json({error:"Method not allowed"},405);
      const user = await authenticate(request, env);
      if (user.error) return user.error;
      if (url.pathname === "/v1/verify") return verifyEntry(request, env, user.token);
      if (url.pathname === "/v1/judge") return judgeSubmission(request, env, user.token);
      return agentChat(request, env, user.token);
    }
    if (!url.pathname.startsWith("/v1/documents") || !["GET","PUT","DELETE"].includes(request.method)) {
      return json({error:"Not found"},404);
    }
    if (!env.RESEARCH_BUCKET) return json({error:"Storage unavailable"},503);
    const user = await authenticate(request, env);
    if (user.error) return user.error;
    if (url.pathname === "/v1/documents") {
      if (request.method !== "GET") return json({error:"Method not allowed"},405);
      const prefix = url.searchParams.get("prefix") || "";
      if (prefix && !validKey(prefix)) return json({error:"Invalid prefix"},400);
      const result = await env.RESEARCH_BUCKET.list({prefix:"documents/" + user.id + "/" + prefix,limit:100});
      return json({objects:result.objects.map(x=>({name:x.key.slice(("documents/" + user.id + "/").length),size:x.size,uploaded:x.uploaded})),truncated:result.truncated});
    }
    if (!url.pathname.startsWith("/v1/documents/")) return json({error:"Not found"},404);
    let key;
    try { key = decodeURIComponent(url.pathname.slice("/v1/documents/".length)); }
    catch { return json({error:"Invalid document name"},400); }
    if (!validKey(key)) return json({error:"Invalid document name"},400);
    const objectKey = "documents/" + user.id + "/" + key;
    if (request.method === "PUT") {
      const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!allowedTypes.has(type)) return json({error:"Unsupported content type"},415);
      const max = 10 * 1024 * 1024;
      const declared = request.headers.get("content-length");
      if (declared && (!/^\d+$/.test(declared) || Number(declared)>max)) return json({error:"Document too large"},413);
      const data = await request.arrayBuffer();
      if (data.byteLength > max) return json({error:"Document too large"},413);
      await env.RESEARCH_BUCKET.put(objectKey,data,{httpMetadata:{contentType:type},customMetadata:{owner:user.id}});
      return json({stored:true,name:key,size:data.byteLength},201);
    }
    if (request.method === "DELETE") {
      await env.RESEARCH_BUCKET.delete(objectKey);
      return json({deleted:true,name:key});
    }
    const object = await env.RESEARCH_BUCKET.get(objectKey);
    if (!object) return json({error:"Not found"},404);
    const headers = new Headers({"content-type":object.httpMetadata?.contentType || "application/octet-stream","cache-control":"private, no-store","x-content-type-options":"nosniff","content-disposition":"attachment"});
    return new Response(object.body,{headers});
}

// Only the executive console origin is permitted browser CORS access.
const CONSOLE_ORIGIN = "https://interplanetarysister.github.io";
function withCors(response, origin) {
  if (origin !== CONSOLE_ORIGIN) return response;
  const h = new Headers(response.headers);
  h.set("access-control-allow-origin", CONSOLE_ORIGIN);
  h.set("vary", "Origin");
  h.set("access-control-expose-headers", "content-disposition");
  return new Response(response.body, {status:response.status,statusText:response.statusText,headers:h});
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin");
    if (request.method === "OPTIONS") {
      if (origin !== CONSOLE_ORIGIN) return json({error:"Origin not allowed"},403);
      return new Response(null,{status:204,headers:{
        "access-control-allow-origin":CONSOLE_ORIGIN,
        "access-control-allow-methods":"GET, POST, PUT, DELETE, OPTIONS",
        "access-control-allow-headers":"authorization, content-type",
        "access-control-max-age":"600",
        "vary":"Origin"
      }});
    }
    return withCors(await handle(request,env),origin);
  }
};
