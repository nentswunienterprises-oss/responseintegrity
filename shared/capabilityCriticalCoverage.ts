import { getCapabilityDeepDiveBlueprint } from "./capabilityBlueprint";
import { getCapabilityMvpAssessmentPlanEntry } from "./capabilityAssessmentPlan";

export interface CapabilityCriticalBoundaryRequirement {
  deepDiveKey: string;
  boundaryKeys: string[];
  minimumDistinctBoundaries: number;
}

export function buildCapabilityCriticalBoundaryRequirements(
  assessmentKey: string,
): CapabilityCriticalBoundaryRequirement[] {
  const plan = getCapabilityMvpAssessmentPlanEntry(assessmentKey);
  if (!plan) return [];

  return plan.coveredDeepDiveKeys.map((deepDiveKey) => {
    const blueprint = getCapabilityDeepDiveBlueprint(deepDiveKey);
    if (!blueprint || blueprint.criticalBoundaries.length === 0) {
      throw new Error(`Capability blueprint ${deepDiveKey} has no critical boundaries.`);
    }

    const boundaryKeys = blueprint.criticalBoundaries.map((boundary) => boundary.key);
    return {
      deepDiveKey,
      boundaryKeys,
      minimumDistinctBoundaries:
        plan.criticalCoverageMode === "all_boundaries" ? boundaryKeys.length : 1,
    };
  });
}
