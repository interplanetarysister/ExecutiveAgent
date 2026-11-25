# ExecutiveAgent — private research storage and owner access

Cloudflare account: Michelle Rogers Executive (`ab53799fa1a2189dd6aee605504c9fa4`).
Worker: `executive-agent-research`.
R2 binding: `RESEARCH_BUCKET` → `researched-knowledge` (native R2 access; public r2.dev hosting disabled).
Supabase project: `bimmfmydbmooarobilsq` (not iFund).

## Owner authorization
Two owner email addresses are securely configured in Worker secret `EXECUTIVE_OWNER_EMAILS` (values omitted from this public repository). Each must first have a genuine **email-confirmed Supabase Auth user** in the ExecutiveAgent project. The Worker verifies an incoming Bearer token against `/auth/v1/user` for every document operation; unconfirmed accounts and non-allowlisted users are denied. No user was enrolled by this deployment. The existing Supabase publishable API key is stored as Worker secret `SUPABASE_PUBLISHABLE_KEY`. Do not use a service-role key, account access token, or R2 S3 credentials in runtime.

Routes: `GET /health` (non-sensitive), `GET /v1/documents` (list), and `PUT`, `GET`, `DELETE /v1/documents/{key}`, all document routes requiring owner authentication. Document keys are segregated by Supabase user UUID; each authorized email accesses its own objects.

## Deployment verification
Cloudflare API verified deployed script, Worker route, R2 binding, and secret names. Live requests from this environment could not resolve the workers.dev hostname; **health and HTTP 401 behavior remain unverified**, as does authenticated upload/list/download/delete. No production research data was written. Do not claim full acceptance before testing.

Only the Michelle Rogers Executive Cloudflare account may be used. Never modify the iFund account as part of this deployment.
