# Supabase Migrations — Ordered Rebuild Manifest

The canonical schema for the Executive Agent is spread across **two**
migration directories. Both directories are canonical and preserved:

- `executiveagent/supabase/migrations/` — the nested (original) directory
- `supabase/migrations/` — the repository-root directory

**New migrations go in the root `supabase/migrations/` directory.**

Canonical Supabase project ref: `bimmfmydbmooarobilsq` (the dedicated
ExecutiveAgent project — never the Interplanetary Fund database).

To rebuild a scratch / new project, or to recover from disaster, apply the
files below **in the order listed**. See `rebuild.sh` in this directory,
which applies exactly this manifest.

## Apply order

### 1. `executiveagent/supabase/migrations/20261126_executive_core.sql`

- **Purpose:** Creates the `executive` schema and its 15 domain tables
  (agents, tasks, sources, knowledge, decisions, organizations, people,
  funding_opportunities, funding_commitments, communications, capabilities,
  integrations, training, audit_log, owner_emails), including the
  `executive.owner_emails` allowlist used by the original owner-read RLS
  policies.
- **Prerequisites:** None. This is the first migration.
- **Header status:** Applied 2026-11-26 to project `bimmfmydbmooarobilsq`.

### 2. `supabase/migrations/20261126_executive_foundation.sql`

- **Purpose:** Creates `public.executive_memberships`, the
  `public.executive_can()` authorization function, and the public
  research / opportunities / skills / audit tables
  (`public.executive_research`, `public.executive_opportunities`,
  `public.executive_skills`, `public.executive_audit_events`) with RLS
  enabled and their policies.
- **Prerequisites:** None strictly in SQL, but it is applied after the core
  migration in the canonical order; later migrations depend on the
  memberships table and `public.executive_can()` defined here.
- **Header status:** Baseline captured 2026-11-26 from the deployed schema.

### 3. `supabase/migrations/20261126_align_executive_member_rls.sql`

- **Purpose:** Replaces the executive-schema `owner_read` policies with
  policies based on `public.executive_can('read')`, aligning the
  `executive` schema with verified Supabase Auth memberships.
- **Prerequisites:** Requires `public.executive_can(text)` and
  `public.executive_memberships` from
  `20261126_executive_foundation.sql` (step 2). The `executive` schema
  tables it re-policies come from step 1.
- **Header status:** Applied 2026-11-26 to project `bimmfmydbmooarobilsq`.

### 4. `supabase/migrations/20261127_repair_audit_log_target_columns.sql`

- **Purpose:** Repair added 2026-11-27. Adds `target_type` and
  `target_id` to `executive.audit_log` at the point in the apply order
  where they are first needed: the member write policies (step 5) close
  with an audit insert naming both columns, but the core migration
  creates `audit_log` without them and they were previously only added
  by the reconcile migration (step 7). Idempotent — a no-op wherever the
  reconcile migration has already run, including the live project.
- **Prerequisites:** Requires the core schema (step 1, for
  `executive.audit_log`).
- **Header status:** Source-only; not separately applied to the live
  project (no-op there by design).

### 5. `supabase/migrations/20261126_member_write_policies.sql`

- **Purpose:** Adds member insert / update / delete policies for the
  `executive` tables — write access via `public.executive_can('write')`
  for writable tables, and `public.executive_can('manage')` for governed
  tables (decisions, funding_commitments) and deletes.
- **Prerequisites:** Requires the core schema (step 1) and the foundation
  migration (step 2, for `public.executive_can()`).
- **Header status:** Applied 2026-11-26.

### 6. `supabase/migrations/20261126_enable_member_task_writes.sql`

- **Purpose:** Grants `insert, update` on `executive.tasks` to the
  `authenticated` role. PostgreSQL requires both table privileges and an
  RLS policy for member task writes; this supplies the privilege half.
  No grant is made to `anon`.
- **Prerequisites:** Requires the core schema (step 1, for
  `executive.tasks`) and the member write policies (step 5).
- **Header status:** Applied 2026-11-26.

### 7. `supabase/migrations/20261126_reconcile_canonical.sql`

- **Purpose:** Establishes one canonical home per domain: turns
  `public.executive_audit_events` into a **view** over
  `executive.audit_log`, turns `executive.funding_opportunities` into a
  **view** over the canonical `public.executive_opportunities`, and drops
  the retired `executive.owner_emails` allowlist (memberships become the
  only authorization source of truth).
- **Prerequisites:** Requires the core migration (step 1) and the
  foundation migration (step 2).
- **Header status:** Applied 2026-11-26 to project `bimmfmydbmooarobilsq`.
- **Caution:** This migration drops and recreates objects, so re-running
  the rebuild against the production project is **not** a no-op. See the
  safety note in `rebuild.sh`.

### 8. `supabase/migrations/20261127_veritas_agents_registry.sql`

- **Purpose:** Veritas agents registry (added after the 2026-11-26
  canonical set).
- **Prerequisites:** Requires the canonical set above, in particular the
  reconcile migration (step 7).

### 9. `supabase/migrations/20261127_veritas_nexus_domain.sql`

- **Purpose:** Veritas Nexus domain schema (added after the 2026-11-26
  canonical set).
- **Prerequisites:** Requires the canonical set above, in particular the
  reconcile migration (step 7) and the Veritas agents registry (step 8).

## DO NOT APPLY

### `executiveagent/supabase/migrations/20231123_init.sql`

**Do not apply this file.**

- It is **superseded** by `20261126_executive_core.sql` — its own header
  says so.
- It was **never applied** to project `bimmfmydbmooarobilsq`.
- It is **not valid PostgreSQL**: it uses statements such as
  `enable row level security on <table>`, which is not a statement.
- It is retained in the repository for history only.

## Notes

- **Owner bootstrap is deliberately not in this repository.** The
  foundation migration (`20261126_executive_foundation.sql`) explains why:
  owner membership bootstrap is deployed separately in the private
  database, conditioned on Supabase verified email identity and an
  owner-only allowlist. Do not put owner addresses or API secrets in this
  public repository.
- **Live-applied status is UNKNOWN beyond the files' own headers.** Several
  files carry "Applied 2026-11-26" headers (noted per file above); nothing
  in this repository independently verifies the current live state of
  project `bimmfmydbmooarobilsq` beyond those headers.
- **Both migration directories are canonical and preserved.** New
  migrations go in the root `supabase/migrations/` directory.
- **Never edit an applied migration.** If the schema needs to change, add
  a new migration file instead.
