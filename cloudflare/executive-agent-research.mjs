/**
 * Michelle Rogers Executive - private R2 document API.
 * Supabase Auth validates confirmed owner email addresses.
 * No service-role key, R2 S3 key, or Cloudflare management token is needed.
 */
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const allowedTypes = new Set(["application/pdf","text/plain","text/markdown","application/json"]);
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: JSON_HEADERS});

function validKey(key) {
  if (!key || key.length > 180 || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(key)) return false;
  return !key.split("/").some(part => !part || part === "." || part === "..");
}

async function authenticate(request, env) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  if (!match) return { error: json({error: "Authentication required"}, 401) };
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.EXECUTIVE_OWNER_EMAILS) {
    return { error: json({error: "Executive owner authentication has not been configured"}, 503) };
  }
  let base;
  try { base = new URL(env.SUPABASE_URL); } catch { return { error: json({error: "Invalid authentication configuration"}, 503) }; }
  if (base.protocol !== "https:" || !base.hostname.endsWith(".supabase.co") || base.pathname !== "/") {
    return { error: json({error: "Invalid authentication configuration"}, 503) };
  }
  try {
    const response = await fetch(new URL("/auth/v1/user", base), {
      headers: { "apikey": env.SUPABASE_PUBLISHABLE_KEY, "authorization": "Bearer " + match[1] },
      redirect: "error"
    });
    if (!response.ok) return { error: json({error: "Invalid session"}, 401) };
    const user = await response.json();
    const allowed = String(env.EXECUTIVE_OWNER_EMAILS).split(",").map(x => x.trim().toLowerCase());
    if (!user?.id || !user.email_confirmed_at || !allowed.includes(String(user.email || "").toLowerCase())) {
      return { error: json({error: "Not authorized for executive documents"}, 403) };
    }
    // Require an active membership in the canonical Supabase access-control table.
    const membershipUrl = new URL("/rest/v1/executive_memberships",base);
    membershipUrl.searchParams.set("user_id","eq."+user.id);
    membershipUrl.searchParams.set("select","role,active");
    const membershipResponse = await fetch(membershipUrl,{
      headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,authorization:"Bearer "+match[1]},redirect:"error"
    });
    if (!membershipResponse.ok) return {error:json({error:"Membership verification unavailable"},503)};
    const memberships = await membershipResponse.json();
    if (!Array.isArray(memberships) || !memberships.some(m=>m.active && ["owner","admin"].includes(m.role))) {
      return {error:json({error:"Executive membership required"},403)};
    }
    return { id: user.id };
  } catch {
    return { error: json({error: "Authentication service unavailable"}, 503) };
  }
}

async function handle(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({service:"executive-agent-research",status:env.RESEARCH_BUCKET?"ok":"storage-unavailable"});
    }
    if (!url.pathname.startsWith("/v1/documents") || !["GET","PUT","DELETE"].includes(request.method)) {
      return json({error:"Not found"},404);
    }
    if (!env.RESEARCH_BUCKET) return json({error:"Storage unavailable"},503);
    const user = await authenticate(request, env);
    if (user.error) return user.error;
    if (url.pathname === "/v1/documents") {
      if (request.method !== "GET") return json({error:"Method not allowed"},405);
      const prefix = url.searchParams.get("prefix") || "";
      if (prefix && !validKey(prefix)) return json({error:"Invalid prefix"},400);
      const result = await env.RESEARCH_BUCKET.list({prefix:"documents/" + user.id + "/" + prefix,limit:100});
      return json({objects:result.objects.map(x=>({name:x.key.slice(("documents/" + user.id + "/").length),size:x.size,uploaded:x.uploaded})),truncated:result.truncated});
    }
    if (!url.pathname.startsWith("/v1/documents/")) return json({error:"Not found"},404);
    let key;
    try { key = decodeURIComponent(url.pathname.slice("/v1/documents/".length)); }
    catch { return json({error:"Invalid document name"},400); }
    if (!validKey(key)) return json({error:"Invalid document name"},400);
    const objectKey = "documents/" + user.id + "/" + key;
    if (request.method === "PUT") {
      const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!allowedTypes.has(type)) return json({error:"Unsupported content type"},415);
      const max = 10 * 1024 * 1024;
      const declared = request.headers.get("content-length");
      if (declared && (!/^\d+$/.test(declared) || Number(declared)>max)) return json({error:"Document too large"},413);
      const data = await request.arrayBuffer();
      if (data.byteLength > max) return json({error:"Document too large"},413);
      await env.RESEARCH_BUCKET.put(objectKey,data,{httpMetadata:{contentType:type},customMetadata:{owner:user.id}});
      return json({stored:true,name:key,size:data.byteLength},201);
    }
    if (request.method === "DELETE") {
      await env.RESEARCH_BUCKET.delete(objectKey);
      return json({deleted:true,name:key});
    }
    const object = await env.RESEARCH_BUCKET.get(objectKey);
    if (!object) return json({error:"Not found"},404);
    const headers = new Headers({"content-type":object.httpMetadata?.contentType || "application/octet-stream","cache-control":"private, no-store","x-content-type-options":"nosniff","content-disposition":"attachment"});
    return new Response(object.body,{headers});
}

// Only the executive console origin is permitted browser CORS access.
const CONSOLE_ORIGIN = "https://interplanetarysister.github.io";
function withCors(response, origin) {
  if (origin !== CONSOLE_ORIGIN) return response;
  const h = new Headers(response.headers);
  h.set("access-control-allow-origin", CONSOLE_ORIGIN);
  h.set("vary", "Origin");
  h.set("access-control-expose-headers", "content-disposition");
  return new Response(response.body, {status:response.status,statusText:response.statusText,headers:h});
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin");
    if (request.method === "OPTIONS") {
      if (origin !== CONSOLE_ORIGIN) return json({error:"Origin not allowed"},403);
      return new Response(null,{status:204,headers:{
        "access-control-allow-origin":CONSOLE_ORIGIN,
        "access-control-allow-methods":"GET, PUT, DELETE, OPTIONS",
        "access-control-allow-headers":"authorization, content-type",
        "access-control-max-age":"600",
        "vary":"Origin"
      }});
    }
    return withCors(await handle(request,env),origin);
  }
};
