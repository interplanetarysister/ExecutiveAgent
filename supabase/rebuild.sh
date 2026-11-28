#!/usr/bin/env bash
#
# Rebuild the Executive Agent Supabase schema from the migration manifest
# in supabase/MIGRATIONS.md.
#
# SAFETY NOTE: This script is only for a scratch / new project or for
# disaster recovery. Running it against the production project
# (bimmfmydbmooarobilsq) is NOT a no-op: the reconcile migration
# (20261126_reconcile_canonical.sql) drops and recreates objects
# (for example, it drops public.executive_audit_events as a table and
# recreates it as a view, and drops executive.owner_emails).
# Do not run this against production as a routine check.
#
# Usage:
#   DATABASE_URL="postgresql://..." ./supabase/rebuild.sh
#
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL is not set in the environment." >&2
  echo "Set DATABASE_URL to the target database connection string, e.g.:" >&2
  echo '  DATABASE_URL="postgresql://user:password@host:5432/dbname" ./supabase/rebuild.sh' >&2
  exit 1
fi

# This script lives in supabase/; the repository root is its parent.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Ordered manifest — keep in sync with supabase/MIGRATIONS.md.
MIGRATIONS=(
  "executiveagent/supabase/migrations/20261126_executive_core.sql"
  "supabase/migrations/20261126_executive_foundation.sql"
  "supabase/migrations/20261126_align_executive_member_rls.sql"
  "supabase/migrations/20261127_repair_audit_log_target_columns.sql"
  "supabase/migrations/20261126_member_write_policies.sql"
  "supabase/migrations/20261126_grant_member_dml.sql"
  "supabase/migrations/20261126_enable_member_task_writes.sql"
  "supabase/migrations/20261126_reconcile_canonical.sql"
  "supabase/migrations/20261126_executive_appointments_correspondence.sql"
  "supabase/migrations/20261126_executive_deadline_monitor.sql"
  "supabase/migrations/20261126_executive_scheduler_execution_receipts.sql"
  "supabase/migrations/20261126_recording_contract.sql"
  "supabase/migrations/20261127_veritas_agents_registry.sql"
  "supabase/migrations/20261127_veritas_nexus_domain.sql"
)

total="${#MIGRATIONS[@]}"
step=0
for migration in "${MIGRATIONS[@]}"; do
  step=$((step + 1))
  path="$REPO_ROOT/$migration"
  echo "==> Step ${step}/${total}: applying ${migration}"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$path"
done

echo "==> Rebuild complete: ${total} migrations applied in order."
