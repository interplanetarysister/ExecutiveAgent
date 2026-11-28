# Executive Agent Cloudflare authentication repair — 2026-11-26

## Scope
Michelle Rogers Executive account `ab53799fa1a2189dd6aee605504c9fa4`, Worker `executive-agent-research`, R2 `researched-knowledge`. Do not confuse with the Interplanetary Fund production account.

## Root cause confirmed
The Worker called Supabase endpoints with `fetch(..., { redirect: "error" })`. Cloudflare Workers rejects the `error` redirect policy with a TypeError: only `follow` and `manual` are supported. The exception occurred on the first outbound user lookup, before token validation, causing **503 Authentication service unavailable** for valid and invalid bearer tokens alike.

A temporary sanitized stage diagnostic identified the failing step and unsupported redirect option. The diagnostic error detail was removed after repair.

## Implemented
- Changed both Supabase outbound fetches (user lookup and membership lookup) to `redirect: "manual"` to prevent auto-following redirects.
- Normalized the public Supabase API-key header and URL inputs with `.trim()`.
- Replaced the Worker's publishable-key secret binding with the already-public anon key used by the GitHub Pages console; no service-role key is present.
- Preserved R2, Supabase URL, owner email and API key bindings.
- Deployed the patched Worker directly to the dedicated Executive account.
- Updated canonical Worker source at `cloudflare/executive-agent-research.mjs`.

## Live checks after repair
- `GET /health` -> 200, `status:ok`.
- `GET /v1/documents` without token -> 401 Authentication required.
- `GET /v1/documents` with deliberately invalid bearer -> 401 Invalid session (previously 503).
- `OPTIONS /v1/documents` from GitHub Pages with authenticated upload headers -> 204, correct allow-origin and methods.
- `OPTIONS /v1/documents` from another origin -> 403.
- Live Worker settings still include four pre-existing bindings.

## Not yet verified
- A real confirmed owner-session token reaching the membership query and authorizing a document operation.
- Actual authenticated browser upload/list/download/delete end-to-end.
- Complete release readiness for unattended executive operations.

Do not claim the above unverified operations have passed. No user password or real session token was accessed in this repair.
