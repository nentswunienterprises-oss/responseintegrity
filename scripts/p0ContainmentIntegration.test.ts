import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const manifest=JSON.parse(readFileSync("checks/p0-exposure-manifest.json","utf8"));
const allTables=[...manifest.tables,...["early_intervention_requests","leadership_pilot_requests","school_campaigns"].map(relname=>({relname}))];
const sql=readFileSync("migrations/20261013_p0_anon_containment.sql","utf8");
const storageSql=readFileSync("migrations/20261013_p0_confidential_storage_private.sql","utf8");
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`);
  for (const {relname} of allTables) {
    await db.exec(`CREATE TABLE public."${relname}" (id text PRIMARY KEY, user_id text, value text);
      INSERT INTO public."${relname}" VALUES ('fixture','owner-a','fictional');
      GRANT ALL ON public."${relname}" TO PUBLIC,anon,authenticated,service_role;
      GRANT SELECT(value) ON public."${relname}" TO anon,authenticated;`);
  }
  for (const relname of ["early_intervention_requests","leadership_pilot_requests","school_campaigns"]) {
    await db.exec(`ALTER TABLE public."${relname}" ENABLE ROW LEVEL SECURITY;
      CREATE POLICY unsafe_allow_all ON public."${relname}" USING(true) WITH CHECK(true);`);
  }
  await db.exec(`CREATE TABLE public.intentionally_public(id text);
    ALTER TABLE public.intentionally_public ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.intentionally_public TO anon;
    CREATE POLICY public_read ON public.intentionally_public FOR SELECT TO anon USING(true);
    INSERT INTO public.intentionally_public VALUES ('public-fixture');`);
  return db;
}
test("65-table containment denies 520 client CRUD attempts; retains privileged CRUD and public RLS flow",async()=>{
  const db=await fixture();
  try {
    await db.exec("BEGIN");
    await db.exec(sql);
    await db.exec("COMMIT");
    for (const role of ["anon","authenticated"]) {
      await db.exec(`SET ROLE ${role}; SET request.jwt.claim.sub='owner-b';`);
      for (const {relname} of allTables) {
        for (const statement of [
          `SELECT value FROM public."${relname}"`,
          `INSERT INTO public."${relname}" VALUES ('attack','owner-b','fictional')`,
          `UPDATE public."${relname}" SET user_id='owner-b' WHERE id='fixture'`,
          `DELETE FROM public."${relname}" WHERE id='fixture'`,
        ]) await assert.rejects(db.exec(statement),/permission denied/,role+" "+relname);
      }
      await db.exec("RESET ROLE");
    }
    await db.exec("SET ROLE service_role");
    for (const {relname} of allTables) {
      const result=await db.query(`SELECT value FROM public."${relname}" WHERE id='fixture'`);
      assert.equal(result.rows.length,1);
      await db.exec(`INSERT INTO public."${relname}" VALUES ('server','owner-a','fixture');
        UPDATE public."${relname}" SET value='updated' WHERE id='server';
        DELETE FROM public."${relname}" WHERE id='server';`);
    }
    await db.exec("RESET ROLE; SET ROLE anon");
    assert.equal((await db.query("SELECT * FROM public.intentionally_public")).rows.length,1);
    await db.exec("RESET ROLE");
    const counts=await db.query(readFileSync("checks/p0_catalog_drift_postapply.sql","utf8"));
    assert.deepEqual(Object.values(counts.rows[0]).map(Number),[0,0,0]);
  } finally { await db.close(); }
});
test("one unlisted no-RLS table aborts and fully rolls back containment",async()=>{
  const db=await fixture();
  try {
    await db.exec("CREATE TABLE public.unreviewed_sensitive(id text); BEGIN");
    await assert.rejects(db.exec(sql),/P0 catalog drift/);
    await db.exec("ROLLBACK");
    const result=await db.query(`SELECT relrowsecurity,has_table_privilege('anon',oid,'SELECT') AS allowed
      FROM pg_class WHERE relname='parent_reports'`);
    assert.deepEqual(result.rows[0],{relrowsecurity:false,allowed:true});
  } finally {await db.close();}
});
test("new policy drift aborts before revoking any privileges",async()=>{
  const db=await fixture();
  try {
    await db.exec("CREATE POLICY unreviewed ON public.parent_reports USING(true); BEGIN");
    await assert.rejects(db.exec(sql),/review policies/);
    await db.exec("ROLLBACK");
    assert.equal((await db.query<{allowed:boolean}>("SELECT has_table_privilege('anon','parent_reports','SELECT') AS allowed")).rows[0].allowed,true);
  } finally {await db.close();}
});
test("private Storage migration preserves historical objects and public profile images",async()=>{
  const db=new PGlite();
  try {
    await db.exec(`CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean);
      CREATE TABLE storage.objects(id text,bucket_id text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      INSERT INTO storage.buckets VALUES ('tutor-documents',true),('coo-brain-library',true),('profile-images',true),('executive-task-proofs',true);
      INSERT INTO storage.objects VALUES ('fictional-pdf','tutor-documents'); BEGIN;`);
    await db.exec(storageSql); await db.exec("COMMIT");
    assert.deepEqual((await db.query("SELECT id FROM storage.buckets WHERE public")).rows,[{id:"profile-images"}]);
    assert.equal((await db.query("SELECT * FROM storage.objects")).rows.length,1);
  } finally {await db.close();}
});
