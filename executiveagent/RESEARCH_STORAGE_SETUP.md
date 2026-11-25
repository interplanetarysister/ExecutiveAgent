# Executive research storage

Cloudflare Worker: `executive-agent-research` in account `ab53799fa1a2189dd6aee605504c9fa4`.

Native R2 binding `RESEARCH_BUCKET` targets the private `researched-knowledge` bucket. Public r2.dev access has been disabled.

Supabase URL is configured for project `bimmfmydbmooarobilsq`, and `SUPABASE_PUBLISHABLE_KEY` is installed as a Worker secret. The Worker denies document access until `EXECUTIVE_OWNER_USER_ID` is set to a verified Supabase Auth user UUID. No service-role key is needed by this API.

API: `/health` (public), `/v1/documents` (list), `/v1/documents/{name}` (PUT, GET, DELETE) with authenticated Bearer access.

Cloudflare confirmed the deployment and binding; external HTTP checks were blocked by DNS from this environment. Authenticated document roundtrip remains unverified until the owner is enrolled. Never use the iFund production account.
