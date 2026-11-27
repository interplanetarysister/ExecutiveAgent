-- Veritas Nexus mirror, Phase 1b: the Veritas Nexus domain schema.
-- Project: bimmfmydbmooarobilsq (ExecutiveAgent only, never the iFund database).
-- Source-only: NOT applied to the live project. Add as a new file; never edit
-- an applied migration. Requires 20261126_executive_core.sql (executive
-- schema), 20261126_executive_foundation.sql (public.executive_can), and
-- 20261127_veritas_agents_registry.sql (agent columns these tables reference
-- only by foreign key to executive.agents).
--
-- RLS translation of the source's Base44 rules into this repo's membership
-- model (public.executive_can: manage = owner/admin, write = +researcher,
-- read = +viewer):
--   source "owner-or-admin" (per-row owner)  -> owner_id = auth.uid() with
--     'write', or 'manage' for any row (research entries, sources,
--     verifications, review schedules).
--   source "admin only"                      -> executive_can('manage')
--     for every operation, reads included (judging criteria, judgments,
--     criteria change requests — the board-only data).
--   source "write: admin" boards             -> 'manage' writes, member
--     reads (award categories, certified records).
--   submissions                              -> members nominate ('write'),
--     members read, board controls status ('manage' update/delete).
-- Deliberate deviations from the source, recorded in the gap map: the
-- source also allows anonymous reads of open award categories and issued
-- certified records (its public pages). This schema has no anonymous
-- access anywhere, matching the executive schema's standing rule; a
-- public surface is an owner decision, not assumed here.
-- Fields the source inventory could not capture are typed without a
-- check constraint and marked UNKNOWN below rather than guessed.

begin;

-- ---------------------------------------------------------------------------
-- Research vault: agent-submitted entries under verification.
-- ---------------------------------------------------------------------------
create table if not exists executive.research_entries (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  topic       text,
  domain      text not null default 'other'
              check (domain in ('technology','industry','policy','other')),
  summary     text,                       -- the claim being filed
  body        text,
  owner_id    uuid references auth.users(id) on delete set null,
  agent_id    uuid references executive.agents(id) on delete set null,
  agent_name  text,                       -- snapshot at filing time
  status      text not null default 'pending'
              check (status in ('pending','certified','provisional','stale','rejected')),
  trust_score numeric(5,2),
  dimensions  jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists research_entries_agent_idx on executive.research_entries (agent_id);
create index if not exists research_entries_status_idx on executive.research_entries (status, created_at desc);
create index if not exists research_entries_owner_idx on executive.research_entries (owner_id);

create table if not exists executive.research_sources (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references executive.research_entries(id) on delete cascade,
  owner_id        uuid references auth.users(id) on delete set null,
  title           text not null,
  url             text,
  publisher       text,
  published_date  date,
  source_type     text not null default 'other',  -- source enum UNKNOWN (folded in editor)
  excerpt         text,
  credibility_note text,
  check_status    text not null default 'unchecked'
                  check (check_status in ('unchecked','supports','contradicts','unclear','unreachable')),
  created_at      timestamptz not null default now()
);
create index if not exists research_sources_entry_idx on executive.research_sources (entry_id);

create table if not exists executive.verifications (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references executive.research_entries(id) on delete cascade,
  owner_id        uuid references auth.users(id) on delete set null,
  agent_name      text,
  verifier        text not null default 'SIGIL Validity Verifier',
  model           text,
  trust_score     numeric(5,2),
  verdict         text,                   -- source enum UNKNOWN (folded); expected to mirror entry status vocabulary
  dimensions      jsonb not null default '{}'::jsonb,
    -- {source_quality, corroboration, recency, claim_support}
  source_findings jsonb not null default '[]'::jsonb,
    -- [{source_id, title, url, ...}] as produced by the verifier
  created_at      timestamptz not null default now()
);
create index if not exists verifications_entry_idx on executive.verifications (entry_id, created_at desc);

create table if not exists executive.review_schedules (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references executive.research_entries(id) on delete cascade,
  owner_id      uuid references auth.users(id) on delete set null,
  title         text,
  agent_name    text,
  due_date      date not null,
  interval_days integer not null default 7,
  status        text not null default 'scheduled',  -- full source enum UNKNOWN (folded)
  completed_at  timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists review_schedules_entry_idx on executive.review_schedules (entry_id);
create index if not exists review_schedules_due_idx on executive.review_schedules (due_date) where completed_at is null;

-- ---------------------------------------------------------------------------
-- Awards board: categories, criteria, submissions, judgments, change
-- requests, and the sealed certified register. Board data is admin-only
-- except where noted.
-- ---------------------------------------------------------------------------
create table if not exists executive.award_categories (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,
  tagline        text,
  public_summary text,
  private_brief  text,                    -- board-only in the source; member-read here, never anonymous
  cycle          text,
  year           integer,
  status         text not null default 'open'
                 check (status in ('open','judging','closed')),
  total_points   integer not null default 100,
  nominee_types  text[] not null default '{}',
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists executive.judging_criteria (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references executive.award_categories(id) on delete cascade,
  name        text not null,
  max_points  integer not null default 25,
  definition  text,
  anchors     jsonb not null default '[]'::jsonb,  -- [{band, description}]
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists judging_criteria_category_idx on executive.judging_criteria (category_id, sort_order);

create table if not exists executive.submissions (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references executive.award_categories(id) on delete cascade,
  category_name text,                       -- snapshot at nomination time
  nominee_name  text not null,
  nominee_type  text not null default 'platform'
                check (nominee_type in ('platform','business','individual','agent','technology')),
  nominator_name text,
  summary       text,
  evidence      jsonb not null default '[]'::jsonb,  -- [{label, url}]
  status        text not null default 'submitted'
                check (status in ('submitted','screened','judged','awarded','declined')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists submissions_category_idx on executive.submissions (category_id, status);

create table if not exists executive.judgments (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references executive.submissions(id) on delete cascade,
  category_id     uuid references executive.award_categories(id) on delete set null,
  model           text,
  understanding   text,
  assessment      text,
  criteria_scores jsonb not null default '[]'::jsonb,  -- [{criterion_id, ...}]
  total_points    numeric(7,2),
  max_points      numeric(7,2),
  percentage      numeric(5,2),
  recommendation  text check (recommendation in ('award','shortlist','decline')),
  status          text not null default 'draft'
                  check (status in ('draft','approved','overridden')),
  admin_note      text,
  judged_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists judgments_submission_idx on executive.judgments (submission_id, created_at desc);

create table if not exists executive.criteria_change_requests (
  id                  uuid primary key default gen_random_uuid(),
  judgment_id         uuid references executive.judgments(id) on delete set null,
  submission_id       uuid references executive.submissions(id) on delete set null,
  category_id         uuid references executive.award_categories(id) on delete set null,
  criterion_name      text not null,
  current_definition  text,
  proposed_definition text,
  purpose             text,
  intent              text,
  status              text not null default 'pending_review'
                      check (status in ('pending_review','approved','rejected')),
  admin_note          text,
  decided_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists criteria_change_requests_status_idx
  on executive.criteria_change_requests (status, created_at desc);

create table if not exists executive.certified_records (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid references executive.award_categories(id) on delete set null,
  category_name  text,
  award_title    text,
  cycle          text,
  year           integer,
  recipient_name text not null,
  recipient_type text,
  recipient_url  text,
  seal_serial    text unique,
  citation       text,
  trust_statement text,
  report_url     text,
  nominator_name text,
  panel_summary  text,
  status         text not null default 'issued'
                 check (status in ('issued','revoked')),
  issued_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists certified_records_category_idx on executive.certified_records (category_id);

-- ---------------------------------------------------------------------------
-- Row level security + privileges. RLS is enabled on every table; anon
-- gets nothing; authenticated access flows only through these policies
-- (PostgreSQL requires the table privilege AND a matching policy).
-- ---------------------------------------------------------------------------
do $do$
declare t text;
begin
  foreach t in array array['research_entries','research_sources','verifications','review_schedules',
                           'award_categories','judging_criteria','submissions','judgments',
                           'criteria_change_requests','certified_records']
  loop
    execute format('alter table executive.%I enable row level security', t);
    execute format('revoke all on executive.%I from anon', t);
    execute format('grant select, insert, update, delete on executive.%I to authenticated', t);
    execute format('grant all on executive.%I to service_role', t);
  end loop;
end $do$;

-- Owner-or-admin tables (research vault).
create policy entries_read on executive.research_entries for select to authenticated
  using ((select public.executive_can('read')));
create policy entries_insert on executive.research_entries for insert to authenticated
  with check ((select public.executive_can('write')) and owner_id = (select auth.uid()));
create policy entries_update on executive.research_entries for update to authenticated
  using ((select public.executive_can('manage')) or (owner_id = (select auth.uid()) and (select public.executive_can('write'))))
  with check ((select public.executive_can('manage')) or (owner_id = (select auth.uid()) and (select public.executive_can('write'))));
create policy entries_delete on executive.research_entries for delete to authenticated
  using ((select public.executive_can('manage')) or (owner_id = (select auth.uid()) and (select public.executive_can('write'))));

create policy sources_read on executive.research_sources for select to authenticated
  using ((select public.executive_can('read')));
create policy sources_insert on executive.research_sources for insert to authenticated
  with check ((select public.executive_can('write')) and owner_id = (select auth.uid()));
create policy sources_update on executive.research_sources for update to authenticated
  using ((select public.executive_can('manage')) or (owner_id = (select auth.uid()) and (select public.executive_can('write'))))
  with check ((select public.executive_can('manage')) or (owner_id = (select auth.uid()) and (select public.executive_can('write'))));
create policy sources_delete on executive.research_sources for delete to authenticated
  using ((select public.executive_can('manage')) or (owner_id = (select auth.uid()) and (select public.executive_can('write'))));

create policy verifications_read on executive.verifications for select to authenticated
  using ((select public.executive_can('read')));
create policy verifications_insert on executive.verifications for insert to authenticated
  with check ((select public.executive_can('write')) and owner_id = (select auth.uid()));
create policy verifications_update on executive.verifications for update to authenticated
  using ((select public.executive_can('manage')) or (owner_id = (select auth.uid()) and (select public.executive_can('write'))))
  with check ((select public.executive_can('manage')) or (owner_id = (select auth.uid()) and (select public.executive_can('write'))));
create policy verifications_delete on executive.verifications for delete to authenticated
  using ((select public.executive_can('manage')) or (owner_id = (select auth.uid()) and (select public.executive_can('write'))));

create policy schedules_read on executive.review_schedules for select to authenticated
  using ((select public.executive_can('read')));
create policy schedules_insert on executive.review_schedules for insert to authenticated
  with check ((select public.executive_can('write')) and owner_id = (select auth.uid()));
create policy schedules_update on executive.review_schedules for update to authenticated
  using ((select public.executive_can('manage')) or (owner_id = (select auth.uid()) and (select public.executive_can('write'))))
  with check ((select public.executive_can('manage')) or (owner_id = (select auth.uid()) and (select public.executive_can('write'))));
create policy schedules_delete on executive.review_schedules for delete to authenticated
  using ((select public.executive_can('manage')) or (owner_id = (select auth.uid()) and (select public.executive_can('write'))));

-- Award categories and certified register: member read, admin write.
create policy categories_read on executive.award_categories for select to authenticated
  using ((select public.executive_can('read')));
create policy categories_insert on executive.award_categories for insert to authenticated
  with check ((select public.executive_can('manage')));
create policy categories_update on executive.award_categories for update to authenticated
  using ((select public.executive_can('manage'))) with check ((select public.executive_can('manage')));
create policy categories_delete on executive.award_categories for delete to authenticated
  using ((select public.executive_can('manage')));

create policy certified_read on executive.certified_records for select to authenticated
  using ((select public.executive_can('read')));
create policy certified_insert on executive.certified_records for insert to authenticated
  with check ((select public.executive_can('manage')));
create policy certified_update on executive.certified_records for update to authenticated
  using ((select public.executive_can('manage'))) with check ((select public.executive_can('manage')));
create policy certified_delete on executive.certified_records for delete to authenticated
  using ((select public.executive_can('manage')));

-- Submissions: members read and nominate; the board controls the lifecycle.
create policy submissions_read on executive.submissions for select to authenticated
  using ((select public.executive_can('read')));
create policy submissions_insert on executive.submissions for insert to authenticated
  with check ((select public.executive_can('write')));
create policy submissions_update on executive.submissions for update to authenticated
  using ((select public.executive_can('manage'))) with check ((select public.executive_can('manage')));
create policy submissions_delete on executive.submissions for delete to authenticated
  using ((select public.executive_can('manage')));

-- Board-only tables: every operation, reads included, requires 'manage'.
create policy criteria_all on executive.judging_criteria for all to authenticated
  using ((select public.executive_can('manage'))) with check ((select public.executive_can('manage')));
create policy judgments_all on executive.judgments for all to authenticated
  using ((select public.executive_can('manage'))) with check ((select public.executive_can('manage')));
create policy change_requests_all on executive.criteria_change_requests for all to authenticated
  using ((select public.executive_can('manage'))) with check ((select public.executive_can('manage')));

insert into executive.audit_log (actor, action, target, target_type, target_id, result, detail)
values ('executive-agent-muse', 'apply_migration', 'supabase:bimmfmydbmooarobilsq/veritas nexus domain', 'database', 'bimmfmydbmooarobilsq', 'ok',
        jsonb_build_object('migration', '20261127_veritas_nexus_domain',
                           'tables_created', 10,
                           'board_only_tables', jsonb_build_array('judging_criteria','judgments','criteria_change_requests')));

commit;
