import assert from "node:assert/strict";
import test from "node:test";
import { buildProductionEconomy, isOrganicProductionRow } from "./productionEconomy";

const base = {
  applications: [], users: [], enrollments: [], assignments: [], trialCases: [], trialPlacements: [], closes: [],
};

test("campaign links with no affiliate id remain Production, while organic requires no code", () => {
  const result = buildProductionEconomy({
    ...base,
    links: [{ code: "AFIXNRFOI8", pipeline_type: "demand", affiliate_id: null, owner_type: "campaign", owner_name: "Joe", status: "active" }],
    leads: [{ id: "lead-1", user_id: "parent-1", production_link_code: "AFIXNRFOI8", created_at: "2026-09-06" }, { id: "lead-2", user_id: "parent-2", production_link_code: null }],
  });
  assert.equal(result.sources[0].ownerName, "Joe");
  assert.equal(result.summary.demand.productionAttributed, 1);
  assert.equal(result.summary.demand.organic, 1);
  assert.equal(isOrganicProductionRow({ production_link_code: "AFIXNRFOI8" }), false);
  assert.equal(isOrganicProductionRow({ production_link_code: null }), true);
});

test("first-touch code remains canonical and capacity stations are persisted assignment truth", () => {
  const result = buildProductionEconomy({
    ...base,
    links: [{ code: "AFIXNRFOI8", pipeline_type: "demand", owner_type: "campaign", owner_name: "Joe", status: "active" }, { code: "AFIX8L1WDE", pipeline_type: "demand", owner_type: "campaign", owner_name: "Pro", status: "active" }, { code: "CAP001", pipeline_type: "capacity", owner_type: "campaign", owner_name: "Recruitment", status: "active" }],
    leads: [{ id: "lead-1", user_id: "parent-1", production_link_code: "AFIXNRFOI8" }],
    applications: [{ id: "application-1", user_id: "tutor-1", production_link_code: "CAP001", status: "approved", full_name: "Tutor One" }],
    assignments: [{ tutor_id: "tutor-1", operational_mode: "training", certification_status: "pending" }],
  });
  assert.equal(result.demandLineages[0].code, "AFIXNRFOI8");
  assert.equal(result.demandLineages[0].source?.ownerName, "Joe");
  assert.equal(result.capacityLineages[0].currentStation, "training");
  assert.equal(result.summary.capacity.certifiedLive, 0);
});

test("campaign close lineage keeps ownership without payout eligibility", () => {
  const result = buildProductionEconomy({
    ...base,
    links: [{ code: "CAM001", pipeline_type: "demand", owner_type: "campaign", owner_name: "Joe", status: "active" }],
    leads: [{ id: "lead-1", user_id: "parent-1", production_link_code: "CAM001" }],
    closes: [{ id: 4, lead_id: "lead-1", production_link_code: "CAM001", production_owner_type: "campaign", production_owner_name: "Joe", affiliate_id: null }],
  });
  assert.equal(result.demandLineages[0].close?.productionLinkCode, "CAM001");
  assert.equal(result.demandLineages[0].close?.ownerName, "Joe");
  assert.equal(result.demandLineages[0].reward.eligible, false);
});