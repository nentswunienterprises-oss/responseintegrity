import test from "node:test";
import assert from "node:assert/strict";
import { requiresPrivilegedServerSupabaseKey, selectPrivilegedSupabaseKey } from "./privilegedSupabaseKey";
const hub = "https://yzcnavucvwgmulcxgxvw.supabase.co";
const proof = "https://jftlxeacphvbnhbsbpxc.supabase.co";
const secret = "sb_secret_fictional_only_credential";
const service = ["e30", Buffer.from(JSON.stringify({role:"service_role"})).toString("base64url"), "fictional"].join(".");
test("Hub REST target refuses fallback even with SQL Proof target", () => {
  const env={SUPABASE_URL:hub,DATABASE_URL:"postgres://postgres@db.jftlxeacphvbnhbsbpxc.supabase.co/db",SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fake"};
  assert.equal(requiresPrivilegedServerSupabaseKey(env),true);
  assert.throws(()=>selectPrivilegedSupabaseKey(env),/fallback refused/);
});
test("Hub preview and development also require privilege",()=>{
  for (const env of [{VERCEL_ENV:"preview"}, {NODE_ENV:"development"}])
    assert.throws(()=>selectPrivilegedSupabaseKey({...env,SUPABASE_URL:hub}),/required/);
});
test("non-preview production requires privilege regardless of SQL target",()=>{
  assert.throws(()=>selectPrivilegedSupabaseKey({NODE_ENV:"production",SUPABASE_URL:proof,SUPABASE_ANON_KEY:"anon"}));
});
test("secret preferred over service and publishable",()=>{
  assert.equal(selectPrivilegedSupabaseKey({SUPABASE_URL:hub,SUPABASE_SECRET_KEY:secret,SUPABASE_SERVICE_ROLE_KEY:service,SUPABASE_PUBLISHABLE_KEY:"publishable"}),secret);
});
test("service role selected before publishable",()=>{
  assert.equal(selectPrivilegedSupabaseKey({SUPABASE_URL:hub,SUPABASE_SERVICE_ROLE_KEY:service,SUPABASE_PUBLISHABLE_KEY:"publishable"}),service);
});
test("mislabelled anon credential fails closed",()=>{
  assert.throws(()=>selectPrivilegedSupabaseKey({SUPABASE_URL:hub,SUPABASE_SECRET_KEY:"sb_publishable_wrong",SUPABASE_SERVICE_ROLE_KEY:"e30.eyJyb2xlIjoiYW5vbiJ9.fake"}));
});
test("isolated Proof preview allows auth-scoped fallback",()=>{
  assert.equal(selectPrivilegedSupabaseKey({SUPABASE_URL:proof,VERCEL_ENV:"preview",NODE_ENV:"production",SUPABASE_PUBLISHABLE_KEY:"publishable"}),"publishable");
});
test("empty/malformed keys are not presence proof",()=>{
  assert.throws(()=>selectPrivilegedSupabaseKey({SUPABASE_URL:hub,SUPABASE_SECRET_KEY:"   ",SUPABASE_SERVICE_ROLE_KEY:"malformed"}));
});
