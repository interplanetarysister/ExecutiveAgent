-- Michelle Rogers Executive | 2026-11-26
-- Deploy to Supabase project bimmfmydbmooarobilsq ONLY.
-- IMPORTANT: The Supabase apply_migration endpoint returned 42P10 even for SELECT 1;
-- this SQL was applied directly with execute_sql and verified separately.
-- Scheduler digest is provisioned/rotated out of band, never committed to Git.
create table if not exists executive.deadline_alerts (
  task_id uuid primary key references executive.tasks(id) on delete cascade,
  severity text not null check (severity in ('upcoming','overdue')),
  due_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists deadline_alerts_active_idx
  on executive.deadline_alerts (severity,due_at) where resolved_at is null;
alter table executive.deadline_alerts enable row level security;
revoke all on executive.deadline_alerts from public,anon,authenticated;
grant select on executive.deadline_alerts to authenticated;
drop policy if exists members_read_deadline_alerts on executive.deadline_alerts;
create policy members_read_deadline_alerts on executive.deadline_alerts
  for select to authenticated using ((select public.executive_can('read')));
create table if not exists executive.scheduler_credentials (
  name text primary key,
  token_digest text not null,
  rotated_at timestamptz not null default now()
);
alter table executive.scheduler_credentials enable row level security;
revoke all on executive.scheduler_credentials from public,anon,authenticated;
create or replace function executive.refresh_deadline_alerts()
returns integer language plpgsql security definer
set search_path=pg_catalog,executive,public
as $fn$
declare touched integer;
begin
  insert into executive.deadline_alerts(task_id,severity,due_at,last_checked_at,resolved_at)
  select t.id,case when t.due_at < now() then 'overdue' else 'upcoming' end,
    t.due_at,now(),null
  from executive.tasks t where t.due_at is not null
    and t.due_at <= now()+interval '72 hours'
    and t.status not in ('done','completed','cancelled','canceled')
  on conflict(task_id) do update set
    severity=excluded.severity,due_at=excluded.due_at,
    last_checked_at=now(),resolved_at=null;
  get diagnostics touched=row_count;
  update executive.deadline_alerts a
     set resolved_at=now(),last_checked_at=now()
   where a.resolved_at is null and not exists (
      select 1 from executive.tasks t where t.id=a.task_id
        and t.due_at is not null and t.due_at<=now()+interval '72 hours'
        and t.status not in ('done','completed','cancelled','canceled'));
  return touched;
end $fn$;
revoke all on function executive.refresh_deadline_alerts() from public,anon,authenticated;
create or replace function public.executive_refresh_due_tasks(token text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,executive,extensions
as $fn$
declare stored text;
declare touched integer;
begin
  select token_digest into stored from executive.scheduler_credentials
   where name='deadline-monitor';
  if stored is null or token is null or
    encode(extensions.digest(convert_to(token,'UTF8'),'sha256'),'hex') <> stored
  then raise exception 'scheduler authentication failed' using errcode='28000'; end if;
  touched := executive.refresh_deadline_alerts();
  return jsonb_build_object('refreshed',touched,'checked_at',now());
end $fn$;
revoke all on function public.executive_refresh_due_tasks(text) from public;
grant execute on function public.executive_refresh_due_tasks(text) to anon;
-- Set executive.scheduler_credentials(name='deadline-monitor',token_digest=SHA256(secret))
-- using a private privileged channel and bind the matching secret to
-- Cloudflare Worker executive-deadline-monitor as EXECUTIVE_SCHEDULER_TOKEN.
