-- Member write policies for the executive operations schema.
-- Applied 2026-11-26 by the Base44 Superagent.
-- The read path already flows through public.executive_can('read'). This migration gives confirmed
-- members the write path the console and the Worker need, with money and governance held to 'manage'.
-- service_all policies from the original migration are untouched.

begin;

do $do$
declare
  t text;
  writable text[] := array['tasks','knowledge','sources','people','organizations','communications',
                           'capabilities','integrations','training','agents'];
  governed text[] := array['decisions','funding_commitments'];
begin
  foreach t in array writable loop
    execute format('drop policy if exists member_insert on executive.%I', t);
    execute format($f$create policy member_insert on executive.%I for insert to authenticated
                    with check ((select public.executive_can('write')))$f$, t);
    execute format('drop policy if exists member_update on executive.%I', t);
    execute format($f$create policy member_update on executive.%I for update to authenticated
                    using ((select public.executive_can('write')))
                    with check ((select public.executive_can('write')))$f$, t);
    execute format('drop policy if exists member_delete on executive.%I', t);
    execute format($f$create policy member_delete on executive.%I for delete to authenticated
                    using ((select public.executive_can('manage')))$f$, t);
  end loop;

  foreach t in array governed loop
    execute format('drop policy if exists member_insert on executive.%I', t);
    execute format($f$create policy member_insert on executive.%I for insert to authenticated
                    with check ((select public.executive_can('manage')))$f$, t);
    execute format('drop policy if exists member_update on executive.%I', t);
    execute format($f$create policy member_update on executive.%I for update to authenticated
                    using ((select public.executive_can('manage')))
                    with check ((select public.executive_can('manage')))$f$, t);
    execute format('drop policy if exists member_delete on executive.%I', t);
    execute format($f$create policy member_delete on executive.%I for delete to authenticated
                    using ((select public.executive_can('manage')))$f$, t);
  end loop;
end $do$;

-- sequences behind identity columns
grant usage, select on all sequences in schema executive to authenticated;

insert into executive.audit_log (actor, action, target, target_type, target_id, result, detail)
values ('michelle-rogers-base44', 'apply_policies', 'executive member write policies', 'database', 'bimmfmydbmooarobilsq', 'ok',
        jsonb_build_object('writable', 10, 'governed', 2));

commit;
