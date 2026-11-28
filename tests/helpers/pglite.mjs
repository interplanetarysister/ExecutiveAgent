// Real-Postgres rehearsal harness for the Executive Agent migrations.
//
// PGlite is PostgreSQL compiled to WebAssembly, so the migration SQL is
// executed by an actual Postgres engine rather than pattern-matched. It
// proves syntax, constraints, RLS and privileges — not hosted Supabase
// configuration (Auth, PostgREST, storage), which stays UNKNOWN here.
//
// Supabase ships its own `auth` schema and the roles `anon`,
// `authenticated` and `service_role`. This harness creates the minimum
// shape the migrations reference: `auth.users`, `auth.uid()`, `auth.jwt()`
// and the three roles. These stubs are harness-only; they are never part
// of the migrations themselves. PostgREST's per-request role + JWT claims
// are modelled by actAs(): switch role, and stub the uid/email settings
// that auth.uid() / auth.jwt() read.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export const repoFile = (relative) => `${repoRoot}${relative}`;

export const readMigration = (relative) =>
  readFileSync(repoFile(relative), "utf8");

// The canonical apply order from supabase/MIGRATIONS.md (kept in sync
// with supabase/rebuild.sh). 20231123_init.sql is deliberately excluded:
// the manifest marks it DO NOT APPLY (superseded, not valid PostgreSQL).
export const MIGRATION_MANIFEST = [
  "executiveagent/supabase/migrations/20261126_executive_core.sql",
  "supabase/migrations/20261126_executive_foundation.sql",
  "supabase/migrations/20261126_align_executive_member_rls.sql",
  "supabase/migrations/20261127_repair_audit_log_target_columns.sql",
  "supabase/migrations/20261126_member_write_policies.sql",
  "supabase/migrations/20261126_grant_member_dml.sql",
  "supabase/migrations/20261126_enable_member_task_writes.sql",
  "supabase/migrations/20261126_reconcile_canonical.sql",
  "supabase/migrations/20261126_executive_appointments_correspondence.sql",
  "supabase/migrations/20261126_executive_deadline_monitor.sql",
  "supabase/migrations/20261126_executive_scheduler_execution_receipts.sql",
  "supabase/migrations/20261126_recording_contract.sql",
  "supabase/migrations/20261127_veritas_agents_registry.sql",
  "supabase/migrations/20261127_veritas_nexus_domain.sql",
];

/** A fresh in-memory Postgres with the Supabase-shaped auth schema. */
export async function freshDb(PGlite) {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key, email text);
    -- auth.uid() in Supabase reads the JWT sub claim. The test.uid
    -- setting stands in for it so a test can act as a specific user.
    create or replace function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create or replace function auth.jwt() returns jsonb
      language sql stable
      as $$ select jsonb_build_object(
        'sub', nullif(current_setting('test.uid', true), ''),
        'email', nullif(current_setting('test.email', true), '')) $$;
    create role anon;
    create role authenticated;
    create role service_role;
    -- Hosted Supabase exposes application schemas to the API roles
    -- (usage grant); the migrations assume it and never grant it
    -- themselves. The core migration creates the executive schema
    -- only if it does not exist, so it is a no-op against this
    -- pre-created schema and the usage grants survive the chain.
    create schema if not exists executive;
    grant usage on schema executive to anon, authenticated, service_role;
  `);
  return db;
}

/**
 * Act as a role, optionally with an auth.uid(). Session-level, not
 * SET LOCAL: each db.exec is its own implicit transaction, so SET LOCAL
 * would be a no-op. Role "postgres" returns to the privileged server
 * role, which is how the service role seeds server-owned rows.
 */
export async function actAs(db, role, uid = "", email = "") {
  await db.exec(`reset role;`);
  await db.exec(`select set_config('test.uid', '${uid}', false);`);
  await db.exec(`select set_config('test.email', '${email}', false);`);
  if (role !== "postgres") await db.exec(`set role ${role};`);
}

/**
 * Apply the manifest in order. Returns one { file, ok, error } result
 * per migration instead of throwing, so a rehearsal reports the whole
 * chain; stops at the first failure because later migrations depend on
 * earlier ones.
 */
export async function rehearseMigrations(db, manifest = MIGRATION_MANIFEST) {
  const results = [];
  for (const relative of manifest) {
    const sql = readMigration(relative).replace(
      /create extension if not exists pgcrypto;/gi,
      "",
    );
    try {
      await db.exec(sql);
      results.push({ file: relative, ok: true, error: null });
    } catch (cause) {
      results.push({ file: relative, ok: false, error: cause.message });
      break;
    }
  }
  return results;
}

/** Run a statement and report whether Postgres rejected it. */
export async function isRejected(db, sql) {
  try {
    await db.exec(sql);
    return false;
  } catch {
    return true;
  }
}

/** Resolve the PGlite module, or null when it is not installed. */
export async function loadPGlite() {
  try {
    const mod = await import("@electric-sql/pglite");
    return mod.PGlite;
  } catch {
    return null;
  }
}
