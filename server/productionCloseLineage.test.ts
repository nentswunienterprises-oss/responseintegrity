import assert from "node:assert/strict";
import test from "node:test";
import { resolveProductionCloseLineage } from "./productionCloseLineage";

test("user-owned Demand close preserves link and reward eligibility", () => {
  const lineage = resolveProductionCloseLineage(
    { affiliate_id: "owner-a", production_link_code: "DEM001" },
    { owner_user_id: "owner-a", owner_type: "contributor", owner_name: "Sarah" },
  );
  assert.deepEqual(lineage, {
    affiliateId: "owner-a",
    productionLinkCode: "DEM001",
    ownerType: "contributor",
    ownerName: "Sarah",
    rewardEligible: true,
  });
});

test("campaign-owned Demand close is not organic and has no payout recipient", () => {
  const lineage = resolveProductionCloseLineage(
    { affiliate_id: null, production_link_code: "DEMCAMP" },
    { owner_user_id: null, owner_type: "campaign", owner_name: "September School Campaign" },
  );
  assert.equal(lineage.productionLinkCode, "DEMCAMP");
  assert.equal(lineage.affiliateId, null);
  assert.equal(lineage.rewardEligible, false);
});

test("organic close has no Production Link lineage", () => {
  const lineage = resolveProductionCloseLineage({ affiliate_id: null, production_link_code: null }, null);
  assert.equal(lineage.productionLinkCode, null);
  assert.equal(lineage.rewardEligible, false);
});

test("first-touch code remains the close source", () => {
  const lineage = resolveProductionCloseLineage(
    { affiliate_id: "owner-a", production_link_code: "DEM001" },
    { owner_user_id: "owner-a", owner_type: "contributor", owner_name: "Sarah" },
  );
  assert.equal(lineage.productionLinkCode, "DEM001");
});
