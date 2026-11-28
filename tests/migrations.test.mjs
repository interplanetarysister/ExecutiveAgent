// Migration rehearsal: the full manifest from supabase/MIGRATIONS.md,
// applied in order to a fresh Postgres (PGlite), plus behavioral checks
// on the Veritas Nexus tables and RLS.
//
// Run with `npm test`. Requires the @electric-sql/pglite devDependency;
// when it is not installed the rehearsal tests are skipped, never
// silently passed.
//
// What this proves: migration syntax/order, table/column shape, RLS
// enablement, policies, and privilege behavior under simulated
// PostgREST roles. What it cannot prove: hosted Supabase behavior
// (real Auth JWTs, PostgREST, the live project's current state).

import test from "node:test";
import assert from "node:assert/strict";
import {
  MIGRATION_MANIFEST,
  freshDb,
  actAs,
  rehearseMigrations,
  isRejected,
  loadPGlite,
} from "./helpers/pglite.mjs";

const PGlite = await loadPGlite();
const skip = PGlite ? false : "@electric-sql/pglite is not installed";

const DOMAIN_TABLES = [
  "research_entries",
  "research_sources",
  "verifications",
  "review_schedules",
  "award_categories",
  "judging_criteria",
  "submissions",
  "judgments",
  "criteria_change_requests",
  "certified_records",
];

const OWNER = "11111111-1111-4111-8111-111111111111";
const RESEARCHER = "22222222-2222-4222-8222-222222222222";
const OUTSIDER = "33333333-3333-4333-8333-333333333333";

async function rehearsedDb() {
  const db = await freshDb(PGlite);
  const results = await rehearseMigrations(db);
  const failed = results.find((r) => !r.ok);
  assert.equal(
    failed,
    undefined,
    failed ? `${failed.file}: ${failed.error}` : "",
  );
  return db;
}

test("migration manifest applies cleanly in order", { skip }, async (t) => {
  const db = await freshDb(PGlite);
  t.after(() => db.close());
  const results = await rehearseMigrations(db);
  assert.equal(
    results.length,
    MIGRATION_MANIFEST.length,
    `chain stopped early: ${JSON.stringify(results.at(-1))}`,
  );
  for (const r of results) {
    assert.ok(r.ok, `${r.file}: ${r.error}`);
  }
});

test(
  "veritas domain tables exist with RLS enabled and policies",
  { skip },
  async (t) => {
    const db = await rehearsedDb();
    t.after(() => db.close());
    const { rows } = await db.query(
      `select c.relname as table_name, c.relrowsecurity as rls,
              (select count(*) from pg_policies p
                where p.schemaname = 'executive' and p.tablename = c.relname) as policies
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'executive' and c.relkind = 'r'
          and c.relname = any($1)`,
      [DOMAIN_TABLES],
    );
    assert.equal(rows.length, DOMAIN_TABLES.length, "all 10 domain tables exist");
    for (const row of rows) {
      assert.equal(row.rls, true, `${row.table_name}: RLS enabled`);
      assert.ok(row.policies >= 1, `${row.table_name}: at least one policy`);
    }
  },
);

test(
  "agents registry stores key hash + hint, never a plaintext key column",
  { skip },
  async (t) => {
    const db = await rehearsedDb();
    t.after(() => db.close());
    const { rows } = await db.query(
      `select column_name from information_schema.columns
        where table_schema = 'executive' and table_name = 'agents'`,
    );
    const columns = new Set(rows.map((r) => r.column_name));
    for (const expected of [
      // registry columns added by 20261127_veritas_agents_registry.sql
      "purpose",
      "runtime",
      "api_key_hash",
      "api_key_hint",
      "last_submission_at",
      "submission_count",
      "notes",
      // chat-configuration columns from the same migration
      "description",
      "icon",
      "category",
      "system_prompt",
      "tools",
      "model",
      "temperature",
      "max_tokens",
      "max_messages",
      "sort_order",
      "requires_user_context",
      "is_active",
    ]) {
      assert.ok(columns.has(expected), `agents.${expected} exists`);
    }
    assert.ok(
      !columns.has("api_key"),
      "agents.api_key must not exist: only the SHA-256 hash + hint are stored",
    );
  },
);

test(
  "michelle rogers agent is registered without key material; research source_url dedupe is database-backed",
  { skip },
  async (t) => {
    const db = await rehearsedDb();
    t.after(() => db.close());

    const { rows } = await db.query(
      `select name, role, host, status, category, api_key_hash, api_key_hint
         from executive.agents
        where name = 'Michelle Rogers — Executive Agent'`,
    );
    assert.equal(rows.length, 1, "exactly one Michelle Rogers — Executive Agent row");
    const agent = rows[0];
    assert.equal(agent.role, "executive");
    assert.equal(agent.host, "cloudflare");
    assert.equal(agent.status, "active");
    assert.equal(agent.category, "executive");
    // No key material in source: the hash is set at activation, out of band.
    assert.equal(agent.api_key_hash, null);
    assert.equal(agent.api_key_hint, null);

    // The partial unique index makes the knowledge endpoint's
    // dedupe-by-source_url rule a database guarantee for filed sources…
    await actAs(db, "postgres");
    await db.exec(`
      insert into public.executive_research (title, kind, source_url)
      values ('First filing', 'source', 'https://example.com/course');
    `);
    assert.ok(
      await isRejected(
        db,
        `insert into public.executive_research (title, kind, source_url)
         values ('Duplicate filing', 'source', 'https://example.com/course')`,
      ),
      "a second research row with the same source_url is rejected",
    );
    // …while rows without a source_url stay unrestricted.
    await db.exec(`
      insert into public.executive_research (title, kind, source_url)
      values ('Sourceless note A', 'reference', null),
             ('Sourceless note B', 'reference', null);
    `);
  },
);

test("veritas RLS behavior: member, board, outsider, anonymous", { skip }, async (t) => {
  const db = await rehearsedDb();
  t.after(() => db.close());

  // Seed users and memberships as the privileged server role.
  await actAs(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@example.com'),
      ('${RESEARCHER}', 'researcher@example.com'),
      ('${OUTSIDER}', 'outsider@example.com');
    insert into public.executive_memberships (user_id, role, active) values
      ('${OWNER}', 'owner', true),
      ('${RESEARCHER}', 'researcher', true);
  `);

  // A member (researcher) files a research entry under their own id...
  await actAs(db, "authenticated", RESEARCHER);
  await db.exec(`
    insert into executive.research_entries (title, summary, owner_id)
    values ('Rehearsal entry', 'A claim under verification', '${RESEARCHER}');
  `);
  // ...and reads it back.
  let { rows } = await db.query("select title from executive.research_entries");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Rehearsal entry");

  // ...but cannot file an entry under someone else's id.
  assert.ok(
    await isRejected(
      db,
      `insert into executive.research_entries (title, owner_id)
       values ('Forged entry', '${OWNER}')`,
    ),
    "researcher cannot insert an entry owned by someone else",
  );

  // An authenticated outsider (no membership) can neither file nor read.
  await actAs(db, "authenticated", OUTSIDER);
  assert.ok(
    await isRejected(
      db,
      `insert into executive.research_entries (title, owner_id)
       values ('Outsider entry', '${OUTSIDER}')`,
    ),
    "outsider cannot insert a research entry",
  );
  ({ rows } = await db.query("select id from executive.research_entries"));
  assert.equal(rows.length, 0, "outsider cannot select member research entries");

  // Anonymous access is denied outright (no privileges on the tables).
  await actAs(db, "anon");
  assert.ok(
    await isRejected(db, "select id from executive.research_entries"),
    "anon cannot select research entries",
  );

  // Board flow: the owner (manage role) opens a category, a member
  // nominates a submission, and only the board can judge it.
  await actAs(db, "authenticated", OWNER);
  await db.exec(`
    insert into executive.award_categories (id, name, slug)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rehearsal Award', 'rehearsal-award');
  `);
  await actAs(db, "authenticated", RESEARCHER);
  await db.exec(`
    insert into executive.submissions (id, category_id, nominee_name)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Nominee');
  `);
  // Non-manage roles are rejected by the board-only tables, reads included.
  assert.ok(
    await isRejected(
      db,
      `insert into executive.judging_criteria (category_id, name)
       values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Smuggled criterion')`,
    ),
    "researcher cannot insert judging criteria",
  );
  assert.ok(
    await isRejected(
      db,
      `insert into executive.judgments (submission_id)
       values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')`,
    ),
    "researcher cannot insert a judgment",
  );
  ({ rows } = await db.query("select id from executive.judgments"));
  assert.equal(rows.length, 0, "researcher cannot select judgments");

  await actAs(db, "authenticated", OWNER);
  await db.exec(`
    insert into executive.judgments (submission_id, recommendation)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'shortlist');
  `);
  ({ rows } = await db.query("select recommendation from executive.judgments"));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recommendation, "shortlist");
});
