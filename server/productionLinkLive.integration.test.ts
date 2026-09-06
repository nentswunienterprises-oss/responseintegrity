import assert from "node:assert/strict";
import test from "node:test";

const enabled = process.env.RI_PRODUCTION_LINK_DB_TEST === "1";

test("live Production Link records persist account and specialist application lineage", { skip: !enabled }, async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const capacityCode = process.env.RI_TEST_CAPACITY_CODE;
  const tutorUserId = process.env.RI_TEST_TUTOR_USER_ID;

  assert.ok(supabaseUrl, "SUPABASE_URL is required for the live integration test");
  assert.ok(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required for the live integration test");
  assert.ok(capacityCode, "RI_TEST_CAPACITY_CODE is required for the live integration test");
  assert.ok(tutorUserId, "RI_TEST_TUTOR_USER_ID is required for the live integration test");

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: link, error: linkError } = await supabase
    .from("affiliate_codes")
    .select("code, pipeline_type, status")
    .eq("code", capacityCode)
    .single();
  assert.ifError(linkError);
  assert.equal(link?.pipeline_type, "capacity");
  assert.equal(link?.status, "active");

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, role, production_link_code, tracking_source, tracking_campaign")
    .eq("id", tutorUserId)
    .single();
  assert.ifError(userError);
  assert.equal(user?.role, "tutor");
  assert.equal(user?.production_link_code, capacityCode);

  const { data: application, error: applicationError } = await supabase
    .from("tutor_applications")
    .select("user_id, production_link_code, tracking_source, tracking_campaign")
    .eq("user_id", tutorUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  assert.ifError(applicationError);
  assert.equal(application?.production_link_code, capacityCode);
});
