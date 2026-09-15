import {
  CAPABILITY_CROSS_CUTTING_COMPETENCIES,
  getCapabilityDeepDiveBlueprint,
} from "./capabilityBlueprint";
import type { SandboxSimulationDefinition } from "./capabilitySandboxSimulation";

function isKnownCompetency(deepDiveKey: string, competencyKey: string) {
  const deepDive = getCapabilityDeepDiveBlueprint(deepDiveKey);
  if (!deepDive) return false;
  return (
    deepDive.competencyKeys.includes(competencyKey) ||
    CAPABILITY_CROSS_CUTTING_COMPETENCIES.includes(
      competencyKey as (typeof CAPABILITY_CROSS_CUTTING_COMPETENCIES)[number],
    )
  );
}

export function validateSandboxSimulationAgainstCapabilityBlueprint(
  definition: SandboxSimulationDefinition,
) {
  const coveredDeepDiveKeys = new Set<string>();
  const coveredCompetencies = new Set<string>();
  const coveredCriticalBoundaries = new Set<string>();

  for (const decision of definition.decisions) {
    const deepDive = getCapabilityDeepDiveBlueprint(decision.deepDiveKey);
    if (!deepDive) {
      throw new Error(
        `Sandbox simulation ${definition.key} references unknown Deep Dive ${decision.deepDiveKey}.`,
      );
    }
    if (!isKnownCompetency(decision.deepDiveKey, decision.competencyKey)) {
      throw new Error(
        `Sandbox simulation ${definition.key} uses unknown competency ${decision.deepDiveKey}:${decision.competencyKey}.`,
      );
    }

    const validBoundaryKeys = new Set(deepDive.criticalBoundaries.map((boundary) => boundary.key));
    const boundaryKeys = Array.from(new Set(decision.criticalBoundaryKeys || []));
    for (const boundaryKey of boundaryKeys) {
      if (!validBoundaryKeys.has(boundaryKey)) {
        throw new Error(
          `Sandbox simulation ${definition.key} uses unknown critical boundary ${decision.deepDiveKey}:${boundaryKey}.`,
        );
      }
      coveredCriticalBoundaries.add(`${decision.deepDiveKey}:${boundaryKey}`);
    }

    if ((decision.criticalFailOptionKeys || []).length > 0 && boundaryKeys.length === 0) {
      throw new Error(
        `Sandbox simulation ${definition.key} decision ${decision.key} has critical-fail actions without RI critical-boundary lineage.`,
      );
    }

    coveredDeepDiveKeys.add(decision.deepDiveKey);
    coveredCompetencies.add(`${decision.deepDiveKey}:${decision.competencyKey}`);
  }

  return {
    simulationKey: definition.key,
    coveredDeepDiveKeys: Array.from(coveredDeepDiveKeys).sort(),
    coveredCompetencies: Array.from(coveredCompetencies).sort(),
    coveredCriticalBoundaries: Array.from(coveredCriticalBoundaries).sort(),
  };
}
