-- ExecutiveAgent database permission repair; applied to dedicated project on 2026-11-26.
-- Existing executive.tasks policies limit writes to active memberships via public.executive_can('write').
-- PostgreSQL requires both table privileges and an RLS policy.
grant insert, update on table executive.tasks to authenticated;
-- No grant to anon; do not grant service-role credentials to browser clients.
