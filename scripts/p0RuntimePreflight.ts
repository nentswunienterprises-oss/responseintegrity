// Run within the deployed backend, without copying credentials elsewhere.
// Read-only admin lookup proves privilege; no user identities or secrets printed.
import { createClient } from "@supabase/supabase-js";
import { selectPrivilegedSupabaseKey } from "../server/privilegedSupabaseKey";

async function main() {
  const target = new URL(process.env.SUPABASE_URL || "");
  if (target.hostname !== "yzcnavucvwgmulcxgxvw.supabase.co") throw new Error("Unexpected REST target");
  const key = selectPrivilegedSupabaseKey();
  const client=createClient(target.origin,key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  });
  const {error}=await client.auth.admin.listUsers({page:1,perPage:1});
  if (error) throw new Error("Privileged credential probe failed");
  const tableProbe=await client.from("users").select("id").limit(0);
  if (tableProbe.error) throw new Error("Privileged REST table probe failed");
  console.log(JSON.stringify({
    status:"PASS",restProjectRef:"yzcnavucvwgmulcxgxvw",
    credentialKind:key.startsWith("sb_secret_")?"secret":"service_role",
    adminProbe:"PASS",restProbe:"PASS",
    sourceCommit:process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || null,
    checkedAt:new Date().toISOString(),
  }));
}
main().catch(()=>{console.error("P0 runtime preflight BLOCKED: target/credential/API proof failed; no secret details emitted");process.exitCode=1;});
