-- Recording contract: one supported path for writing findings into the right records.
-- Applied 2026-11-26 by the Base44 Superagent.
--
-- Every research finding goes through public.executive_record_finding(), which validates the
-- verification state and confidence, deduplicates the source by URL, writes the knowledge entry,
-- and records an audit row in one transaction. Artifacts (mission briefs, digests, curricula) go
-- through public.executive_record_artifact(). This keeps Base44, the console and any other agent
-- writing the same shapes into the same places.

begin;

create unique index if not exists sources_url_key on executive.sources (url) where url is not null;

create or replace function public.executive_record_finding(
  p_title text,
  p_summary text,
  p_body text,
  p_department text default 'general',
  p_topic text default 'general',
  p_verification text default 'reported',
  p_confidence smallint default 60,
  p_tags text[] default '{}',
  p_source_title text default null,
  p_source_url text default null,
  p_source_publisher text default null,
  p_source_published_at date default null,
  p_source_type text default null,
  p_source_reliability text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_source uuid;
  v_know uuid;
  v_actor text;
begin
  if not public.executive_can('write') then
    raise exception 'executive write permission required' using errcode = '42501';
  end if;
  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'title is required' using errcode = '22023';
  end if;
  if p_summary is null or length(btrim(p_summary)) = 0 then
    raise exception 'summary is required' using errcode = '22023';
  end if;
  if p_verification is null or p_verification not in ('verified','reported','projected','planned') then
    raise exception 'verification must be verified, reported, projected or planned' using errcode = '22023';
  end if;
  if p_confidence is null or p_confidence < 0 or p_confidence > 100 then
    raise exception 'confidence must be between 0 and 100' using errcode = '22023';
  end if;

  if p_source_url is not null and length(btrim(p_source_url)) > 0 then
    select id into v_source from executive.sources where url = p_source_url;
    if v_source is null then
      insert into executive.sources (title, url, publisher, published_at, accessed_at, source_type, reliability)
      values (coalesce(nullif(btrim(p_source_title), ''), p_source_url), p_source_url, p_source_publisher,
              p_source_published_at, current_date,
              coalesce(nullif(btrim(p_source_type), ''), 'web'),
              coalesce(nullif(btrim(p_source_reliability), ''), 'unrated'))
      returning id into v_source;
    end if;
  end if;

  insert into executive.knowledge (department, topic, title, summary, body, source_id, verification, confidence, tags)
  values (coalesce(nullif(btrim(p_department), ''), 'general'),
          coalesce(nullif(btrim(p_topic), ''), 'general'),
          p_title, p_summary, p_body, v_source, p_verification, p_confidence, coalesce(p_tags, '{}'))
  returning id into v_know;

  select email into v_actor from executive.owner_directory where user_id = (select auth.uid());

  insert into executive.audit_log (actor, action, target, target_type, target_id, result, detail)
  values (coalesce(v_actor, 'member'), 'record_finding', p_title, 'knowledge', v_know::text, 'ok',
          jsonb_build_object('verification', p_verification, 'confidence', p_confidence, 'source_id', v_source));

  return jsonb_build_object('knowledge_id', v_know, 'source_id', v_source);
end
$fn$;

create or replace function public.executive_record_artifact(
  p_title text,
  p_kind text,
  p_summary text,
  p_verified boolean default false,
  p_provenance jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_id uuid;
  v_actor text;
begin
  if not public.executive_can('write') then
    raise exception 'executive write permission required' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('source','analysis','document','curriculum','reference') then
    raise exception 'kind must be source, analysis, document, curriculum or reference' using errcode = '22023';
  end if;
  insert into public.executive_research (title, kind, summary, verified, provenance, retrieved_at, created_by)
  values (p_title, p_kind, p_summary, coalesce(p_verified, false), coalesce(p_provenance, '{}'::jsonb), now(), (select auth.uid()))
  returning id into v_id;

  select email into v_actor from executive.owner_directory where user_id = (select auth.uid());
  insert into executive.audit_log (actor, action, target, target_type, target_id, result, detail)
  values (coalesce(v_actor, 'member'), 'record_artifact', p_title, 'research', v_id::text, 'ok',
          jsonb_build_object('kind', p_kind, 'verified', coalesce(p_verified, false)));
  return jsonb_build_object('research_id', v_id);
end
$fn$;

revoke all on function public.executive_record_finding(text,text,text,text,text,text,smallint,text[],text,text,text,date,text,text) from public;
revoke all on function public.executive_record_artifact(text,text,text,boolean,jsonb) from public;
grant execute on function public.executive_record_finding(text,text,text,text,text,text,smallint,text[],text,text,text,date,text,text) to authenticated, service_role;
grant execute on function public.executive_record_artifact(text,text,text,boolean,jsonb) to authenticated, service_role;

insert into executive.audit_log (actor, action, target, target_type, target_id, result, detail)
values ('michelle-rogers-base44','recording_contract','executive_record_finding / executive_record_artifact','database','bimmfmydbmooarobilsq','ok',
        jsonb_build_object('dedupe','sources.url unique','validation','verification state and confidence range'));

commit;
