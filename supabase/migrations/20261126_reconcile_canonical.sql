-- ExecutiveAgent reconciliation: one canonical home per domain.
-- Project: bimmfmydbmooarobilsq (ExecutiveAgent only, never the iFund database).
-- Applied: 2026-11-26. Author: Base44 Superagent.
--
-- Canonical map after this migration:
--   authorization / members ....... public.executive_memberships + public.executive_can()
--   raw research artifacts ........ public.executive_research   (storage_key, sha256, provenance)
--   curated knowledge ............. executive.sources + executive.knowledge
--   funding opportunities ......... public.executive_opportunities (RLS write policies)
--   cleared-funds ledger .......... executive.funding_commitments  (the $450,000 metric)
--   deployable skills ............. public.executive_skills
--   capability inventory .......... executive.capabilities
--   member audit .................. executive.audit_log  (public.executive_audit_events is a view)
--   operations .................... executive.agents/tasks/decisions/organizations/people/
--                                   communications/training/integrations
--
-- Pre-checked before applying: every table converted or dropped below had zero rows and no
-- dependent views. executive.funding_pipeline and executive.funding_received depend on
-- executive.funding_commitments, which is preserved unchanged.

begin;

-- 1. Audit: one log. The public table becomes a view over executive.audit_log.
alter table executive.audit_log add column if not exists actor_id uuid;
alter table executive.audit_log add column if not exists target_type text;
alter table executive.audit_log add column if not exists target_id text;
update executive.audit_log set target_id = target where target_id is null;

drop table if exists public.executive_audit_events;

create view public.executive_audit_events
with (security_invoker = true) as
  select id,
         actor_id,
         action,
         coalesce(target_type, 'record') as target_type,
         target_id,
         detail as details,
         at as occurred_at
  from executive.audit_log
  where public.executive_can('manage');  -- preserve the original manage-only audit policy

revoke all on public.executive_audit_events from anon;
grant select on public.executive_audit_events to authenticated, service_role;

-- 2. Funding opportunities: public.executive_opportunities is canonical.
--    executive.funding_opportunities becomes a read-only compatibility view.
alter table executive.funding_commitments drop constraint if exists funding_commitments_opportunity_id_fkey;
drop table if exists executive.funding_opportunities;

create view executive.funding_opportunities
with (security_invoker = true) as
  select o.id,
         o.title              as name,
         o.organization       as funder,
         null::uuid           as organization_id,
         o.category           as funding_type,
         null::numeric(14,2)  as amount_min,
         o.amount_estimate    as amount_max,
         o.currency,
         o.deadline_at::date  as deadline,
         o.status,
         o.eligibility,
         o.source_url         as url,
         null::text           as contact,
         null::text           as next_action,
         case when o.amount_verified is not null then o.last_checked_at end as verified_at,
         o.notes,
         o.created_at,
         o.updated_at
  from public.executive_opportunities o;

comment on view executive.funding_opportunities is
  'Compatibility view over the canonical public.executive_opportunities. Read only. Status values use the canonical vocabulary (researching, qualified, preparing, submitted, follow_up, committed, funded, rejected, expired). Write through public.executive_opportunities.';

revoke all on executive.funding_opportunities from anon;
grant select on executive.funding_opportunities to authenticated, service_role;

alter table executive.funding_commitments
  add constraint funding_commitments_opportunity_id_fkey
  foreign key (opportunity_id) references public.executive_opportunities(id) on delete set null;

-- 3. Authorization: memberships are the only source of truth. The parallel allowlist table
--    is retired (zero rows, no dependents, all policies already use executive_can).
drop table if exists executive.owner_emails;

create or replace view executive.owner_directory
with (security_invoker = false) as
  select m.user_id,
         u.email,
         m.role,
         m.active,
         m.granted_at
  from public.executive_memberships m
  join auth.users u on u.id = m.user_id
  where m.active;

comment on view executive.owner_directory is
  'Effective executive members resolved from public.executive_memberships. Owner and admin emails are the authorized principals.';

revoke all on executive.owner_directory from anon;
grant select on executive.owner_directory to service_role;

-- 4. Defence in depth: anon keeps no table privilege anywhere in this system.
revoke all on public.executive_memberships, public.executive_research,
              public.executive_opportunities, public.executive_skills from anon;

-- 5. Record the reconciliation.
insert into executive.audit_log (actor, action, target, target_type, target_id, result, detail)
values ('michelle-rogers-base44', 'reconcile_schema', 'supabase:bimmfmydbmooarobilsq', 'database', 'bimmfmydbmooarobilsq', 'ok',
        jsonb_build_object('migration', '20261126_reconcile_canonical',
                           'converted_to_views', jsonb_build_array('executive.funding_opportunities', 'public.executive_audit_events'),
                           'dropped', jsonb_build_array('executive.owner_emails'),
                           'canonical_authorization', 'public.executive_memberships'));

commit;
