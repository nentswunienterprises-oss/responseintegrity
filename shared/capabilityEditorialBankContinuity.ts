/**
 * Explicit, narrowly scoped continuity of already-earned Capability passes
 * across content-only corrections to superseded evidence-exception examples.
 *
 * The old assessments were Founder-approved when taken. A correction of the
 * illustration does not turn an earned pass into a failure. This exception
 * applies ONLY to the exact prior active version named below and ONLY to a
 * previously passed attempt. It never imports failed attempt counts,
 * confirmations, grades or previous unapproved bank versions.
 *
 * Before activating a listed successor, its item keys, competency lineage,
 * accepted answers, assessment config, and progression thresholds must be
 * checked against its predecessor in Capability Proof.
 */
export const CAPABILITY_EDITORIAL_PASS_CONTINUITY = {
  "handover_verification_mastery_v1": {
    "previous": 10,
    "current": 14
  },
  "how_the_system_resolves_uncertainty_mastery_v1": {
    "previous": 14,
    "current": 19
  },
  "how_to_diagnose_mastery_v1": {
    "previous": 19,
    "current": 22
  },
  "how_to_interpret_prompts_mastery_v1": {
    "previous": 15,
    "current": 20
  },
  "intro_session_structure_mastery_v1": {
    "previous": 15,
    "current": 17
  },
  "logging_system_mastery_v1": {
    "previous": 14,
    "current": 18
  },
  "operating_system_retrieval_v2": {
    "previous": 1,
    "current": 3
  },
  "operating_system_transfer_v2": {
    "previous": 1,
    "current": 6
  },
  "what_not_to_do_mastery_v1": {
    "previous": 10,
    "current": 15
  }
} as const;

export function countsAsEditoriallyEquivalentPass(input: {
  assessmentKey: string;
  previousBankVersion: number;
  currentBankVersion: number;
  passed: boolean;
}) {
  if (!input.passed) return false;
  if (input.previousBankVersion === input.currentBankVersion) return true;
  const lineage = CAPABILITY_EDITORIAL_PASS_CONTINUITY[
    input.assessmentKey as keyof typeof CAPABILITY_EDITORIAL_PASS_CONTINUITY
  ];
  return Boolean(
    lineage &&
    lineage.previous === input.previousBankVersion &&
    lineage.current === input.currentBankVersion,
  );
}
