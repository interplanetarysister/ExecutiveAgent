// Worker unit tests for the executive document API.
// Runs locally with no network and no secrets: Supabase Auth/PostgREST are
// stubbed at globalThis.fetch, and R2 is a Map. The same suite runs against
// BOTH Worker copies (canonical cloudflare/ and nested executiveagent/src/),
// which the repo requires to stay byte-identical — a behavioural drift in
// either copy fails here.
import test from "node:test";
import assert from "node:assert/strict";
import canonicalWorker from "../cloudflare/executive-agent-research.mjs";
import nestedWorker from "../executiveagent/src/research-worker.mjs";

const CONSOLE_ORIGIN = "https://interplanetarysister.github.io";
const SUPABASE_URL = "https://bimmfmydbmooarobilsq.supabase.co";

// token -> { user } for /auth/v1/user; token -> memberships for PostgREST.
const USERS = {
  "owner-token":      { id: "user-owner",      email: "owner@example.com",    email_confirmed_at: "2026-01-01T00:00:00Z" },
  "admin-token":      { id: "user-admin",      email: "owner@example.com",    email_confirmed_at: "2026-01-01T00:00:00Z" },
  "researcher-token": { id: "user-researcher", email: "owner@example.com",    email_confirmed_at: "2026-01-01T00:00:00Z" },
  "inactive-token":   { id: "user-inactive",   email: "owner@example.com",    email_confirmed_at: "2026-01-01T00:00:00Z" },
  "nomember-token":   { id: "user-nomember",   email: "owner@example.com",    email_confirmed_at: "2026-01-01T00:00:00Z" },
  "unconfirmed-token":{ id: "user-unconf",     email: "owner@example.com" },
  "outsider-token":   { id: "user-outsider",   email: "outsider@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" },
};
const MEMBERSHIPS = {
  "owner-token":      [{ role: "owner", active: true }],
  "admin-token":      [{ role: "admin", active: true }],
  "researcher-token": [{ role: "researcher", active: true }],
  "inactive-token":   [{ role: "owner", active: false }],
  "nomember-token":   [],
  "unconfirmed-token":[{ role: "owner", active: true }],
  "outsider-token":   [{ role: "owner", active: true }],
};

function stubFetch() {
  return async (url, init = {}) => {
    const u = new URL(url);
    const token = String(init.headers?.authorization || "").replace(/^Bearer\s+/i, "");
    if (u.origin === SUPABASE_URL && u.pathname === "/auth/v1/user") {
      const user = USERS[token];
      if (!user) return new Response(JSON.stringify({ error: "invalid" }), { status: 401 });
      return new Response(JSON.stringify(user), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (u.origin === SUPABASE_URL && u.pathname === "/rest/v1/executive_memberships") {
      return new Response(JSON.stringify(MEMBERSHIPS[token] ?? []), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error("Unexpected fetch in tests: " + u.href);
  };
}

function fakeBucket() {
  const store = new Map();
  return {
    store,
    async list({ prefix, limit }) {
      const objects = [...store.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .slice(0, limit)
        .map(([key, v]) => ({ key, size: v.data.byteLength, uploaded: new Date("2026-11-26T00:00:00Z") }));
      return { objects, truncated: false };
    },
    async put(key, data, opts) { store.set(key, { data: new Uint8Array(data), contentType: opts?.httpMetadata?.contentType }); },
    async get(key) {
      const v = store.get(key);
      if (!v) return null;
      return { body: v.data, httpMetadata: { contentType: v.contentType } };
    },
    async delete(key) { store.delete(key); },
  };
}

function makeEnv(bucket) {
  return {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    EXECUTIVE_OWNER_EMAILS: "owner@example.com",
    RESEARCH_BUCKET: bucket,
  };
}

function req(path, { method = "GET", token, origin, headers = {}, body } = {}) {
  const h = { ...headers };
  if (token) h.authorization = "Bearer " + token;
  if (origin) h.origin = origin;
  return new Request("https://worker.test" + path, { method, headers: h, body });
}

function suite(name, worker) {
  const call = async (request, env) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = stubFetch();
    try { return await worker.fetch(request, env); }
    finally { globalThis.fetch = realFetch; }
  };

  test(name + ": health is ok with a bucket", async () => {
    const res = await call(req("/health"), makeEnv(fakeBucket()));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.service, "executive-agent-research");
    assert.equal(body.status, "ok");
  });

  test(name + ": health reports storage-unavailable without a bucket", async () => {
    const env = makeEnv(undefined);
    const res = await call(req("/health"), env);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, "storage-unavailable");
  });

  test(name + ": unknown route is 404", async () => {
    const res = await call(req("/nope"), makeEnv(fakeBucket()));
    assert.equal(res.status, 404);
  });

  test(name + ": OPTIONS from the console origin is 204 with CORS headers", async () => {
    const res = await call(req("/v1/documents", { method: "OPTIONS", origin: CONSOLE_ORIGIN }), makeEnv(fakeBucket()));
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-origin"), CONSOLE_ORIGIN);
  });

  test(name + ": OPTIONS from a foreign origin is 403", async () => {
    const res = await call(req("/v1/documents", { method: "OPTIONS", origin: "https://evil.example" }), makeEnv(fakeBucket()));
    assert.equal(res.status, 403);
  });

  test(name + ": console-origin responses carry CORS headers, foreign ones do not", async () => {
    const env = makeEnv(fakeBucket());
    const good = await call(req("/health", { origin: CONSOLE_ORIGIN }), env);
    assert.equal(good.headers.get("access-control-allow-origin"), CONSOLE_ORIGIN);
    const bad = await call(req("/health", { origin: "https://evil.example" }), env);
    assert.equal(bad.headers.get("access-control-allow-origin"), null);
  });

  test(name + ": documents without an Authorization header are 401", async () => {
    const res = await call(req("/v1/documents"), makeEnv(fakeBucket()));
    assert.equal(res.status, 401);
  });

  test(name + ": documents with a malformed Authorization header are 401", async () => {
    const res = await call(req("/v1/documents", { headers: { authorization: "Token abc" } }), makeEnv(fakeBucket()));
    assert.equal(res.status, 401);
  });

  test(name + ": missing owner-email configuration is 503", async () => {
    const env = makeEnv(fakeBucket());
    delete env.EXECUTIVE_OWNER_EMAILS;
    const res = await call(req("/v1/documents", { token: "owner-token" }), env);
    assert.equal(res.status, 503);
  });

  test(name + ": a token Supabase rejects is 401", async () => {
    const res = await call(req("/v1/documents", { token: "forged-token" }), makeEnv(fakeBucket()));
    assert.equal(res.status, 401);
  });

  test(name + ": an unconfirmed email is 403", async () => {
    const res = await call(req("/v1/documents", { token: "unconfirmed-token" }), makeEnv(fakeBucket()));
    assert.equal(res.status, 403);
  });

  test(name + ": a confirmed email outside the allowlist is 403", async () => {
    const res = await call(req("/v1/documents", { token: "outsider-token" }), makeEnv(fakeBucket()));
    assert.equal(res.status, 403);
  });

  test(name + ": an allowlisted user with no membership is 403", async () => {
    const res = await call(req("/v1/documents", { token: "nomember-token" }), makeEnv(fakeBucket()));
    assert.equal(res.status, 403);
  });

  test(name + ": an inactive membership is 403", async () => {
    const res = await call(req("/v1/documents", { token: "inactive-token" }), makeEnv(fakeBucket()));
    assert.equal(res.status, 403);
  });

  test(name + ": a researcher membership is 403 (documents are owner/admin only)", async () => {
    const res = await call(req("/v1/documents", { token: "researcher-token" }), makeEnv(fakeBucket()));
    assert.equal(res.status, 403);
  });

  test(name + ": an admin membership may list documents", async () => {
    const res = await call(req("/v1/documents", { token: "admin-token" }), makeEnv(fakeBucket()));
    assert.equal(res.status, 200);
  });

  test(name + ": list returns only the caller's own objects", async () => {
    const bucket = fakeBucket();
    const env = makeEnv(bucket);
    await call(req("/v1/documents/mine.txt", { method: "PUT", token: "owner-token", headers: { "content-type": "text/plain" }, body: "hi" }), env);
    bucket.store.set("documents/user-admin/other.txt", { data: new Uint8Array(3), contentType: "text/plain" });
    const res = await call(req("/v1/documents", { token: "owner-token" }), env);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.objects.map(o => o.name), ["mine.txt"]);
  });

  test(name + ": PUT stores a document under the caller's prefix (201)", async () => {
    const bucket = fakeBucket();
    const env = makeEnv(bucket);
    const res = await call(req("/v1/documents/notes.md", { method: "PUT", token: "owner-token", headers: { "content-type": "text/markdown" }, body: "# hi" }), env);
    assert.equal(res.status, 201);
    assert.ok(bucket.store.has("documents/user-owner/notes.md"));
  });

  test(name + ": PUT with an unsupported content type is 415", async () => {
    const res = await call(req("/v1/documents/x.zip", { method: "PUT", token: "owner-token", headers: { "content-type": "application/zip" }, body: "zz" }), makeEnv(fakeBucket()));
    assert.equal(res.status, 415);
  });

  test(name + ": PUT declaring more than 10 MiB is 413", async () => {
    const res = await call(req("/v1/documents/big.pdf", { method: "PUT", token: "owner-token", headers: { "content-type": "application/pdf", "content-length": String(11 * 1024 * 1024) }, body: "x" }), makeEnv(fakeBucket()));
    assert.equal(res.status, 413);
  });

  test(name + ": GET returns a stored document; a missing one is 404", async () => {
    const bucket = fakeBucket();
    const env = makeEnv(bucket);
    await call(req("/v1/documents/a.txt", { method: "PUT", token: "owner-token", headers: { "content-type": "text/plain" }, body: "hello" }), env);
    const got = await call(req("/v1/documents/a.txt", { token: "owner-token" }), env);
    assert.equal(got.status, 200);
    assert.equal(await got.text(), "hello");
    const missing = await call(req("/v1/documents/absent.txt", { token: "owner-token" }), env);
    assert.equal(missing.status, 404);
  });

  test(name + ": DELETE removes the caller's document", async () => {
    const bucket = fakeBucket();
    const env = makeEnv(bucket);
    await call(req("/v1/documents/a.txt", { method: "PUT", token: "owner-token", headers: { "content-type": "text/plain" }, body: "hello" }), env);
    const res = await call(req("/v1/documents/a.txt", { method: "DELETE", token: "owner-token" }), env);
    assert.equal(res.status, 200);
    assert.equal(bucket.store.has("documents/user-owner/a.txt"), false);
  });

  test(name + ": path traversal in a document key is 400", async () => {
    const res = await call(req("/v1/documents/..%2Fsecret.txt", { token: "owner-token" }), makeEnv(fakeBucket()));
    assert.equal(res.status, 400);
  });

  test(name + ": DELETE on the collection is 405 after auth", async () => {
    const res = await call(req("/v1/documents", { method: "DELETE", token: "owner-token" }), makeEnv(fakeBucket()));
    assert.equal(res.status, 405);
  });

  test(name + ": documents are 503 when storage is unbound", async () => {
    const res = await call(req("/v1/documents", { token: "owner-token" }), makeEnv(undefined));
    assert.equal(res.status, 503);
  });
}

suite("canonical worker", canonicalWorker);
suite("nested worker", nestedWorker);
