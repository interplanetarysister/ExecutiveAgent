# Cloudflare — Deploy-Source Pinning

## Canonical source

The canonical Worker source is:

- `cloudflare/executive-agent-research.mjs`

A second copy exists at:

- `executiveagent/src/research-worker.mjs`

**Both copies are preserved by owner directive.** Do not delete either one.

## What a deploy actually ships

The only wrangler config in this repository is
`executiveagent/wrangler.jsonc`, and it sets:

```jsonc
"main": "src/research-worker.mjs"
```

So a wrangler deploy run from `executiveagent/` ships the **nested copy**
(`executiveagent/src/research-worker.mjs`), not the canonical copy in this
directory. Keep that in mind before deploying: editing only the canonical
copy changes nothing in a deploy until the nested copy is synced (see the
sync rule below).

## Account pinning

The `account_id` in `executiveagent/wrangler.jsonc` is the executive
Cloudflare account:

- Executive account: `ab53799fa1a2189dd6aee605504c9fa4`

**Never deploy executive assets to the Interplanetary Fund (iFund)
account:**

- iFund account: `c95db4f2c901f32776471b85f1eda15d`

## Sync rule

1. Edit the canonical copy: `cloudflare/executive-agent-research.mjs`.
2. Copy it byte-for-byte over the nested copy:
   `executiveagent/src/research-worker.mjs`.
3. Verify both copies match before any deploy:

   ```sh
   md5sum cloudflare/executive-agent-research.mjs executiveagent/src/research-worker.mjs
   ```

   The two hashes must be identical.

## Authorization

No deployment without the owner's explicit authorization.

## Phase 2 routes (source-only until deployed)

The Worker also serves the Veritas Nexus feature routes:

| Method + path | Auth | Purpose |
|---|---|---|
| `POST /v1/agent/research` | Agent bearer key (SHA-256 vs `executive.agents.api_key_hash`, active agents only) | Agent research submission: files a pending `research_entries` row plus its `research_sources`, bumps the agent's `submission_count` / `last_submission_at` |
| `POST /v1/verify` | Member JWT (owner/admin, same gate as documents) | Verifier: scores an entry's sources (source_quality, corroboration, recency, claim_support), writes a `verifications` row, updates the entry's trust score/status and per-source `check_status`. Runs under the member's own JWT, so RLS applies |
| `POST /v1/judge` | Member JWT (owner/admin) | Judge: scores a submission against its category's criteria into a draft `judgments` row. A proposed criterion change files a `criteria_change_requests` row — the judge never edits a criterion |
| `POST /v1/chat` | Member JWT (owner/admin) | Chat proxy: a member chats with a chat-configured registry agent; the Worker calls Workers AI with the agent's system prompt, model, temperature, max_tokens, and max_messages history cap |

Verifier and judge use the Workers AI binding when present and fall back
to deterministic heuristics (recorded as model `heuristic-fallback`)
when it is absent or returns unusable output.

## Deploy-time configuration for Phase 2

Set these on the Worker at deploy time. Secret values are entered only
through the Cloudflare dashboard or `wrangler secret put` — never in
this repo, never in chat.

| Name | Kind | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Worker secret | Supabase service-role key for project `bimmfmydbmooarobilsq`. Used ONLY by `POST /v1/agent/research` (agents hold no user JWT). Name in code: `SERVICE_KEY_ENV` in both Worker copies |
| `AI` | Workers AI binding | Declared in `executiveagent/wrangler.jsonc` (`"ai": {"binding": "AI"}`). Free allocation; features degrade to heuristics when unavailable |
| `SUPABASE_PUBLISHABLE_KEY` | Worker secret/var | Already required by the document API; also used as the apikey for member-JWT REST calls |
| `EXECUTIVE_OWNER_EMAILS` | Worker secret/var | Already required; gates the member-JWT routes |

The Phase 1 migrations (`supabase/migrations/20261127_veritas_agents_registry.sql`
and `20261127_veritas_nexus_domain.sql`) must be applied to the live
project before these routes can work; see `supabase/MIGRATIONS.md`.
