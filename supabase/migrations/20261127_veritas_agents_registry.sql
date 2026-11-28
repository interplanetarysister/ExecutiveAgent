-- Veritas Nexus mirror, Phase 1a: extend executive.agents into the unified
-- agent registry. Project: bimmfmydbmooarobilsq (ExecutiveAgent only, never
-- the iFund database). Source-only: NOT applied to the live project.
--
-- The Veritas Nexus Agent entity was observed in two schemas:
--   Version B (registry): name, purpose, runtime, status, api_key,
--     last_submission_at, submission_count, notes.
--   Version A (chat): name, description, icon, category, system_prompt,
--     tools, model, temperature, max_tokens, max_messages, sort_order,
--     requires_user_context, is_active.
-- executive.agents already holds the registry's identity columns (name,
-- role, host, workspace, status, capabilities). This migration adds both
-- observed field sets to that one canonical table instead of creating a
-- second agents table: a registry of submitting agents (B) whose entries
-- can also carry chat configuration (A).
--
-- Security deviation from the source, deliberate: the bearer api_key is
-- never stored in clear text. api_key_hash holds the SHA-256 hex digest
-- the future submission endpoint compares against; api_key_hint holds a
-- display-safe fragment (e.g. last 4 characters).

begin;

alter table executive.agents
  add column if not exists purpose text,
  add column if not exists runtime text,
  add column if not exists api_key_hash text,
  add column if not exists api_key_hint text,
  add column if not exists last_submission_at timestamptz,
  add column if not exists submission_count integer not null default 0,
  add column if not exists notes text,
  add column if not exists description text,
  add column if not exists icon text,
  add column if not exists category text,
  add column if not exists system_prompt text,
  add column if not exists tools jsonb not null default '[]'::jsonb,
  add column if not exists model text default 'google/gemini-3-pro-preview',
  add column if not exists temperature numeric not null default 0.7,
  add column if not exists max_tokens integer not null default 4096,
  add column if not exists max_messages integer not null default 20,
  add column if not exists sort_order integer not null default 0,
  add column if not exists requires_user_context boolean not null default false,
  add column if not exists is_active boolean not null default true;

alter table executive.agents
  drop constraint if exists agents_category_check,
  add constraint agents_category_check
    check (category is null or category in ('executive','research','compliance','evaluation'));

comment on column executive.agents.status is
  'active | paused | revoked | retired (revoked is the Veritas registry terminal state; retired is the pre-existing executive vocabulary)';

create index if not exists agents_api_key_hash_idx
  on executive.agents (api_key_hash) where api_key_hash is not null;
create index if not exists agents_category_idx
  on executive.agents (category, sort_order) where category is not null;

-- Console write path: RLS policies for executive.agents already exist
-- (member_insert/member_update via executive_can('write'), member_delete
-- via executive_can('manage'), from 20261126_member_write_policies.sql),
-- but table privileges were only ever repaired for executive.tasks.
-- PostgreSQL requires both the privilege and the policy.
grant insert, update, delete on executive.agents to authenticated;

insert into executive.audit_log (actor, action, target, target_type, target_id, result, detail)
values ('executive-agent-muse', 'apply_migration', 'supabase:bimmfmydbmooarobilsq/veritas agents registry', 'database', 'bimmfmydbmooarobilsq', 'ok',
        jsonb_build_object('migration', '20261127_veritas_agents_registry',
                           'columns_added', 19, 'api_key_storage', 'sha256 hash + hint only'));

commit;
