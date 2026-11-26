-- Michelle Rogers Executive: core intelligence schema
-- Project: bimmfmydbmooarobilsq (ExecutiveAgent, NOT InterplanetaryFund)
-- Applied: 2026-11-26
-- Supersedes: supabase/migrations/20231123_init.sql (never applied; invalid DDL, see docs/EXECUTIVE_STATE_20261126.md)
-- Design rules: verified facts are separable from projections; nothing counts as funding until funds are cleared.

create schema if not exists executive;
comment on schema executive is 'Michelle Rogers Executive intelligence system (shared organizational memory).';

-- ---------------------------------------------------------------------------
-- Agents: every cooperating executive agent, wherever it is hosted.
-- ---------------------------------------------------------------------------
create table if not exists executive.agents (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  role          text not null default 'executive',
  host          text not null default 'unknown',   -- base44 | cloudflare | local | other
  workspace     text,
  status        text not null default 'active',    -- active | paused | retired
  capabilities  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (name, host)
);

-- ---------------------------------------------------------------------------
-- Tasks: shared work queue so cooperating agents do not duplicate or collide.
-- ---------------------------------------------------------------------------
create table if not exists executive.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  detail        text,
  owner_agent   text,
  status        text not null default 'open',      -- open | in_progress | blocked | done | cancelled
  priority      smallint not null default 3,       -- 1 highest
  blocked_on    text,
  due_at        timestamptz,
  parent_id     uuid references executive.tasks(id) on delete set null,
  evidence      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists tasks_status_idx on executive.tasks (status, priority);

-- ---------------------------------------------------------------------------
-- Knowledge: sources and the entries derived from them.
-- ---------------------------------------------------------------------------
create table if not exists executive.sources (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  url           text,
  publisher     text,
  published_at  date,
  accessed_at   date not null default current_date,
  source_type   text not null default 'web',       -- academic | government | vendor | web | internal | manual
  reliability   text not null default 'unrated',   -- high | medium | low | unrated
  notes         text,
  unique (url)
);

create table if not exists executive.knowledge (
  id            uuid primary key default gen_random_uuid(),
  department    text not null,                     -- leadership | finance | law | psychology | communications | technology | ifund
  topic         text not null,
  title         text not null,
  summary       text not null,
  body          text,
  source_id     uuid references executive.sources(id) on delete set null,
  verification  text not null default 'reported',  -- verified | reported | projected | planned
  confidence    smallint check (confidence between 0 and 100),
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists knowledge_dept_idx on executive.knowledge (department, topic);

-- ---------------------------------------------------------------------------
-- Decisions: executive decision history with rationale.
-- ---------------------------------------------------------------------------
create table if not exists executive.decisions (
  id            uuid primary key default gen_random_uuid(),
  decision      text not null,
  rationale     text,
  decided_by    text not null default 'owner',
  decided_at    timestamptz not null default now(),
  status        text not null default 'active',    -- active | superseded | reversed
  reversible    boolean not null default true,
  superseded_by uuid references executive.decisions(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Relationships: organizations and people.
-- ---------------------------------------------------------------------------
create table if not exists executive.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  org_type      text,                              -- investor | vc | foundation | government | corporate | accelerator | partner
  website       text,
  location      text,
  focus         text,
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists executive.people (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  title             text,
  organization_id   uuid references executive.organizations(id) on delete set null,
  email             text,
  linkedin_url      text,
  relationship_stage text not null default 'identified', -- identified | researched | contacted | engaged | meeting | committed | dormant
  last_contact_at   timestamptz,
  notes             text,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Funding: opportunities, then commitments. Only cleared funds count toward the objective.
-- ---------------------------------------------------------------------------
create table if not exists executive.funding_opportunities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  funder        text,
  organization_id uuid references executive.organizations(id) on delete set null,
  funding_type  text not null,                     -- equity | grant | sponsorship | strategic | debt | prize | credits
  amount_min    numeric(14,2),
  amount_max    numeric(14,2),
  currency      text not null default 'USD',
  deadline      date,
  status        text not null default 'discovered',-- discovered | qualifying | preparing | applied | declined | awarded | closed | expired
  eligibility   text,
  url           text,
  contact       text,
  next_action   text,
  verified_at   timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists funding_status_idx on executive.funding_opportunities (status, deadline);

create table if not exists executive.funding_commitments (
  id                  uuid primary key default gen_random_uuid(),
  opportunity_id      uuid references executive.funding_opportunities(id) on delete set null,
  counterparty        text not null,
  stage               text not null default 'interest',
  -- interest | applied | verbal | term_sheet | signed | funds_cleared | withdrawn
  amount              numeric(14,2) not null,
  currency            text not null default 'USD',
  funds_cleared       boolean not null default false,
  cleared_at          date,
  evidence            text,
  created_at          timestamptz not null default now(),
  constraint cleared_needs_date check (not funds_cleared or cleared_at is not null)
);

-- The single number that matters: verified, received capital.
create or replace view executive.funding_received as
  select coalesce(sum(amount), 0)::numeric(14,2) as verified_received_usd
  from executive.funding_commitments
  where funds_cleared and currency = 'USD';

create or replace view executive.funding_pipeline as
  select stage, count(*) as commitments, coalesce(sum(amount),0)::numeric(14,2) as total_amount
  from executive.funding_commitments
  where not funds_cleared
  group by stage;

-- ---------------------------------------------------------------------------
-- Communications: record of correspondence tied to people.
-- ---------------------------------------------------------------------------
create table if not exists executive.communications (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid references executive.people(id) on delete set null,
  channel       text not null,                     -- email | linkedin | phone | meeting | other
  direction     text not null,                     -- outbound | inbound
  subject       text,
  summary       text,
  external_id   text,
  occurred_at   timestamptz not null default now(),
  unique (channel, external_id)
);

-- ---------------------------------------------------------------------------
-- Capability and access inventory: what exists, where, and whether it is proven.
-- ---------------------------------------------------------------------------
create table if not exists executive.capabilities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null,                     -- skill | tool | integration | workflow | service
  location      text,                              -- repo path, url, account
  status        text not null default 'planned',   -- verified | partial | planned | broken
  evidence      text,
  notes         text,
  updated_at    timestamptz not null default now(),
  unique (name, category)
);

create table if not exists executive.integrations (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null,
  account_email text,
  account_ref   text,                              -- project ref, account id, repo
  environment   text not null default 'executive', -- executive | ifund | other
  status        text not null default 'unverified',-- connected | unverified | unavailable | error
  scopes        text,
  verified_at   timestamptz,
  notes         text,
  unique (platform, account_ref)
);

-- ---------------------------------------------------------------------------
-- Training records and audit trail.
-- ---------------------------------------------------------------------------
create table if not exists executive.training (
  id            uuid primary key default gen_random_uuid(),
  agent         text not null,
  department    text not null,
  topic         text not null,
  method        text,
  outcome       text,
  completed_at  timestamptz not null default now()
);

create table if not exists executive.audit_log (
  id            bigserial primary key,
  actor         text not null,
  action        text not null,
  target        text,
  result        text not null default 'ok',        -- ok | failed | partial
  detail        jsonb not null default '{}'::jsonb,
  at            timestamptz not null default now()
);
create index if not exists audit_at_idx on executive.audit_log (at desc);

-- ---------------------------------------------------------------------------
-- Owner allowlist for authenticated access (no owner is enrolled yet).
-- ---------------------------------------------------------------------------
create table if not exists executive.owner_emails (
  email         text primary key,
  note          text,
  added_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security: service role full access; authenticated owner read access.
-- No anonymous access anywhere.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'executive'
  loop
    execute format('alter table executive.%I enable row level security', t);
    execute format('revoke all on executive.%I from anon', t);
    execute format('grant all on executive.%I to service_role', t);
    execute format('grant select on executive.%I to authenticated', t);
    execute format('drop policy if exists owner_read on executive.%I', t);
    execute format($f$create policy owner_read on executive.%I for select to authenticated
      using (exists (select 1 from executive.owner_emails o
                     where lower(o.email) = lower(coalesce(auth.jwt() ->> 'email',''))))$f$, t);
    execute format('drop policy if exists service_all on executive.%I', t);
    execute format('create policy service_all on executive.%I for all to service_role using (true) with check (true)', t);
  end loop;
end $$;

-- Views inherit RLS from their tables; restrict execution to authenticated and service_role.
revoke all on executive.funding_received from anon;
revoke all on executive.funding_pipeline from anon;
grant select on executive.funding_received to authenticated, service_role;
grant select on executive.funding_pipeline to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Baseline records: the verified infrastructure map as of 2026-11-26.
-- ---------------------------------------------------------------------------
insert into executive.agents (name, role, host, workspace, status)
values ('Michelle Rogers (Base44)', 'executive', 'base44', 'Jeans', 'active')
on conflict (name, host) do nothing;

insert into executive.integrations (platform, account_email, account_ref, environment, status, scopes, verified_at, notes) values
  ('supabase', 'interplanetarysister@gmail.com', 'bimmfmydbmooarobilsq', 'executive', 'connected', 'database:read,database:write,rest:read,rest:write', now(), 'ExecutiveAgent project, empty before this migration'),
  ('github', 'interplanetarysister', 'interplanetarysister/ExecutiveAgent', 'executive', 'connected', 'repo,read:org,workflow', now(), 'Admin/push confirmed via API'),
  ('cloudflare', 'interplanetarysister@gmail.com', 'ab53799fa1a2189dd6aee605504c9fa4', 'executive', 'unverified', null, null, 'No API token stored; Worker and R2 inventory unverified'),
  ('cloudflare', 'interplanetarysister@gmail.com', 'c95db4f2c901f32776471b85f1eda15d', 'ifund', 'unverified', null, null, 'iFund production account; do not deploy executive assets here')
on conflict (platform, account_ref) do nothing;

insert into executive.audit_log (actor, action, target, result, detail) values
  ('michelle-rogers-base44', 'apply_migration', 'supabase:bimmfmydbmooarobilsq/executive core schema', 'ok',
   jsonb_build_object('migration', '20261126_executive_core', 'tables_created', 13));
