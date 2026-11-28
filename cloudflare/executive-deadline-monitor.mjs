/**
 * Michelle Rogers Executive — scheduled deadline monitor.
 * No owner access token, Supabase service role, or browser credential is used.
 */
const json = (obj,status=200) => new Response(JSON.stringify(obj),{
  status, headers:{"content-type":"application/json","cache-control":"no-store"}
});
export default {
  async fetch(request) {
    const url=new URL(request.url);
    if(request.method==="GET" && url.pathname==="/health")
      return json({service:"executive-deadline-monitor",status:"ok"});
    return json({error:"Not found"},404);
  },
  async scheduled(_event,env,ctx) {
    ctx.waitUntil((async()=>{
      const base=new URL(String(env.SUPABASE_URL||"").trim());
      if(base.protocol!=="https:" || base.hostname!=="bimmfmydbmooarobilsq.supabase.co")
        throw Error("Unexpected Executive Supabase host");
      const token=String(env.EXECUTIVE_SCHEDULER_TOKEN||"").trim();
      const key=String(env.SUPABASE_PUBLISHABLE_KEY||"").trim();
      if(token.length<32||!key)throw Error("Executive scheduler binding missing");
      const res=await fetch(new URL("/rest/v1/rpc/executive_refresh_due_tasks",base),{
        method:"POST",
        headers:{"apikey":key,"authorization":"Bearer "+key,"content-type":"application/json"},
        body:JSON.stringify({token}),
        redirect:"manual"
      });
      if(!res.ok)throw Error("Executive scheduler RPC HTTP "+res.status);
      const result=await res.json();
      if(typeof result?.refreshed!=="number")throw Error("Unexpected scheduler response");
      console.log("Executive deadline refresh succeeded; matches:",result.refreshed);
    })());
  }
};