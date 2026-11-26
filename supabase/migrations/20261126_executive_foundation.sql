-- ExecutiveAgent baseline, captured 2026-11-26 from deployed Supabase schema.
-- Deploy to the dedicated ExecutiveAgent project only (never the iFund database).
create table if not exists public.executive_memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','researcher','viewer')),
 active boolean not null default true,
 granted_at timestamptz not null default now()
);
create or replace function public.executive_can(p_action text default 'read')
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from public.executive_memberships m
 where m.user_id=(select auth.uid()) and m.active
 and (case when p_action='manage' then m.role in ('owner','admin')
           when p_action='write' then m.role in ('owner','admin','researcher')
           else m.role in ('owner','admin','researcher','viewer') end))
$$;
revoke all on function public.executive_can(text) from public;
grant execute on function public.executive_can(text) to authenticated;
create table if not exists public.executive_research (
 id uuid primary key default gen_random_uuid(), title text not null,
 kind text not null default 'source' check(kind in ('source','analysis','document','curriculum','reference')),
 source_url text, source_published_at timestamptz, retrieved_at timestamptz,
 storage_key text unique,summary text,content_sha256 text,
 verified boolean not null default false,provenance jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.executive_opportunities (
 id uuid primary key default gen_random_uuid(),title text not null,
 category text not null check(category in ('grant','investment','sponsorship','partnership','other')),
 organization text,source_url text,eligibility text,deadline_at timestamptz,
 status text not null default 'researching' check(status in
 ('researching','qualified','preparing','submitted','follow_up','committed','funded','rejected','expired')),
 amount_estimate numeric(18,2) check(amount_estimate is null or amount_estimate>=0),
 amount_verified numeric(18,2) check(amount_verified is null or amount_verified>=0),
 currency char(3) not null default 'USD',last_checked_at timestamptz,notes text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.executive_skills (
 id uuid primary key default gen_random_uuid(),slug text not null unique,title text not null,
 version text not null default '1.0.0',description text,storage_key text,
 config jsonb not null default '{}'::jsonb,enabled boolean not null default false,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.executive_audit_events (
 id bigint generated always as identity primary key,actor_id uuid references auth.users(id),
 action text not null,target_type text not null,target_id text,
 details jsonb not null default '{}'::jsonb,occurred_at timestamptz not null default now());
create index if not exists executive_research_kind_idx on public.executive_research(kind,updated_at desc);
create index if not exists executive_opportunities_deadline_idx on public.executive_opportunities(deadline_at);
create index if not exists executive_opportunities_status_idx on public.executive_opportunities(status);
create index if not exists executive_audit_occurred_idx on public.executive_audit_events(occurred_at desc);
alter table public.executive_memberships enable row level security;
alter table public.executive_research enable row level security;
alter table public.executive_opportunities enable row level security;
alter table public.executive_skills enable row level security;
alter table public.executive_audit_events enable row level security;
create policy membership_read on public.executive_memberships for select to authenticated
 using (user_id=(select auth.uid()) or (select public.executive_can('manage')));
create policy membership_manage on public.executive_memberships for all to authenticated
 using ((select public.executive_can('manage'))) with check ((select public.executive_can('manage')));
create policy research_read on public.executive_research for select to authenticated using ((select public.executive_can('read')));
create policy research_write on public.executive_research for insert to authenticated
 with check ((select public.executive_can('write')) and created_by=(select auth.uid()));
create policy research_edit on public.executive_research for update to authenticated
 using ((select public.executive_can('write'))) with check ((select public.executive_can('write')));
create policy research_delete on public.executive_research for delete to authenticated using ((select public.executive_can('manage')));
create policy opportunities_read on public.executive_opportunities for select to authenticated using ((select public.executive_can('read')));
create policy opportunities_write on public.executive_opportunities for insert to authenticated
 with check ((select public.executive_can('write')) and created_by=(select auth.uid()));
create policy opportunities_edit on public.executive_opportunities for update to authenticated
 using ((select public.executive_can('write'))) with check ((select public.executive_can('write')));
create policy opportunities_delete on public.executive_opportunities for delete to authenticated using ((select public.executive_can('manage')));
create policy skills_read on public.executive_skills for select to authenticated using ((select public.executive_can('read')));
create policy skills_write on public.executive_skills for insert to authenticated
 with check ((select public.executive_can('manage')) and created_by=(select auth.uid()));
create policy skills_edit on public.executive_skills for update to authenticated
 using ((select public.executive_can('manage'))) with check ((select public.executive_can('manage')));
create policy skills_delete on public.executive_skills for delete to authenticated using ((select public.executive_can('manage')));
create policy audit_read on public.executive_audit_events for select to authenticated using ((select public.executive_can('manage')));
revoke insert,update,delete on public.executive_audit_events from anon,authenticated;
-- Owner membership bootstrap is deployed separately in the private database,
-- conditioned on Supabase verified email identity and an owner-only allowlist.
-- Do not put owner addresses or API secrets in this public repository.
