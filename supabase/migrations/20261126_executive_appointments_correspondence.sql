-- Executive appointments and company-linked correspondence (2026-11-26).
-- Canonical project: bimmfmydbmooarobilsq. Changes already applied directly
-- because this project's Supabase migration endpoint returns 42P10 even for SELECT 1.
alter table executive.communications
  add column if not exists organization_id uuid
    references executive.organizations(id) on delete set null;
create index if not exists executive_communications_person_time_idx
  on executive.communications(person_id,occurred_at desc);
create index if not exists executive_communications_org_time_idx
  on executive.communications(organization_id,occurred_at desc);

create table if not exists executive.appointments (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(trim(title)) between 1 and 250),
  person_id uuid references executive.people(id) on delete set null,
  organization_id uuid references executive.organizations(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  meeting_link text,
  agenda text,
  notes text,
  status text not null default 'scheduled'
    check(status in ('scheduled','completed','cancelled','rescheduled')),
  outcome text,
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_end_after_start check(ends_at is null or ends_at > starts_at)
);
create index if not exists executive_appointments_person_time_idx
  on executive.appointments(person_id,starts_at desc);
create index if not exists executive_appointments_org_time_idx
  on executive.appointments(organization_id,starts_at desc);
create index if not exists executive_appointments_upcoming_idx
  on executive.appointments(starts_at) where status='scheduled';
alter table executive.appointments enable row level security;
revoke all on executive.appointments from public,anon;
grant select,insert,update,delete on executive.appointments to authenticated;
drop policy if exists appointments_member_read on executive.appointments;
create policy appointments_member_read on executive.appointments
  for select to authenticated using ((select public.executive_can('read')));
drop policy if exists appointments_member_insert on executive.appointments;
create policy appointments_member_insert on executive.appointments
  for insert to authenticated with check ((select public.executive_can('write')));
drop policy if exists appointments_member_update on executive.appointments;
create policy appointments_member_update on executive.appointments
  for update to authenticated using ((select public.executive_can('write')))
  with check ((select public.executive_can('write')));
drop policy if exists appointments_member_delete on executive.appointments;
create policy appointments_member_delete on executive.appointments
  for delete to authenticated using ((select public.executive_can('manage')));
