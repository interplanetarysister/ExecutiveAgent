# Agent Knowledge Entry — Standing Brief & Activation Runbook

**Who this is for:** Michelle Rogers — Executive Agent (the agent registered
in `executive.agents` by `supabase/migrations/20261128_register_michelle_rogers_agent.sql`).

**What it is:** the standing brief under which the Executive Agent files
researched knowledge into the executive database **herself, end-to-end,
with no human in the loop** — plus the activation runbook that turns the
capability on in production.

Status: **source-only.** The endpoint, the registry seed, and this brief
are in the repository. Nothing is live until the Activation Runbook at
the bottom is executed in a dashboard session with the owner's go-ahead.

---

## 1. The standing brief

### When to file

File a knowledge entry **after every research task** — a course sweep, a
funder scan, a market check, a document review — whenever the research
produced a finding worth re-using later. One entry per finding (per
source). Do not batch unrelated findings into one entry, and do not file
the same source twice: the endpoint deduplicates (see §3).

File also when a conversation produces a durable conclusion the office
will need again (a verified fact, a decision-grade summary). Chat that
produced nothing durable is not filed.

### The endpoint

```
POST /v1/agent/knowledge
Host: the executive-agent-research Worker (executive account only)
Authorization: Bearer <the agent's own key>
Content-Type: application/json
```

Authentication is the agent registry ladder, identical to
`POST /v1/agent/research`: the key's SHA-256 hash is matched against
`executive.agents.api_key_hash`. Unknown key → `401`; a paused or
revoked agent → `403`; if the Worker has no service credential
configured → `503`. Only `active` agents may file.

### The payload

```json
{
  "department": "technology",
  "topic": "open-courseware",
  "title": "MIT OCW 6.100L — Introduction to CS and Programming using Python",
  "summary": "MIT OpenCourseWare publishes the full course free: lectures, problem sets, exams.",
  "source_url": "https://ocw.mit.edu/courses/6-100l",
  "source_name": "MIT OpenCourseWare",
  "verification": "source-checked"
}
```

| Field | Required | Rules |
|---|---|---|
| `department` | yes | The office area the finding belongs to (e.g. `leadership`, `finance`, `law`, `psychology`, `marketing`, `communications`, `technology`, `ifund`, `relationships`). ≤ 100 chars. |
| `topic` | yes | A short slug-like topic within the department. ≤ 200 chars. |
| `title` | yes | The finding's title — name the thing, not the search that found it. ≤ 300 chars. |
| `summary` | yes | What the finding says, in the agent's own words — the claim a later reader will rely on. ≤ 5000 chars. |
| `source_url` | no | The exact page the finding rests on. Must be `http(s)`. Omit only for findings with no web source (internal notes, conversation conclusions). |
| `source_name` | no | The source's publisher / display name. ≤ 300 chars. |
| `verification` | no | `"unverified"` (default) or `"source-checked"`. See the honesty rule below. |

Whole payload ≤ 64 KiB. Validation failures return `400` with the reason;
an over-limit payload returns `413`; non-POST returns `405`.

### The verification honesty rule — non-negotiable

- Claim `"source-checked"` **only** when the source at `source_url` was
  actually opened and read during this task, and the summary reflects
  what it says.
- A finding is recorded as verified **only** when the payload claims
  `source-checked` **and** carries a `source_url`. A `source-checked`
  claim with no URL is downgraded to unverified by the endpoint itself —
  there is nothing to check against, so nothing is verified.
- Everything else is filed unverified (`knowledge.verification =
  'reported'`, `executive_research.verified = false`). **Unverified is
  the default and is not a failure** — it is an honest label a later
  verification pass can upgrade.
- Never file second-hand claims as source-checked: if the finding came
  from a search snippet, another agent's summary, or memory, it is
  `unverified` until the source itself has been read.

### What a filing writes

One `POST` produces, in the recording contract's shapes:

1. `executive.sources` — the source row, **deduplicated by URL**
   (re-filing a known URL reuses the existing source).
2. `executive.knowledge` — the finding, linked to its source,
   `verification` = `verified` or `reported` per the honesty rule.
3. `public.executive_research` — the artifact row (`kind` = `source`
   when a URL is present, else `reference`), **deduplicated by
   `source_url`**: re-filing the same URL refreshes the existing row's
   title/summary/verified state instead of creating a duplicate, and
   the response reports `deduped: true`. Filings without a URL have no
   dedupe key and always create a row.
4. `executive.audit_log` — an audit row (`actor` = the agent's registry
   name, `action` = `record_finding`).
5. The agent's `submission_count` / `last_submission_at` are updated.

Success response (`201`):

```json
{
  "knowledge_id": "…", "research_id": "…",
  "deduped": false, "verified": true, "verification": "verified",
  "agent": "Michelle Rogers — Executive Agent", "submission_count": 7
}
```

`verified` / `verification` in the response are the **effective** state
after the honesty rule — if they come back lower than claimed, the
filing was downgraded; do not re-file to argue with it.

### Filing discipline

- **Ground every identifier.** Titles, course codes, URLs, amounts and
  dates come from the source in front of you, never from memory or
  plausibility. If a detail was not verified, it does not go in the
  summary as fact.
- **Summaries are claims.** Write them so a later reader (or the
  verifier) can check them against the source: what it is, who
  publishes it, what it covers, on what terms.
- **One source per entry.** A finding resting on three pages is three
  entries (or one entry on the strongest source, with the others filed
  as their own findings).
- **Free-tier only.** Research uses public sources and the free stack;
  never a paid database or a paywalled full text obtained by bypass.

---

## 2. Activation runbook (future dashboard session — do not improvise)

Everything below happens **only** with the owner's explicit go-ahead, in
a browser session signed into the owner's accounts. No step is to be
attempted from chat, and no secret value is ever typed into chat, a
commit, or a log.

1. **Apply the seed migration.** In the Supabase dashboard for project
   `bimmfmydbmooarobilsq` (SQL Editor), first run the duplicate-URL
   pre-check from the migration header
   (`supabase/migrations/20261128_register_michelle_rogers_agent.sql`);
   resolve any duplicates (keep the newest row per URL). Then run the
   migration file itself. Verify: the `Michelle Rogers — Executive
   Agent` row exists in `executive.agents` with `api_key_hash` NULL.
2. **Deploy the Worker code from `main`.** In the Cloudflare dashboard
   for the **executive** account (`ab53799fa1a2189dd6aee605504c9fa4` —
   never the iFund account), update Worker `executive-agent-research`
   with the code from `cloudflare/executive-agent-research.mjs` on
   `main` (the nested copy is byte-identical; `wrangler` ships the
   nested one). Confirm the `SUPABASE_SERVICE_ROLE_KEY` secret and the
   `AI` binding are present (both were set for Phase 2).
3. **Mint the agent's key.** Generate a fresh random key (≥ 32 bytes of
   entropy, e.g. a password manager's generator). Compute its SHA-256
   hex digest locally.
4. **Set the hash in the database** (SQL Editor, executive project):
   ```sql
   update executive.agents
      set api_key_hash = '<sha256 hex of the key>',
          api_key_hint = '<last 4 characters of the key>'
    where name = 'Michelle Rogers — Executive Agent'
      and host = 'cloudflare';
   ```
5. **Store the plaintext key in the Secure Vault** under a label naming
   this agent and endpoint (e.g. "Michelle Rogers — Executive Agent —
   /v1/agent/knowledge key"). The vault copy is the only plaintext copy;
   the database holds only the hash + hint.
6. **Smoke-test the path.** File the relationship-retention guide as
   the first entry: `POST /v1/agent/knowledge` with the payload in
   `executiveagent/docs/relationship-retention-knowledge-payload.json`
   and the vault key as the bearer token. Expect `201` with
   `verification: "reported"` (the payload is filed unverified by
   design). Confirm the rows in the console's Knowledge tab.
7. **Record activation** in the console (an `executive.integrations`
   note or a knowledge entry under department `leadership`, topic
   `agent-activation`) with the date and the key hint — never the key.

### Rotation / revocation

- Rotate: repeat steps 3–5 (the new hash overwrites the old; the old
  key stops working immediately).
- Revoke: set the agent's `status` to `revoked` (filing routes refuse
  with `403`) and/or clear `api_key_hash`. Pausing (`status = 'paused'`)
  suspends filing without deleting history.
