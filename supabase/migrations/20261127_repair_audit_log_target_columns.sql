-- Repair (2026-11-27): executive.audit_log target columns, added early.
-- Project: bimmfmydbmooarobilsq (ExecutiveAgent only, never the iFund
-- database).
--
-- Defect found by the local migration rehearsal (tests/migrations.test.mjs):
-- 20261126_member_write_policies.sql closes with an audit insert into
-- executive.audit_log (actor, action, target, target_type, target_id,
-- result, detail), but the core migration creates executive.audit_log
-- WITHOUT target_type / target_id. Those columns are only added two steps
-- later by 20261126_reconcile_canonical.sql (which also backfills
-- target_id from target). In manifest order a fresh rebuild therefore
-- fails at the member-write-policies step.
--
-- The applied migrations are never edited, so this repair adds the two
-- columns here instead — at the point in the apply order where they are
-- first needed. Both statements are idempotent: on the live project
-- (where the reconcile migration already added the columns) this file is
-- a no-op, and the reconcile migration's own
-- `add column if not exists` statements stay no-ops after this file.
--
-- Apply order: after 20261126_align_executive_member_rls.sql, before
-- 20261126_member_write_policies.sql. See supabase/MIGRATIONS.md.

begin;

alter table executive.audit_log add column if not exists target_type text;
alter table executive.audit_log add column if not exists target_id text;

commit;
