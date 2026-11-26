-- Align Base44's executive schema with verified Supabase Auth memberships.
-- Applied to dedicated ExecutiveAgent project bimmfmydbmooarobilsq on 2026-11-26.
-- Requires public.executive_can(text) and public.executive_memberships,
-- as defined in 20261126_executive_foundation.sql.
-- Existing service_all write policies remain untouched.
do $do$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname='executive' loop
    execute format('drop policy if exists owner_read on executive.%I', t.tablename);
    execute format(
      'create policy owner_read on executive.%I for select to authenticated using ((select public.executive_can(''read'')))',
      t.tablename
    );
  end loop;
end $do$;
