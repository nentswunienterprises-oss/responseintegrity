export type SandboxSimulationDecisionKind = "single_choice" | "multi_select";

export type SandboxSimulationRiskKind =
  | "evidence_contamination"
  | "authority_violation"
  | "escalation_failure";

export interface SandboxSimulationOption {
  key: string;
  label: string;
}

export interface SandboxSimulationDecisionDefinition {
  key: string;
  deepDiveKey: string;
  competencyKey: string;
  prompt: string;
  kind: SandboxSimulationDecisionKind;
  options: SandboxSimulationOption[];
  correctOptionKeys: string[];
  criticalFailOptionKeys?: string[];
  riskOptionKeys?: Partial<Record<SandboxSimulationRiskKind, string[]>>;
  explanation: string;
}

export interface SandboxSimulationDefinition {
  key: string;
  version: number;
  title: string;
  description: string;
  fictionalScenarioConfirmed: true;
  passThresholdPercent: number;
  decisions: SandboxSimulationDecisionDefinition[];
}

export interface SandboxSimulationResponseInput {
  decisionKey: string;
  selectedOptionKeys: string[];
}

export interface SandboxSimulationDecisionResult {
  decisionKey: string;
  deepDiveKey: string;
  competencyKey: string;
  correct: boolean;
  criticalFail: boolean;
  risks: SandboxSimulationRiskKind[];
  selectedOptionKeys: string[];
  correctOptionKeys: string[];
  explanation: string;
}

export interface SandboxSimulationResult {
  simulationKey: string;
  version: number;
  totalDecisions: number;
  correctDecisions: number;
  percent: number;
  passed: boolean;
  hasCriticalFail: boolean;
  criticalFailDecisionKeys: string[];
  evidenceContaminationCount: number;
  authorityViolationCount: number;
  escalationFailureCount: number;
  coveredDeepDiveKeys: string[];
  decisionResults: SandboxSimulationDecisionResult[];
  authoritative: false;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean))).sort();
}

function sameStringSet(left: string[], right: string[]) {
  const a = uniqueSorted(left);
  const b = uniqueSorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function optionKeySet(decision: SandboxSimulationDecisionDefinition) {
  return new Set(decision.options.map((option) => option.key));
}

export function validateSandboxSimulationDefinition(definition: SandboxSimulationDefinition) {
  if (!definition.key.trim()) throw new Error("Sandbox simulation key is required.");
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new Error("Sandbox simulation version must be a positive integer.");
  }
  if (definition.fictionalScenarioConfirmed !== true) {
    throw new Error("Sandbox simulations must be explicitly fictional.");
  }
  if (definition.passThresholdPercent <= 0 || definition.passThresholdPercent > 100) {
    throw new Error("Sandbox simulation threshold must be between 0 and 100.");
  }
  if (!definition.decisions.length) throw new Error("Sandbox simulation must contain decisions.");

  const seenDecisionKeys = new Set<string>();
  for (const decision of definition.decisions) {
    if (!decision.key.trim()) throw new Error("Sandbox simulation decision key is required.");
    if (seenDecisionKeys.has(decision.key)) {
      throw new Error(`Duplicate Sandbox simulation decision key: ${decision.key}`);
    }
    seenDecisionKeys.add(decision.key);

    if (!decision.deepDiveKey.trim()) {
      throw new Error(`Sandbox simulation decision ${decision.key} must identify a Deep Dive.`);
    }
    if (!decision.competencyKey.trim()) {
      throw new Error(`Sandbox simulation decision ${decision.key} must identify a competency.`);
    }
    if (decision.options.length < 2) {
      throw new Error(`Sandbox simulation decision ${decision.key} must provide at least two options.`);
    }

    const optionKeys = decision.options.map((option) => option.key);
    if (new Set(optionKeys).size !== optionKeys.length) {
      throw new Error(`Sandbox simulation decision ${decision.key} contains duplicate option keys.`);
    }
    if (!decision.correctOptionKeys.length) {
      throw new Error(`Sandbox simulation decision ${decision.key} must define a correct action.`);
    }

    const validOptions = optionKeySet(decision);
    const referencedOptionKeys = [
      ...decision.correctOptionKeys,
      ...(decision.criticalFailOptionKeys || []),
      ...Object.values(decision.riskOptionKeys || {}).flatMap((values) => values || []),
    ];
    for (const optionKey of referencedOptionKeys) {
      if (!validOptions.has(optionKey)) {
        throw new Error(
          `Sandbox simulation decision ${decision.key} references unknown option ${optionKey}.`,
        );
      }
    }

    const correct = new Set(decision.correctOptionKeys);
    const criticalOverlap = (decision.criticalFailOptionKeys || []).filter((key) => correct.has(key));
    if (criticalOverlap.length) {
      throw new Error(
        `Sandbox simulation decision ${decision.key} cannot mark a correct action as critical failure.`,
      );
    }
  }
}

function risksForSelection(
  decision: SandboxSimulationDecisionDefinition,
  selectedOptionKeys: string[],
): SandboxSimulationRiskKind[] {
  const risks: SandboxSimulationRiskKind[] = [];
  const selected = new Set(selectedOptionKeys);
  const riskKinds: SandboxSimulationRiskKind[] = [
    "evidence_contamination",
    "authority_violation",
    "escalation_failure",
  ];

  for (const riskKind of riskKinds) {
    if ((decision.riskOptionKeys?.[riskKind] || []).some((optionKey) => selected.has(optionKey))) {
      risks.push(riskKind);
    }
  }
  return risks;
}

export function evaluateSandboxSimulation(
  definition: SandboxSimulationDefinition,
  responses: SandboxSimulationResponseInput[],
): SandboxSimulationResult {
  validateSandboxSimulationDefinition(definition);

  if (responses.length !== definition.decisions.length) {
    throw new Error(
      `Expected ${definition.decisions.length} Sandbox simulation responses, received ${responses.length}.`,
    );
  }

  const responseMap = new Map<string, SandboxSimulationResponseInput>();
  for (const response of responses) {
    if (responseMap.has(response.decisionKey)) {
      throw new Error(`Duplicate Sandbox simulation response: ${response.decisionKey}`);
    }
    responseMap.set(response.decisionKey, response);
  }

  const decisionResults = definition.decisions.map((decision) => {
    const response = responseMap.get(decision.key);
    if (!response) throw new Error(`Missing Sandbox simulation response: ${decision.key}`);

    const selectedOptionKeys = response.selectedOptionKeys
      .map((value) => String(value).trim())
      .filter(Boolean);
    if (!selectedOptionKeys.length) {
      throw new Error(`Sandbox simulation response ${decision.key} must select an action.`);
    }

    const validOptions = optionKeySet(decision);
    for (const selectedOptionKey of selectedOptionKeys) {
      if (!validOptions.has(selectedOptionKey)) {
        throw new Error(
          `Sandbox simulation response ${decision.key} selected unknown option ${selectedOptionKey}.`,
        );
      }
    }
    if (decision.kind === "single_choice" && uniqueSorted(selectedOptionKeys).length !== 1) {
      throw new Error(`Sandbox simulation response ${decision.key} must select exactly one action.`);
    }

    const correct = sameStringSet(selectedOptionKeys, decision.correctOptionKeys);
    const criticalFail = selectedOptionKeys.some((optionKey) =>
      (decision.criticalFailOptionKeys || []).includes(optionKey),
    );
    const risks = risksForSelection(decision, selectedOptionKeys);

    return {
      decisionKey: decision.key,
      deepDiveKey: decision.deepDiveKey,
      competencyKey: decision.competencyKey,
      correct,
      criticalFail,
      risks,
      selectedOptionKeys,
      correctOptionKeys: [...decision.correctOptionKeys],
      explanation: decision.explanation,
    } satisfies SandboxSimulationDecisionResult;
  });

  const correctDecisions = decisionResults.filter((result) => result.correct).length;
  const percent = Number(((correctDecisions / decisionResults.length) * 100).toFixed(2));
  const criticalFailDecisionKeys = decisionResults
    .filter((result) => result.criticalFail)
    .map((result) => result.decisionKey);
  const countRisk = (risk: SandboxSimulationRiskKind) =>
    decisionResults.filter((result) => result.risks.includes(risk)).length;

  return {
    simulationKey: definition.key,
    version: definition.version,
    totalDecisions: decisionResults.length,
    correctDecisions,
    percent,
    passed: percent >= definition.passThresholdPercent && criticalFailDecisionKeys.length === 0,
    hasCriticalFail: criticalFailDecisionKeys.length > 0,
    criticalFailDecisionKeys,
    evidenceContaminationCount: countRisk("evidence_contamination"),
    authorityViolationCount: countRisk("authority_violation"),
    escalationFailureCount: countRisk("escalation_failure"),
    coveredDeepDiveKeys: uniqueSorted(decisionResults.map((result) => result.deepDiveKey)),
    decisionResults,
    authoritative: false,
  };
}
