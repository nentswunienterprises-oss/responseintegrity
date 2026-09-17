import { computeAdaptiveDiagnosisPhaseSummary, getAdjacentDiagnosisPhase } from "./adaptiveDiagnosis";
import {
  applyInheritedVerificationGate,
  resolveInheritedVerification,
  type InheritedVerificationHold,
} from "./inheritedLayerVerification";
import {
  applyApprovedEvidenceCorrections,
  type ApprovedEvidenceCorrection,
} from "./responseIntegrityEvidenceCorrection";
import {
  projectResponseIntegrityEvidenceLedger,
  type LedgerEvidenceSet,
} from "./responseIntegrityEvidenceLedger";
import {
  applySupportConditionValidityGate,
  evaluateTrainingSupportCondition,
} from "./responseIntegritySupportValidity";
import {
  computeTransition,
  normalizeStability,
  tryParsePhase,
  type TopicPhase,
  type TopicStability,
} from "./topicConditioningEngine";

export type CorrectionReplayEventKind =
  | "training"
  | "diagnosis"
  | "inherited_verification"
  | "handover_verification";

export type CorrectionReplayEvent = {
  sourceDrillId: string;
  submittedAt: string;
  kind: CorrectionReplayEventKind;
  observedPhase: TopicPhase;
  sets: LedgerEvidenceSet[];
  corrections?: ApprovedEvidenceCorrection[];
  storedResultingPhase?: TopicPhase | null;
  storedResultingStability?: TopicStability | null;
  inheritedVerificationMode?: "verification" | "targeted_re_diagnosis" | null;
};

export type CorrectionReplayLineageEntry = {
  sourceDrillId: string;
  submittedAt: string;
  kind: CorrectionReplayEventKind;
  status: "replayed" | "skipped_invalid_after_correction" | "requires_fresh_rediagnosis";
  score: number | null;
  phaseBefore: TopicPhase;
  stabilityBefore: TopicStability;
  phaseAfter: TopicPhase;
  stabilityAfter: TopicStability;
  reason: string;
};

export type CorrectionReplayResult = {
  resultingPhase: TopicPhase;
  resultingStability: TopicStability;
  replayedEventCount: number;
  skippedEventCount: number;
  requiresFreshRediagnosis: boolean;
  pendingInheritedVerificationHold: InheritedVerificationHold | null;
  lineage: CorrectionReplayLineageEntry[];
  effectiveSetsByDrillId: Record<string, LedgerEvidenceSet[]>;
};

const clean = (value: unknown) => String(value || "").trim();

const scoreProjectedSets = (
  mode: "training" | "diagnosis" | "verification",
  phase: TopicPhase,
  sets: LedgerEvidenceSet[],
) => {
  const projected = projectResponseIntegrityEvidenceLedger({
    sourceDrillId: "correction-replay",
    studentId: "correction-replay-student",
    tutorId: "correction-replay-tutor",
    topic: "correction-replay-topic",
    sessionContext: "active_training",
    drillType: mode,
    observedPhase: phase,
    observedAt: new Date(0).toISOString(),
    sets,
  });
  if (projected.status !== "projected") {
    return {
      ok: false as const,
      score: 0,
      error: projected.status === "invalid"
        ? projected.issues.map((issue) => issue.message).join("; ")
        : "No versioned evidence was available for replay",
    };
  }
  const earned = projected.entries.reduce((sum, entry) => sum + Number(entry.scoreContribution || 0), 0);
  const possible = projected.entries.reduce((sum, entry) => sum + Number(entry.scoreContributionMax || 0), 0);
  return {
    ok: true as const,
    score: possible > 0 ? Math.max(0, Math.min(100, Math.round((earned / possible) * 100))) : 0,
    error: null,
  };
};

const applyCorrectionsForEvent = (event: CorrectionReplayEvent) => {
  const corrections = (event.corrections || []).filter((correction) => correction.sourceDrillId === event.sourceDrillId);
  if (corrections.length === 0) return { ok: true as const, sets: event.sets };
  return applyApprovedEvidenceCorrections(event.sets, corrections);
};

const firstPhaseSet = (sets: LedgerEvidenceSet[], fallback: TopicPhase) =>
  tryParsePhase(sets.find((set) => tryParsePhase(set.phase))?.phase) || fallback;

const phaseSets = (sets: LedgerEvidenceSet[], phase: TopicPhase) =>
  sets.filter((set) => (tryParsePhase(set.phase) || phase) === phase);

const replayDiagnosis = (
  event: CorrectionReplayEvent,
  sets: LedgerEvidenceSet[],
): { phase: TopicPhase; stability: TopicStability; score: number; requiresFreshRediagnosis: boolean; reason: string } => {
  let phase = firstPhaseSet(sets, event.observedPhase);
  const visited = new Set<TopicPhase>();
  let lastScore = 0;

  for (let guard = 0; guard < 8; guard += 1) {
    if (visited.has(phase)) break;
    visited.add(phase);
    const currentSets = phaseSets(sets, phase);
    const observations = currentSets.flatMap((set) => set.observations || []);
    if (observations.length === 0) {
      return {
        phase,
        stability: "Low",
        score: lastScore,
        requiresFreshRediagnosis: true,
        reason: `Correction changed diagnosis routing, but no retained ${phase} evidence exists for deterministic replacement placement.`,
      };
    }

    const summary = computeAdaptiveDiagnosisPhaseSummary(phase, observations as Array<Record<string, string>>);
    lastScore = summary.phaseScore;
    if (summary.band === "place") {
      return {
        phase,
        stability: summary.stability,
        score: summary.phaseScore,
        requiresFreshRediagnosis: false,
        reason: "Corrected adaptive diagnosis placed the topic from retained evidence.",
      };
    }

    if (summary.band === "de-escalate") {
      const previous = getAdjacentDiagnosisPhase(phase, "previous");
      if (!previous) {
        return {
          phase,
          stability: "Low",
          score: summary.phaseScore,
          requiresFreshRediagnosis: false,
          reason: "Corrected adaptive diagnosis reached the Clarity floor.",
        };
      }
      phase = previous;
      continue;
    }

    const next = getAdjacentDiagnosisPhase(phase, "next");
    if (!next) {
      return {
        phase,
        stability: "High",
        score: summary.phaseScore,
        requiresFreshRediagnosis: false,
        reason: "Corrected adaptive diagnosis reached the Time Pressure Stability ceiling.",
      };
    }
    phase = next;
  }

  return {
    phase,
    stability: "Low",
    score: lastScore,
    requiresFreshRediagnosis: true,
    reason: "Corrected adaptive diagnosis could not resolve a unique deterministic placement.",
  };
};

export const replayCorrectedTopicLineage = ({
  startingPhase,
  startingStability,
  events,
}: {
  startingPhase: TopicPhase;
  startingStability: TopicStability;
  events: CorrectionReplayEvent[];
}): CorrectionReplayResult => {
  let currentPhase = startingPhase;
  let currentStability = normalizeStability(startingStability);
  let inheritedHold: InheritedVerificationHold | null = null;
  let requiresFreshRediagnosis = false;
  let replayedEventCount = 0;
  let skippedEventCount = 0;
  const lineage: CorrectionReplayLineageEntry[] = [];
  const effectiveSetsByDrillId: Record<string, LedgerEvidenceSet[]> = {};

  const orderedEvents = [...events].sort((a, b) => {
    const timeDelta = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    return timeDelta !== 0 ? timeDelta : a.sourceDrillId.localeCompare(b.sourceDrillId);
  });

  for (const event of orderedEvents) {
    const phaseBefore = currentPhase;
    const stabilityBefore = currentStability;
    const corrected = applyCorrectionsForEvent(event);
    if (!corrected.ok) {
      throw new Error(`Correction replay failed for ${event.sourceDrillId}: ${corrected.error}`);
    }
    const sets = corrected.sets as LedgerEvidenceSet[];
    effectiveSetsByDrillId[event.sourceDrillId] = sets;

    if (requiresFreshRediagnosis) {
      skippedEventCount += 1;
      lineage.push({
        sourceDrillId: event.sourceDrillId,
        submittedAt: event.submittedAt,
        kind: event.kind,
        status: "requires_fresh_rediagnosis",
        score: null,
        phaseBefore,
        stabilityBefore,
        phaseAfter: currentPhase,
        stabilityAfter: currentStability,
        reason: "A prior corrected diagnosis no longer has enough retained evidence for deterministic placement.",
      });
      continue;
    }

    if (event.kind === "diagnosis") {
      const diagnosis = replayDiagnosis(event, sets);
      currentPhase = diagnosis.phase;
      currentStability = diagnosis.stability;
      inheritedHold = null;
      requiresFreshRediagnosis = diagnosis.requiresFreshRediagnosis;
      replayedEventCount += 1;
      lineage.push({
        sourceDrillId: event.sourceDrillId,
        submittedAt: event.submittedAt,
        kind: event.kind,
        status: diagnosis.requiresFreshRediagnosis ? "requires_fresh_rediagnosis" : "replayed",
        score: diagnosis.score,
        phaseBefore,
        stabilityBefore,
        phaseAfter: currentPhase,
        stabilityAfter: currentStability,
        reason: diagnosis.reason,
      });
      continue;
    }

    if (event.kind === "inherited_verification") {
      if (!inheritedHold || inheritedHold.targetPhase !== event.observedPhase) {
        skippedEventCount += 1;
        lineage.push({
          sourceDrillId: event.sourceDrillId,
          submittedAt: event.submittedAt,
          kind: event.kind,
          status: "skipped_invalid_after_correction",
          score: null,
          phaseBefore,
          stabilityBefore,
          phaseAfter: currentPhase,
          stabilityAfter: currentStability,
          reason: "The corrected lineage no longer contains the inherited-layer hold this verification was created to resolve.",
        });
        continue;
      }
      const scored = scoreProjectedSets("verification", event.observedPhase, sets);
      if (!scored.ok) throw new Error(scored.error);
      const resolution = resolveInheritedVerification(inheritedHold, scored.score);
      currentPhase = resolution.resultingPhase;
      currentStability = resolution.resultingStability;
      inheritedHold = resolution.holdCleared ? null : {
        ...inheritedHold,
        status: "targeted_re_diagnosis_required",
      };
      requiresFreshRediagnosis = resolution.outcome === "targeted_re_diagnosis_required";
      replayedEventCount += 1;
      lineage.push({
        sourceDrillId: event.sourceDrillId,
        submittedAt: event.submittedAt,
        kind: event.kind,
        status: requiresFreshRediagnosis ? "requires_fresh_rediagnosis" : "replayed",
        score: scored.score,
        phaseBefore,
        stabilityBefore,
        phaseAfter: currentPhase,
        stabilityAfter: currentStability,
        reason: resolution.outcome,
      });
      continue;
    }

    if (event.kind === "handover_verification") {
      if (event.observedPhase !== currentPhase) {
        skippedEventCount += 1;
        lineage.push({
          sourceDrillId: event.sourceDrillId,
          submittedAt: event.submittedAt,
          kind: event.kind,
          status: "skipped_invalid_after_correction",
          score: null,
          phaseBefore,
          stabilityBefore,
          phaseAfter: currentPhase,
          stabilityAfter: currentStability,
          reason: "The corrected topic state no longer matches the phase this handover verification observed.",
        });
        continue;
      }
      currentPhase = event.storedResultingPhase || currentPhase;
      currentStability = event.storedResultingStability || currentStability;
      replayedEventCount += 1;
      lineage.push({
        sourceDrillId: event.sourceDrillId,
        submittedAt: event.submittedAt,
        kind: event.kind,
        status: "replayed",
        score: null,
        phaseBefore,
        stabilityBefore,
        phaseAfter: currentPhase,
        stabilityAfter: currentStability,
        reason: "Retained handover verification consequence reapplied after phase-consistency validation.",
      });
      continue;
    }

    if (event.observedPhase !== currentPhase || inheritedHold) {
      skippedEventCount += 1;
      lineage.push({
        sourceDrillId: event.sourceDrillId,
        submittedAt: event.submittedAt,
        kind: event.kind,
        status: "skipped_invalid_after_correction",
        score: null,
        phaseBefore,
        stabilityBefore,
        phaseAfter: currentPhase,
        stabilityAfter: currentStability,
        reason: inheritedHold
          ? "A corrected inherited-layer hold must be resolved before later training can authorize movement."
          : "The corrected topic state no longer matches the phase under which this training evidence was collected.",
      });
      continue;
    }

    const scored = scoreProjectedSets("training", event.observedPhase, sets);
    if (!scored.ok) throw new Error(scored.error);
    const transition = computeTransition(currentPhase, currentStability, scored.score);
    const baseSummary = {
      observedPhase: currentPhase,
      previousStability: currentStability,
      phase: transition.next_phase,
      stability: transition.next_stability,
      transitionReason: transition.transition_reason,
      phaseDecision: transition.transition_reason === "phase progress"
        ? "advance" as const
        : transition.transition_reason === "stability regress"
          ? "regress" as const
          : "remain" as const,
      nextAction: null,
      constraint: null,
    };
    const supportValidity = evaluateTrainingSupportCondition(currentPhase, sets);
    const supportGated = applySupportConditionValidityGate(baseSummary, supportValidity);
    const inheritedGated = supportValidity.clean
      ? applyInheritedVerificationGate(supportGated, sets)
      : supportGated;

    currentPhase = inheritedGated.phase;
    currentStability = inheritedGated.stability;
    inheritedHold = "inheritedVerificationHold" in inheritedGated
      ? (inheritedGated.inheritedVerificationHold || null)
      : null;
    replayedEventCount += 1;
    lineage.push({
      sourceDrillId: event.sourceDrillId,
      submittedAt: event.submittedAt,
      kind: event.kind,
      status: "replayed",
      score: scored.score,
      phaseBefore,
      stabilityBefore,
      phaseAfter: currentPhase,
      stabilityAfter: currentStability,
      reason: inheritedHold
        ? "inherited_verification_required"
        : supportValidity.clean
          ? inheritedGated.transitionReason
          : `support_${supportValidity.status}`,
    });
  }

  return {
    resultingPhase: currentPhase,
    resultingStability: currentStability,
    replayedEventCount,
    skippedEventCount,
    requiresFreshRediagnosis,
    pendingInheritedVerificationHold: inheritedHold,
    lineage,
    effectiveSetsByDrillId,
  };
};
