-- Repair (verification checklist defect D3, 2026-11-27): the console's Funding
-- section selects next_action from public.executive_opportunities, but the live
-- table was created from 20261126_executive_foundation.sql, whose definition
-- has no next_action column (the nested executiveagent/ core tree defines one;
-- create-table-if-not-exists made the first definition win). The reconcile
-- migration already treats next_action as part of the canonical shape (its
-- compatibility view emits it). Add the column additively; idempotent.
alter table public.executive_opportunities
  add column if not exists next_action text;
