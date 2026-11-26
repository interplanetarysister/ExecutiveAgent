-- Grant table-level DML to authenticated members so the RLS policies are the real gate.
-- Applied 2026-11-26 by the Base44 Superagent.
-- Defect: only SELECT was granted on the executive operations tables, so every member_insert /
-- member_update / member_delete policy was unreachable and writes failed with a privilege error
-- instead of passing through row-level security. RLS still decides who may write what.
begin;
do $do$
declare t text;
  tables text[] := array['agents','tasks','knowledge','sources','people','organizations',
                         'communications','capabilities','integrations','training','decisions',
                         'funding_commitments'];
begin
  foreach t in array tables loop
    execute format('grant insert, update, delete on executive.%I to authenticated', t);
  end loop;
end $do$;
insert into executive.audit_log (actor, action, target, target_type, target_id, result, detail)
values ('michelle-rogers-base44','grant_member_dml','executive operations tables','database','bimmfmydbmooarobilsq','ok',
        jsonb_build_object('tables',12,'rationale','RLS policies were unreachable without table DML grants'));
commit;
