# Phase A acceptance record, 2026-11-26

Author: Base44 Superagent. Scope: verify the current live system, finish outstanding integration issues,
and record exactly what works. Every line below is something that was executed and observed, or it is
labelled as a hypothesis.

---

## 1. Publication status

- `docs/index.html` on `main` was byte-identical to the served page at
  `https://interplanetarysister.github.io/ExecutiveAgent/` before this session. The earlier concern about a
  stale publication was a stale Pages build record (it reported commit `4e4bb6f4` while serving the
  `b296bd9d` content). **No publication gap existed.**
- After this session's rebuild, the Pages build reports commit `a3260986` and the served page matches the
  local file byte for byte. Verified.

## 2. Worker surface (verified)

| Check | Result |
| --- | --- |
| `GET /health` | 200, `{"service":"executive-agent-research","status":"ok"}` |
| `GET /v1/documents` with no token | 401 |
| `OPTIONS` preflight, `Origin: https://interplanetarysister.github.io` | 204 with `access-control-allow-origin` set, methods `GET, PUT, DELETE, OPTIONS` |
| `OPTIONS` preflight, foreign origin | 403 |
| Unknown path | 404 |

## 3. Defect: the Worker cannot authenticate any session

Every authenticated request returns **503 `Authentication service unavailable`**, including with a
genuinely valid Supabase access token that the Supabase auth endpoint itself accepts (verified
separately: `GET /auth/v1/user` with that token returned 200 and the user record).

The 503 is produced by the `catch` block inside `authenticate()` in
`cloudflare/executive-agent-research.mjs`. That block can only be reached if an exception is thrown
before any response is inspected. With a garbage token the same 503 is returned, which proves the failure
happens before the token is evaluated at all. The health route works, so the Worker runtime, the R2 binding
and the deploy are fine.

Two candidate causes, both requiring Cloudflare account access to confirm:

1. A malformed `SUPABASE_PUBLISHABLE_KEY` secret (for example a trailing newline from a paste). A header
   value containing a newline makes `fetch` throw immediately, which matches the symptom exactly.
2. `SUPABASE_URL` pointing at a host that does not resolve.

This means the R2 document API has **never** served an authenticated request. The earlier claim of a
successful R2 create/read/delete was made through the Cloudflare API, not through the Worker, and the
authenticated browser round trip was never exercised. It must not be described as working.

Fix, once access exists: re-set the two secrets with trimmed values, or add `.trim()` to the header
construction, then redeploy and repeat the round trip.

## 4. Database acceptance (verified end to end over REST with real sessions)

A disposable principal was created through the Auth admin API, granted a membership, signed in with a
real password grant, and exercised against PostgREST. It was then deleted along with every record it
created. The owner account was never used for testing.

| Check | Result |
| --- | --- |
| viewer reads `executive.tasks` | 200 |
| viewer inserts a task | 403, row level security violation |
| researcher inserts a task | 201 |
| researcher updates a task | 204 |
| researcher creates an opportunity | 201 |
| researcher inserts a funding commitment | 403, row level security violation |
| funding totals from cleared records only | 350,000 recorded across two commitments, `funding_received` = 100,000 |
| `cleared_needs_date` constraint | present on `funding_commitments` |
| cleanup | tasks 0, opportunities 0, commitments 0, test users 0, memberships back to the single owner |

### Defect found and fixed

Only `SELECT` had been granted to `authenticated` on the `executive` operations tables, so every
`member_insert`, `member_update` and `member_delete` policy was unreachable and writes failed with a
table privilege error rather than passing through row-level security. `20261126_grant_member_dml.sql`
grants DML on the twelve operations tables, after which the researcher write to `funding_commitments` is
denied by policy (the intended behaviour) instead of by privilege.

## 5. Console

Rebuilt from an infrastructure view into an operating workspace: overview with objective, received and
remaining, nearest deadlines and open tasks; task board with inline status, priority, due date and delete;
funding workspace with editable opportunity status and deadline, commitment ledger with an evidence-gated
"mark cleared" action; relationships with organizations, people and correspondence; knowledge with
sources and research artifacts; documents with a one-click access test; account panel with password setup.

All query shapes used by the console were confirmed to resolve against PostgREST (embedded relations
included). Role gating is applied in the interface and enforced again by row level security.

## 6. Launch readiness, factual

Can currently: authenticate the owner, enforce role-based access, record and track tasks, opportunities,
commitments, organizations, people, knowledge and research, and compute verified received funding
correctly.

Cannot currently: store or retrieve a private document through the Worker, because of the authentication
defect in section 3. No scheduled or background execution exists yet, so nothing runs unattended.
