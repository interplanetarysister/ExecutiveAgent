-- Register Michelle Rogers — Executive Agent in the agent registry, and
-- harden the knowledge-entry dedupe contract.
-- Project: bimmfmydbmooarobilsq (ExecutiveAgent only, never the iFund
-- database). Source-only: NOT applied to the live project. Apply only as
-- part of the activation runbook in
-- executiveagent/docs/AGENT_KNOWLEDGE_ENTRY.md.
--
-- Two changes:
--   1. A partial unique index on public.executive_research(source_url),
--      mirroring the recording contract's sources_url_key precedent, so
--      the POST /v1/agent/knowledge dedupe-by-source_url rule is backed
--      by the database and not only by the Worker's read-then-write.
--      PRE-CHECK before applying live: existing duplicate source_urls
--      would make index creation fail. Find them with:
--        select source_url, count(*) from public.executive_research
--         where source_url is not null
--         group by source_url having count(*) > 1;
--      Resolve any duplicates first (keep the newest row per URL).
--   2. The agent's own registry row. It carries NO key material:
--      api_key_hash / api_key_hint stay NULL here and are set at
--      activation time, out of band, per the runbook. Until then the row
--      cannot authenticate (a NULL hash matches nothing), which is the
--      safe default.

begin;

create unique index if not exists executive_research_source_url_key
  on public.executive_research (source_url)
  where source_url is not null;

insert into executive.agents
  (name, role, host, workspace, status, category, purpose, runtime,
   description, capabilities, notes)
values (
  'Michelle Rogers — Executive Agent',
  'executive',
  'cloudflare',
  'ExecutiveAgent',
  'active',
  'executive',
  'Executive Agent for the owner: researches topics on request and files the findings into the executive knowledge base autonomously (POST /v1/agent/knowledge, POST /v1/agent/research), under the standing brief in executiveagent/docs/AGENT_KNOWLEDGE_ENTRY.md.',
  'cloudflare-workers',
  'Michelle Rogers, Executive Agent — autonomous research and knowledge filing for the executive office.',
  '{"knowledge_entry": true, "research_submission": true}'::jsonb,
  'api_key_hash is set at activation time, out of band — see the Activation runbook in executiveagent/docs/AGENT_KNOWLEDGE_ENTRY.md. No key material is ever stored in this repository; only the SHA-256 hash + hint live in this table.'
)
on conflict (name, host) do nothing;

insert into executive.audit_log (actor, action, target, target_type, target_id, result, detail)
values ('executive-agent-muse', 'register_agent', 'supabase:bimmfmydbmooarobilsq/executive.agents', 'database', 'bimmfmydbmooarobilsq', 'ok',
        jsonb_build_object('migration', '20261128_register_michelle_rogers_agent',
                           'agent', 'Michelle Rogers — Executive Agent',
                           'api_key_material', 'none — hash set at activation, out of band',
                           'index_added', 'executive_research_source_url_key (partial unique on source_url)'));

commit;
