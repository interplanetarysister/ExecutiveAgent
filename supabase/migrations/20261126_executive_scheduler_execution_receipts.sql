-- Michelle Rogers Executive scheduler execution receipts.
-- Applied directly on 2026-11-26; upstream migration recording endpoint was broken.
create table if not exists executive.scheduler_runs (
 id bigint generated always as identity primary key,
 job text not null,
 ran_at timestamptz not null default now(),
 refreshed integer not null check(refreshed>=0)
);
create index if not exists executive_scheduler_runs_recent_idx on executive.scheduler_runs(ran_at desc);
alter table executive.scheduler_runs enable row level security;
revoke all on executive.scheduler_runs from public,anon,authenticated;
grant select on executive.scheduler_runs to authenticated;
drop policy if exists members_read_scheduler_runs on executive.scheduler_runs;
create policy members_read_scheduler_runs on executive.scheduler_runs
 for select to authenticated using ((select public.executive_can('read')));
create or replace function public.executive_refresh_due_tasks(token text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,executive,extensions
as $fn$
declare stored text;
declare touched integer;
begin
 select token_digest into stored from executive.scheduler_credentials where name='deadline-monitor';
 if stored is null or token is null or
  encode(extensions.digest(convert_to(token,'UTF8'),'sha256'),'hex') <> stored
 then raise exception 'scheduler authentication failed' using errcode='28000'; end if;
 touched:=executive.refresh_deadline_alerts();
 insert into executive.scheduler_runs(job,refreshed) values('deadline-monitor',touched);
 return jsonb_build_object('refreshed',touched,'checked_at',now());
end $fn$;
revoke all on function public.executive_refresh_due_tasks(text) from public;
grant execute on function public.executive_refresh_due_tasks(text) to anon;