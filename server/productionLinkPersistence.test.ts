import assert from "node:assert/strict";
import test from "node:test";
import {
  preserveFirstProductionLink,
  resolveDurableProductionLink,
} from "../shared/productionLinks";

type Lead = {
  production_link_code: string | null;
  created_at: string;
  id: string;
};

function firstProductionLead(leads: Lead[]) {
  return [...leads]
    .filter((lead) => lead.production_link_code)
    .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id))[0] || null;
}

test("multi-lead parent history resolves the earliest Production Link deterministically", () => {
  const lead = firstProductionLead([
    { id: "lead-2", production_link_code: null, created_at: "2026-01-02T00:00:00Z" },
    { id: "lead-3", production_link_code: "DEM002", created_at: "2026-01-03T00:00:00Z" },
    { id: "lead-1", production_link_code: "DEM001", created_at: "2026-01-01T00:00:00Z" },
  ]);
  assert.equal(lead?.production_link_code, "DEM001");
  assert.equal(resolveDurableProductionLink(lead?.production_link_code, null, "DEM002"), "DEM001");
});

test("capacity account attribution survives application submission without transport state", () => {
  const account = { production_link_code: "CAP001" };
  const application = resolveDurableProductionLink(account.production_link_code, null, null);
  assert.equal(application, "CAP001");
});

test("attempted capacity reassignment cannot replace the account lineage", () => {
  assert.throws(() => preserveFirstProductionLink("CAP001", "CAP002"), /cannot be reassigned/);
});