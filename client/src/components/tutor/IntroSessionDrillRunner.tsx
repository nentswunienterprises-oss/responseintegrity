import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { observationLevelFromOptionIndex, type ObservationLevel } from "@shared/observationScoring";
import { normalizeStability, tryParsePhase } from "@shared/topicConditioningEngine";
import {
  DIAGNOSIS_OBSERVATION_MATRIX,
  type DiagnosisDimensionId,
} from "@shared/diagnosisObservationMatrix";
import { getNextActionData } from "./topicConditioningEngine";
import {
  computeAdaptiveDiagnosisPhaseSummary,
  getAdjacentDiagnosisPhase,
} from "@shared/adaptiveDiagnosis";
import {
  getDrillSchemaDefinition,
  getEvidenceSelectionIdentity,
  HANDOVER_VERIFICATION_MAX_OPPORTUNITIES,
  getFieldDefinitionForRep,
  type EvidenceDrillMode,
} from "@shared/responseIntegrityDrillRegistry";
import {
  formatSnapshotPurposeText,
  formatSnapshotRepResult,
  formatSnapshotResultText,
  type ResponseSnapshotV1,
} from "@shared/responseSnapshot";
import type { TopicReference, TopicReferenceContent } from "@shared/topicReference";
import { useStudentWorkflowState } from "@/hooks/useStudentWorkflowState";
import { supabase } from "@/lib/supabaseClient";
import { API_URL } from "@/lib/config";
import { instructionPromptDisplayText, instructionPromptLabelFor } from "@/lib/instructionPromptLabel";
import {
  TRAINING_INTERVENTION_FIELD,
  TRAINING_INTERVENTION_OPTIONS,
  TRAINING_PREREQUISITE_SENTINEL_FIELD,
  getTrainingPrerequisiteSentinelDefinition,
  resolveTrainingEvidenceEligibility,
  trainingEvidenceStatusKey,
  type TrainingEvidenceStatus,
  type TrainingInterventionEvent,
  type TrainingPrerequisiteSentinelResult,
} from "@shared/trainingEvidenceCapture";
import {
  trainingDimensionForFieldKey,
  trainingEvidenceClassForRawBehavior,
  trainingRawObservationRequiresPrerequisiteSentinel,
} from "@shared/trainingEvidenceEvaluator";
import { evaluateHandoverVerificationEvidence } from "@shared/handoverEvidenceEvaluator";
import {
  PASSIVE_EXECUTION_ATTEMPT_WIRE_KEY,
  PASSIVE_EXECUTION_TIMING_WIRE_KEY,
  TPS_TIMED_ATTEMPT_WIRE_KEY,
  TPS_TRAINING_BASELINE_SET_ID,
  buildPassiveExecutionTimingEvidence,
  encodePassiveExecutionTimingEvidence,
  encodeTpsPassiveAttemptEvidenceRef,
  encodeTpsTimedAttemptEvidenceRef,
  getTpsTrainingPressureForSet,
  type TpsPassiveAttemptSubmissionV1,
  type TpsTimedAttemptEndReason,
  type TpsTimedAttemptSubmissionV1,
  type TpsTimedPressureLevel,
  type TpsTimedTrainingSetId,
} from "@shared/tpsTimingContract";

type PhaseLabel = "Clarity" | "Structured Execution" | "Controlled Discomfort" | "Time Pressure Stability";
type DrillMode = "diagnosis" | "training" | "session" | "handover";
type ObservationField = {
  key: string;
  label: string;
  options: string[];
  observationQuestion?: string;
  optionLevels?: Record<string, ObservationLevel>;
  optionDetails?: Record<string, string>;
};
type DrillSetConfig = {
  setName: string;
  reps: number;
  purpose: string;
  repInstruction: string;
  isModelingSet?: boolean;
  activeRules: string[];
  observationBlock?: ObservationField[];
  repObservationBlocks?: ObservationField[][];
};

type VerificationPrepSpec = {
  title: string;
  objective: string;
  problemPlan: string;
  problemCoverage?: string[];
  totalProblems?: number;
  tutorRules: string[];
  derivedFrom: string;
  checklist: string[];
};

type HandoverEvidenceSummary = Extract<
  ReturnType<typeof evaluateHandoverVerificationEvidence>,
  { status: "evaluated" }
> & {
  verificationOutcomeLabel?: string;
  evidenceReason?: string;
  nextAction?: string;
  constraint?: string | null;
};

type AdaptiveTransitionState = {
  currentPhase: PhaseLabel;
  nextPhase: PhaseLabel;
  phaseScore: number;
  direction: "escalate" | "de-escalate";
  currentBlock: {
    phase: PhaseLabel;
    setName: string;
    setId?: string;
    setOrder?: number;
    drillSchemaId?: string;
    drillSchemaVersion?: number;
    drillDefinitionHash?: string;
    observations: Array<Record<string, string>>;
  };
};

function describeTrainingEvidenceOption(fieldKey: string, option: string) {
  const dimensionId = trainingDimensionForFieldKey(fieldKey);
  const evidenceClass = dimensionId
    ? trainingEvidenceClassForRawBehavior(dimensionId, option)
    : null;

  if (evidenceClass === "breakdown") {
    return "Breakdown evidence: the phase-defining behavior broke under this training condition.";
  }
  if (evidenceClass === "conditional") {
    return "Conditional evidence: the capability appeared, but it was incomplete, support-sensitive, or unstable.";
  }
  if (evidenceClass === "near_stable") {
    return "Near-stable evidence: the response mostly held, with a recoverable limitation.";
  }
  if (evidenceClass === "supported") {
    return "Supported evidence: the behavior held under the current training condition.";
  }

  return null;
}

function describeTrainingObservationQuestion(fieldKey: string, label: string) {
  if (fieldKey === "repeatability" && label.includes("Step Statement Accuracy")) {
    return "How accurate was the student's stated step plan before solving?";
  }

  const questions: Record<string, string> = {
    vocabulary: "How did the student recognize the problem type or required vocabulary?",
    method: "How did the student recall and use the required steps?",
    reason: "How did the student explain why the method works?",
    immediateApply: "How did the student respond when asked to use the understanding?",
    startBehavior: "How did the student start this rep?",
    stepExecution: "How did the student execute the steps?",
    repeatability: "How consistently did the structure hold?",
    independence: "How much support did the student need after the rep began?",
    initialResponse: "How did the student respond to the difficulty at first contact?",
    firstStepControl: "How controlled and accurate was the first step?",
    discomfortTolerance: "How stable was the student under discomfort?",
    rescueDependence: "How much did the student seek rescue?",
    startUnderTime: "How did the student start under time pressure?",
    structureUnderTime: "How well did structure hold under time pressure?",
    paceControl: "How controlled was the student's pace?",
    completionIntegrity: "How intact was completion under the constraint?",
  };

  if (questions[fieldKey]) return questions[fieldKey];

  const compactLabel = label.replace(/\s*\(Rep\s+\d+[^)]*\)/gi, "").trim();
  return `What did the student actually show for ${compactLabel}?`;
}

function explainAdaptiveTransition(
  currentPhase: PhaseLabel,
  nextPhase: PhaseLabel,
  direction: "escalate" | "de-escalate",
) {
  if (direction === "escalate") {
    return `The student is already looking strong in ${currentPhase}, so the system is moving up to check how they hold in ${nextPhase}.`;
  }

  return `The student is not holding cleanly enough in ${currentPhase}, so the system is dropping down to ${nextPhase} to find the correct entry point.`;
}

type StudentListEntry = {
  id: string | number;
  fullName?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type TopicConditioningRow = {
  topic: string;
  phase: string;
  stability: string;
  topicReference?: TopicReference | null;
  requiresTargetedRediagnosis?: boolean;
  targetedRediagnosisStartPhase?: string | null;
  timingReadiness?: {
    status: "not_required" | "ready" | "targeted_rediagnosis";
    issueCode: string | null;
    contractId: string | null;
    baselineSeconds: number | null;
    reason: string | null;
  };
};

type TpsTimerContractView = {
  contractId: string;
  version: 1;
  topic: string;
  baselineSource: string;
  baselineSourceEpochKey: string;
  baselineSeconds: number;
  structureUnderTimerSeconds: number;
  repeatedTimedExecutionSeconds: number;
  fullConstraintSeconds: number;
};

type TpsActivePassiveAttempt = {
  attemptId: string;
  sourceContextId: string;
  sourceItemId: string;
  slotNumber: number;
  attemptNumber: number;
  startedAt: string;
  replacementForAttemptId: string | null;
  frozenAttempt: TpsPassiveAttemptSubmissionV1 | null;
};

type TpsActiveAttempt = {
  attemptId: string;
  setId: TpsTimedTrainingSetId;
  setName: string;
  repNumber: number;
  attemptNumber: number;
  pressureLevel: TpsTimedPressureLevel;
  prescribedSeconds: number;
  startedAt: string;
  replacementForAttemptId: string | null;
  frozenAttempt: TpsTimedAttemptSubmissionV1 | null;
};

type TpsReplacementState = {
  nextAttemptNumber: number;
  replacementForAttemptId: string;
};

const TPS_TIMER_BASELINE_INCOMPLETE = "TPS_TIMER_BASELINE_INCOMPLETE";

const prescribedSecondsForTpsPressure = (
  contract: TpsTimerContractView,
  pressureLevel: TpsTimedPressureLevel,
) => {
  if (pressureLevel === "light_timer") return contract.structureUnderTimerSeconds;
  if (pressureLevel === "repeated_timer") return contract.repeatedTimedExecutionSeconds;
  return contract.fullConstraintSeconds;
};

const formatCountdownSeconds = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, "0")}`
    : `${seconds}s`;
};

const createTpsAttemptId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `ri-tps-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const EMPTY_TOPIC_REFERENCE: TopicReferenceContent = {
  vocabulary: "",
  method: "",
  steps: "",
  reason: "",
};

const PHASE_CONTEXT: Record<PhaseLabel, { purpose: string; constraints: string[] }> = {
  Clarity: {
    purpose: "Can the student see the problem clearly before solving? Clarity is naming what's there, recognizing the method, understanding why. If this fails - everything else collapses.",
    constraints: ["No Boss Battles", "No time pressure", "No skipping layers"],
  },
  "Structured Execution": {
    purpose: "Test and build ability to execute the known method independently. Student knows - now prove they can do it alone, repeatably.",
    constraints: ["State steps before solving", "No guessing tolerated", "No skipping steps"],
  },
  "Controlled Discomfort": {
    purpose: "Test and stabilize behavior under uncertainty and difficulty. Does the student persist - or shut down?",
    constraints: ["No full rescue", "Hold discomfort window", "One-step confirmation max"],
  },
  "Time Pressure Stability": {
    purpose: "Maintain method structure under urgency. Structure is the target - speed is secondary.",
    constraints: ["Method over speed", "Timer is active", "Structured response required - panic responding is logged as instability."],
  },
};

// ---------------------------------------------------------------------------
// DRILL SET CONFIGURATIONS
// Each set carries: purpose (why), repInstruction (what the Specialist says/does),
// activeRules (constraints live during this set), and per-rep observation blocks.
// ---------------------------------------------------------------------------
const DIAGNOSIS_SETS_BY_PHASE: Record<PhaseLabel, DrillSetConfig[]> = {
  Clarity: [
    {
      setName: "Recognition Probe",
      reps: 3,
      purpose: "Student does NOT solve. Tests vocabulary, type recognition, and step awareness only.",
      repInstruction: "Show the problem. Ask student to name terms, identify type, and state the steps. Do not let them solve.",
      activeRules: ["Student does not solve", "Recognition only - no execution", "No hints or steps from Specialist"],
      repObservationBlocks: [
        [
          { key: "vocabulary", label: "Vocabulary (Rep 1 - Cold Name)", options: ["cannot name", "partial", "clear"] },
          { key: "method", label: "Type Recognition (Rep 1)", options: ["wrong", "hesitant", "correct"] },
          { key: "reason", label: "Step Awareness (Rep 1)", options: ["none", "partial", "clear"] },
          { key: "immediateApply", label: "First Response (Rep 1)", options: ["avoids", "unsure", "engages"] },
        ],
        [
          { key: "vocabulary", label: "Vocabulary (Rep 2 - Second Look)", options: ["cannot name", "partial", "clear"] },
          { key: "method", label: "Method Recognition (Rep 2)", options: ["wrong", "hesitant", "correct"] },
          { key: "reason", label: "Can They State Steps? (Rep 2)", options: ["none", "partial", "clear"] },
          { key: "immediateApply", label: "Willingness to Try (Rep 2)", options: ["avoids", "unsure", "engages"] },
        ],
        [
          { key: "vocabulary", label: "Vocabulary (Rep 3 - Confirm)", options: ["cannot name", "partial", "clear"] },
          { key: "method", label: "Method Recall (Rep 3)", options: ["wrong", "hesitant", "correct"] },
          { key: "reason", label: "Can They Explain Why? (Rep 3)", options: ["none", "partial", "clear"] },
          { key: "immediateApply", label: "Confidence Signal (Rep 3)", options: ["avoids", "unsure", "engages"] },
        ],
      ],
    },
    {
      setName: "Light Apply Probe",
      reps: 3,
      purpose: "Student solves with minimal help. Tests start behavior, structure, and clarity carryover.",
      repInstruction: "Ask student to solve. Minimal guidance only. Observe start behavior and step discipline.",
      activeRules: ["Minimal guidance only", "No step-by-step help", "Observe independent start and execution"],
      repObservationBlocks: [
        [
          { key: "vocabulary", label: "Vocabulary in Context (Rep 1 - First Attempt)", options: ["incorrect", "partial", "correct"] },
          { key: "method", label: "Step Execution (Rep 1)", options: ["random", "partial", "structured"] },
          { key: "reason", label: "Reason Awareness (Rep 1)", options: ["none", "weak", "present"] },
          { key: "immediateApply", label: "Start Behavior (Rep 1)", options: ["cannot start", "delayed", "starts"] },
        ],
        [
          { key: "vocabulary", label: "Vocabulary in Context (Rep 2 - With Feedback)", options: ["incorrect", "partial", "correct"] },
          { key: "method", label: "Step Discipline (Rep 2)", options: ["random", "partial", "structured"] },
          { key: "reason", label: "Reason Application (Rep 2)", options: ["none", "weak", "present"] },
          { key: "immediateApply", label: "Start After Feedback (Rep 2)", options: ["cannot start", "delayed", "starts"] },
        ],
        [
          { key: "vocabulary", label: "Vocabulary in Context (Rep 3 - Independence Check)", options: ["incorrect", "partial", "correct"] },
          { key: "method", label: "Step Consistency (Rep 3)", options: ["random", "partial", "structured"] },
          { key: "reason", label: "Reason Retention (Rep 3)", options: ["none", "weak", "present"] },
          { key: "immediateApply", label: "Independent Start (Rep 3)", options: ["cannot start", "delayed", "starts"] },
        ],
      ],
    },
  ],
  "Structured Execution": [
    {
      setName: "Start + Structure",
      reps: 3,
      purpose: "Test ability to execute from a cold start with no assistance. Observe whether structure exists from the first move.",
      repInstruction: "Solve the problem. No help for 10 seconds.",
      activeRules: ["No help for 10 seconds", "Observe cold start behavior", "Record exactly what happens - no prompting"],
      repObservationBlocks: [
        [
          { key: "startBehavior", label: "Cold Start (Rep 1)", options: ["avoids", "delayed", "immediate"] },
          { key: "stepExecution", label: "First Step Attempt (Rep 1)", options: ["random / guessing", "partial steps", "full structure"] },
          { key: "repeatability", label: "Step Order (Rep 1)", options: ["incorrect", "minor errors", "correct"] },
          { key: "independence", label: "Help-Seeking (Rep 1)", options: ["waits for help", "asks after trying", "independent"] },
        ],
        [
          { key: "startBehavior", label: "Start Under Observation (Rep 2)", options: ["avoids", "delayed", "immediate"] },
          { key: "stepExecution", label: "Mid-Execution Discipline (Rep 2)", options: ["random / guessing", "partial steps", "full structure"] },
          { key: "repeatability", label: "Correction Response (Rep 2)", options: ["incorrect", "minor errors", "correct"] },
          { key: "independence", label: "Dependence Pattern (Rep 2)", options: ["waits for help", "asks after trying", "independent"] },
        ],
        [
          { key: "startBehavior", label: "Completion Start (Rep 3)", options: ["avoids", "delayed", "immediate"] },
          { key: "stepExecution", label: "Full Execution (Rep 3)", options: ["random / guessing", "partial steps", "full structure"] },
          { key: "repeatability", label: "Final Step Order (Rep 3)", options: ["incorrect", "minor errors", "correct"] },
          { key: "independence", label: "Can They Finish Alone? (Rep 3)", options: ["waits for help", "asks after trying", "independent"] },
        ],
      ],
    },
    {
      setName: "Repeatability",
      reps: 3,
      purpose: "Test whether execution holds across similar problems without breaking down.",
      repInstruction: "Solve similar problem.",
      activeRules: ["Similar problem - same method", "No step-by-step guidance", "Observe consistency across reps"],
      repObservationBlocks: [
        [
          { key: "repeatability", label: "First Repeat - Consistency (Rep 1)", options: ["breaks each time", "inconsistent", "stable"] },
          { key: "stepExecution", label: "Step Recall (Rep 1)", options: ["forgets", "partial", "full"] },
          { key: "independence", label: "Error Type (Rep 1)", options: ["guessing", "careless", "structured"] },
          { key: "startBehavior", label: "Completion (Rep 1)", options: ["cannot finish", "partial", "complete"] },
        ],
        [
          { key: "repeatability", label: "Second Repeat - Pattern (Rep 2)", options: ["breaks each time", "inconsistent", "stable"] },
          { key: "stepExecution", label: "Step Retention (Rep 2)", options: ["forgets", "partial", "full"] },
          {
            key: "independence",
            label: "Self-Correction (Rep 2)",
            options: ["guessing", "careless", "structured", "no correction needed"],
            optionLevels: {
              guessing: "weak",
              careless: "partial",
              structured: "clear",
              "no correction needed": "clear",
            },
          },
          { key: "startBehavior", label: "Completion (Rep 2)", options: ["cannot finish", "partial", "complete"] },
        ],
        [
          { key: "repeatability", label: "Third Repeat - Final Stability (Rep 3)", options: ["breaks each time", "inconsistent", "stable"] },
          { key: "stepExecution", label: "Step Reliability (Rep 3)", options: ["forgets", "partial", "full"] },
          { key: "independence", label: "Independence Signal (Rep 3)", options: ["guessing", "careless", "structured"] },
          { key: "startBehavior", label: "Completion (Rep 3)", options: ["cannot finish", "partial", "complete"] },
        ],
      ],
    },
  ],
  "Controlled Discomfort": [
    {
      setName: "First Contact",
      reps: 3,
      purpose: "Test initial response to difficulty under a no-help condition. What does the student do first?",
      repInstruction: "Try this. No help for 10 seconds.",
      activeRules: ["No help for 10 seconds", "Hold the discomfort window", "Do not rescue - observe"],
      repObservationBlocks: [
        [
          { key: "initialResponse", label: "Immediate Reaction (Rep 1 - Cold Contact)", options: ["freeze", "hesitate", "attempt"] },
          { key: "firstStepControl", label: "First Step Without Prompt (Rep 1)", options: ["none", "prompted", "independent"] },
          { key: "discomfortTolerance", label: "Emotional State (Rep 1)", options: ["panic", "tension", "controlled"] },
          { key: "rescueDependence", label: "Rescue Seeking (Rep 1)", options: ["asks immediately", "asks later", "no rescue"] },
        ],
        [
          { key: "initialResponse", label: "Persistence Under Hold (Rep 2)", options: ["freeze", "hesitate", "attempt"] },
          { key: "firstStepControl", label: "Step Control Maintained? (Rep 2)", options: ["none", "prompted", "independent"] },
          { key: "discomfortTolerance", label: "Tolerance Window (Rep 2)", options: ["panic", "tension", "controlled"] },
          { key: "rescueDependence", label: "Rescue Pattern (Rep 2)", options: ["asks immediately", "asks later", "no rescue"] },
        ],
        [
          { key: "initialResponse", label: "Re-engagement After Struggle (Rep 3)", options: ["freeze", "hesitate", "attempt"] },
          { key: "firstStepControl", label: "Reentry After Struggle (Rep 3)", options: ["none", "prompted", "independent"] },
          { key: "discomfortTolerance", label: "Final Stability (Rep 3)", options: ["panic", "tension", "controlled"] },
          { key: "rescueDependence", label: "Final Rescue Check (Rep 3)", options: ["asks immediately", "asks later", "no rescue"] },
        ],
      ],
    },
    {
      setName: "Pressure Hold",
      reps: 3,
      purpose: "Test sustained engagement under difficulty. Can the student persist without rescue?",
      repInstruction: "Continue. I will only confirm the first step.",
      activeRules: ["One-step confirmation only", "No rescue allowed", "Hold pressure - do not relieve it"],
      repObservationBlocks: [
        [
          { key: "discomfortTolerance", label: "Sustained Engagement (Rep 1)", options: ["gives up", "short attempt", "stays engaged"] },
          { key: "rescueDependence", label: "Rescue Under Sustained Hold (Rep 1)", options: ["asks immediately", "asks later", "no rescue"] },
          { key: "firstStepControl", label: "Structure Retention (Rep 1)", options: ["breaks", "partial", "maintained"] },
          {
            key: "initialResponse",
            label: "Recovery After Struggle (Rep 1)",
            options: ["collapses", "partial", "recovers", "no recovery needed"],
            optionLevels: {
              collapses: "weak",
              partial: "partial",
              recovers: "clear",
              "no recovery needed": "clear",
            },
          },
        ],
        [
          { key: "discomfortTolerance", label: "Tolerance Ceiling (Rep 2)", options: ["gives up", "short attempt", "stays engaged"] },
          { key: "rescueDependence", label: "Rescue Pattern (Rep 2)", options: ["asks immediately", "asks later", "no rescue"] },
          { key: "firstStepControl", label: "Can Still Sequence? (Rep 2)", options: ["breaks", "partial", "maintained"] },
          { key: "initialResponse", label: "Composed or Reactive? (Rep 2)", options: ["collapses", "partial", "recovers"] },
        ],
        [
          { key: "discomfortTolerance", label: "Final Hold - Stability (Rep 3)", options: ["gives up", "short attempt", "stays engaged"] },
          { key: "rescueDependence", label: "Final Rescue Check (Rep 3)", options: ["asks immediately", "asks later", "no rescue"] },
          { key: "firstStepControl", label: "Structure Under Max Pressure (Rep 3)", options: ["breaks", "partial", "maintained"] },
          {
            key: "initialResponse",
            label: "Final Recovery (Rep 3)",
            options: ["collapses", "partial", "recovers", "no recovery needed"],
            optionLevels: {
              collapses: "weak",
              partial: "partial",
              recovers: "clear",
              "no recovery needed": "clear",
            },
          },
        ],
      ],
    },
  ],
  "Time Pressure Stability": [
    {
      setName: "Light Timer",
      reps: 3,
      purpose: "Test structure and start behavior under a timer. First exposure to time constraint.",
      repInstruction: "Solve under short timer.",
      activeRules: ["Timer is active", "Observe structure - not just speed", "Record panic vs controlled response"],
      repObservationBlocks: [
        [
          { key: "startUnderTime", label: "First Time Exposure - Start (Rep 1)", options: ["freeze", "delayed", "immediate"] },
          { key: "structureUnderTime", label: "Structure on First Timer (Rep 1)", options: ["breaks", "partial", "maintained"] },
          { key: "paceControl", label: "Pace Reaction (Rep 1)", options: ["panic", "rushed", "controlled"] },
          { key: "completionIntegrity", label: "Completion Under Time (Rep 1)", options: ["fails", "partial", "complete"] },
        ],
        [
          { key: "startUnderTime", label: "Start - Adjusted? (Rep 2)", options: ["freeze", "delayed", "immediate"] },
          { key: "structureUnderTime", label: "Structure Mid-Timer (Rep 2)", options: ["breaks", "partial", "maintained"] },
          { key: "paceControl", label: "Pace Regulation (Rep 2)", options: ["panic", "rushed", "controlled"] },
          { key: "completionIntegrity", label: "Completion Quality (Rep 2)", options: ["fails", "partial", "complete"] },
        ],
        [
          { key: "startUnderTime", label: "Start - Consistent? (Rep 3)", options: ["freeze", "delayed", "immediate"] },
          { key: "structureUnderTime", label: "Structure Integrity (Rep 3)", options: ["breaks", "partial", "maintained"] },
          { key: "paceControl", label: "Final Pace Control (Rep 3)", options: ["panic", "rushed", "controlled"] },
          { key: "completionIntegrity", label: "Final Completion (Rep 3)", options: ["fails", "partial", "complete"] },
        ],
      ],
    },
    {
      setName: "Consistency",
      reps: 3,
      purpose: "Test whether structure holds across repeated timed attempts. Look for drift.",
      repInstruction: "Repeat under same time constraint.",
      activeRules: ["Same timer", "Observe drift and consistency", "Behavioral pattern - not just completion"],
      repObservationBlocks: [
        [
          { key: "completionIntegrity", label: "Repeat 1 - Consistency Signal", options: ["collapses", "inconsistent", "stable"] },
          { key: "startUnderTime", label: "Behavior Pattern (Rep 1)", options: ["panic", "tension", "composed"] },
          { key: "structureUnderTime", label: "Structure Repeat 1", options: ["breaks", "partial", "maintained"] },
          { key: "paceControl", label: "Pace Pattern (Rep 1)", options: ["rushed", "uneven", "controlled"] },
        ],
        [
          { key: "completionIntegrity", label: "Repeat 2 - Holding? (Rep 2)", options: ["collapses", "inconsistent", "stable"] },
          { key: "startUnderTime", label: "Behavioral Drift (Rep 2)", options: ["panic", "tension", "composed"] },
          { key: "structureUnderTime", label: "Structure Stability (Rep 2)", options: ["breaks", "partial", "maintained"] },
          { key: "paceControl", label: "Pace Discipline (Rep 2)", options: ["rushed", "uneven", "controlled"] },
        ],
        [
          { key: "completionIntegrity", label: "Repeat 3 - Final Stability (Rep 3)", options: ["collapses", "inconsistent", "stable"] },
          { key: "startUnderTime", label: "Final Behavior (Rep 3)", options: ["panic", "tension", "composed"] },
          { key: "structureUnderTime", label: "Final Structure (Rep 3)", options: ["breaks", "partial", "maintained"] },
          { key: "paceControl", label: "Final Pace (Rep 3)", options: ["rushed", "uneven", "controlled"] },
        ],
      ],
    },
  ],
};

const TRAINING_SETS_BY_PHASE: Record<PhaseLabel, DrillSetConfig[]> = {
  Clarity: [
    {
      setName: "Modeling",
      reps: 1,
      purpose: "Build the mental map before drilling.",
      repInstruction: "Teach Vocabulary → Recognition / Method → Ordered Steps → Reason, then ask the student to explain back.",
      isModelingSet: true,
      activeRules: ["Specialist models - student does NOT solve", "Vocabulary → Recognition / Method → Ordered Steps → Reason sequence", "Ask student to explain back after each model"],
    },
    {
      setName: "Identification",
      reps: 3,
      purpose: "Recognition without solving. Student names terms, identifies type, states steps, explains why.",
      repInstruction: "Show the problem. Ask student to: name the terms, identify the type, state the steps, explain why it works. No solving allowed.",
      activeRules: ["No solving allowed", "Push for vocabulary precision", "All 4 layers: terms, type, steps, reason"],
      repObservationBlocks: [
        [
          { key: "vocabulary", label: "Type Recognition (Rep 1)", options: ["wrong", "hesitant", "correct"] },
          { key: "method", label: "Step Recall (Rep 1)", options: ["missing", "partial", "clear"] },
          { key: "reason", label: "Reason Recall (Rep 1)", options: ["none", "weak", "clear"] },
          { key: "immediateApply", label: "Response Behavior (Rep 1)", options: ["avoids answering", "unsure but tries", "confident"] },
        ],
        [
          { key: "vocabulary", label: "Type Recognition (Rep 2)", options: ["wrong", "hesitant", "correct"] },
          { key: "method", label: "Step Recall (Rep 2)", options: ["missing", "partial", "clear"] },
          { key: "reason", label: "Reason Recall (Rep 2)", options: ["none", "weak", "clear"] },
          { key: "immediateApply", label: "Response Behavior (Rep 2)", options: ["avoids answering", "unsure but tries", "confident"] },
        ],
        [
          { key: "vocabulary", label: "Type Recognition (Rep 3)", options: ["wrong", "hesitant", "correct"] },
          { key: "method", label: "Step Recall (Rep 3)", options: ["missing", "partial", "clear"] },
          { key: "reason", label: "Reason Recall (Rep 3)", options: ["none", "weak", "clear"] },
          { key: "immediateApply", label: "Response Behavior (Rep 3)", options: ["avoids answering", "unsure but tries", "confident"] },
        ],
      ],
    },
    {
      setName: "Light Apply",
      reps: 3,
      purpose: "Test clarity under active solving. Minimal guidance only. Observe whether clarity holds when they execute.",
      repInstruction: "Ask student to solve. Minimal guidance. Observe clarity under execution.",
      activeRules: ["Minimal guidance only", "No step-by-step help", "Observe independent start and execution"],
      repObservationBlocks: [
        [
          { key: "vocabulary", label: "Vocabulary Usage (Rep 1)", options: ["incorrect", "partial", "correct"] },
          { key: "method", label: "Step Execution (Rep 1)", options: ["skips", "inconsistent", "structured"] },
          { key: "reason", label: "Reason Usage (Rep 1)", options: ["absent", "weak", "present"] },
          { key: "immediateApply", label: "Start Behavior (Rep 1)", options: ["delayed", "hesitant", "immediate"] },
        ],
        [
          { key: "vocabulary", label: "Vocabulary Usage (Rep 2)", options: ["incorrect", "partial", "correct"] },
          { key: "method", label: "Step Execution (Rep 2)", options: ["skips", "inconsistent", "structured"] },
          { key: "reason", label: "Reason Usage (Rep 2)", options: ["absent", "weak", "present"] },
          { key: "immediateApply", label: "Start Behavior (Rep 2)", options: ["delayed", "hesitant", "immediate"] },
        ],
        [
          { key: "vocabulary", label: "Vocabulary Usage (Rep 3)", options: ["incorrect", "partial", "correct"] },
          { key: "method", label: "Step Execution (Rep 3)", options: ["skips", "inconsistent", "structured"] },
          { key: "reason", label: "Reason Usage (Rep 3)", options: ["absent", "weak", "present"] },
          { key: "immediateApply", label: "Start Behavior (Rep 3)", options: ["delayed", "hesitant", "immediate"] },
        ],
      ],
    },
  ],
  "Structured Execution": [
    {
      setName: "Required Structure",
      reps: 3,
      purpose: "Train ordered execution without turning the rep into a diagnosis probe. Student states the step order first, then solves using that order.",
      repInstruction: "Before you solve, tell me the steps you will follow. Then solve using those steps.",
      activeRules: ["Student states step order before solving", "Specialist does not supply the steps", "Student solves using the stated order"],
      observationBlock: [
        { key: "startBehavior", label: "Start", options: ["delayed", "hesitant", "immediate"] },
        {
          key: "repeatability",
          label: "Step Statement Accuracy",
          options: ["missing", "out of order", "mostly accurate", "accurate"],
          optionLevels: {
            missing: "weak",
            "out of order": "partial",
            "mostly accurate": "clear",
            accurate: "clear",
          },
        },
        { key: "stepExecution", label: "Step Discipline", options: ["skips", "partial", "full"] },
        { key: "independence", label: "Student Independence After Start", options: ["needs help", "light support", "independent"] },
      ],
    },
    {
      setName: "Independent Execution",
      reps: 3,
      purpose: "Full independent execution without any help. Build consistent, repeatable execution.",
      repInstruction: "Solve independently.",
      activeRules: ["No help from Specialist", "Full independence expected", "Observe repeatability and step discipline"],
      observationBlock: [
        { key: "independence", label: "Independence", options: ["needs help", "light support", "independent"] },
        { key: "repeatability", label: "Repeatability", options: ["breaks", "inconsistent", "stable"] },
        {
          key: "stepExecution",
          label: "Step Discipline",
          options: ["guesses", "partial correction", "structured correction", "no correction needed"],
          optionLevels: {
            guesses: "weak",
            "partial correction": "partial",
            "structured correction": "clear",
            "no correction needed": "clear",
          },
        },
        { key: "startBehavior", label: "Start", options: ["delayed", "hesitant", "immediate"] },
      ],
    },
    {
      setName: "Variation Control",
      reps: 3,
      purpose: "Test transfer. Student adapts to a slightly different form using the same method. Method must survive variation.",
      repInstruction: "Solve slightly different form.",
      activeRules: ["Same method - different form", "Test transfer not memorization", "No hints on what changed"],
      observationBlock: [
        { key: "stepExecution", label: "Transfer", options: ["cannot adapt", "partial", "adapts"] },
        { key: "repeatability", label: "Step Retention", options: ["lost", "partial", "stable"] },
        { key: "independence", label: "Independence", options: ["fails", "partial", "complete"] },
        { key: "startBehavior", label: "Start", options: ["delayed", "hesitant", "immediate"] },
      ],
    },
  ],
  "Controlled Discomfort": [
    {
      setName: "Controlled Entry",
      reps: 3,
      purpose: "Build controlled entry under difficulty. Force a pause before the first action.",
      repInstruction: "Pause. Then state the first step.",
      activeRules: ["Force a pause before starting", "First step must be stated out loud", "Do not let them jump in"],
      observationBlock: [
        { key: "initialResponse", label: "Start Control", options: ["freeze", "hesitant", "controlled"] },
        { key: "firstStepControl", label: "First-Step Accuracy", options: ["wrong", "partial", "correct"] },
        { key: "discomfortTolerance", label: "Stability", options: ["breaks", "unstable", "stable"] },
        { key: "rescueDependence", label: "Rescue Behavior", options: ["frequent", "occasional", "none"] },
      ],
    },
    {
      setName: "No Rescue",
      reps: 3,
      purpose: "Build independence under difficulty. No rescue under any circumstance.",
      repInstruction: "Continue. No full help.",
      activeRules: ["No rescue allowed", "Hold the hold - do not relieve", "Observe rescue-seeking pattern"],
      observationBlock: [
        { key: "rescueDependence", label: "Independence", options: ["dependent", "partial", "independent"] },
        { key: "discomfortTolerance", label: "Stability", options: ["breaks", "unstable", "stable"] },
        {
          key: "initialResponse",
          label: "Recovery",
          options: ["collapses", "partial", "recovers", "no recovery needed"],
          optionLevels: {
            collapses: "weak",
            partial: "partial",
            recovers: "clear",
            "no recovery needed": "clear",
          },
        },
        { key: "firstStepControl", label: "First-Step Control", options: ["none", "prompted", "independent"] },
      ],
    },
    {
      setName: "Repeat Exposure",
      reps: 3,
      purpose: "Repeat exposure to build tolerance. Same difficulty level. The target is stability - not just survival.",
      repInstruction: "Another similar difficulty.",
      activeRules: ["Same difficulty level", "Repeat exposure - build tolerance", "Observe consistency of response"],
      observationBlock: [
        { key: "discomfortTolerance", label: "Consistency", options: ["breaks", "inconsistent", "stable"] },
        {
          key: "initialResponse",
          label: "Recovery",
          options: ["collapses", "partial", "recovers", "no recovery needed"],
          optionLevels: {
            collapses: "weak",
            partial: "partial",
            recovers: "clear",
            "no recovery needed": "clear",
          },
        },
        { key: "rescueDependence", label: "Rescue Behavior", options: ["frequent", "occasional", "none"] },
        { key: "firstStepControl", label: "First-Step Control", options: ["none", "prompted", "independent"] },
      ],
    },
  ],
  "Time Pressure Stability": [
    {
      setName: "Structure Under Timer",
      reps: 3,
      purpose: "Build structured execution under a timer. Method is priority - speed is secondary.",
      repInstruction: "Focus on method, not speed.",
      activeRules: ["Timer active", "Method priority - not speed", "Structure must be maintained throughout"],
      observationBlock: [
        { key: "startUnderTime", label: "Start", options: ["panic", "hesitant", "controlled"] },
        { key: "structureUnderTime", label: "Structure", options: ["lost", "partial", "maintained"] },
        { key: "paceControl", label: "Pace", options: ["rushed", "uneven", "controlled"] },
        { key: "completionIntegrity", label: "Completion", options: ["fails", "partial", "complete"] },
      ],
    },
    {
      setName: "Repeated Timed Execution",
      reps: 3,
      purpose: "Build consistency under repeated timed execution. Same constraint - look for drift.",
      repInstruction: "Repeat under timer.",
      activeRules: ["Same timer constraint", "Build consistency - not just completion", "Observe pace regulation"],
      observationBlock: [
        { key: "completionIntegrity", label: "Consistency", options: ["breaks", "inconsistent", "stable"] },
        { key: "paceControl", label: "Pace", options: ["rushed", "uneven", "controlled"] },
        { key: "structureUnderTime", label: "Structure", options: ["lost", "partial", "maintained"] },
        { key: "startUnderTime", label: "Start", options: ["panic", "hesitant", "controlled"] },
      ],
    },
    {
      setName: "Full Constraint",
      reps: 3,
      purpose: "Full constraint drill. Tighter time - structure and completion integrity both tested.",
      repInstruction: "Solve under tighter time.",
      activeRules: ["Tighter timer", "Full constraint - no relief", "Structure + completion both required"],
      observationBlock: [
        { key: "completionIntegrity", label: "Completion", options: ["fails", "partial", "complete"] },
        { key: "structureUnderTime", label: "Integrity", options: ["collapses", "unstable", "stable"] },
        { key: "paceControl", label: "Pace", options: ["rushed", "uneven", "controlled"] },
        { key: "startUnderTime", label: "Start", options: ["panic", "hesitant", "controlled"] },
      ],
    },
  ],
};

const ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE: Record<PhaseLabel, DrillSetConfig> = {
  Clarity: DIAGNOSIS_SETS_BY_PHASE.Clarity[0],
  "Structured Execution": DIAGNOSIS_SETS_BY_PHASE["Structured Execution"][0],
  "Controlled Discomfort": DIAGNOSIS_SETS_BY_PHASE["Controlled Discomfort"][0],
  "Time Pressure Stability": DIAGNOSIS_SETS_BY_PHASE["Time Pressure Stability"][0],
};

function normalizePhase(value: string | null): PhaseLabel {
  return tryParsePhase(value) || "Clarity";
}

function buildDrillStructure(mode: DrillMode, phase: PhaseLabel) {
  if (mode === "training") {
    return TRAINING_SETS_BY_PHASE[phase];
  }
  if (mode === "handover") {
    const inheritedProbe = ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE[phase];
    return [{
      ...inheritedProbe,
      reps: HANDOVER_VERIFICATION_MAX_OPPORTUNITIES,
      purpose: `Continuity verification only. Verify whether the inherited ${phase} state remains trustworthy without training or progressing the student.`,
      repInstruction: "Present one clean continuity opportunity under the inherited phase conditions. Observe the response without teaching through it.",
    }];
  }
  return DIAGNOSIS_SETS_BY_PHASE[phase];
}

function buildVerificationPrepSpec(
  phase: PhaseLabel,
  mode: "diagnosis" | "handover" | "handover_rediagnosis"
): VerificationPrepSpec {
  const diagnosisBlock = ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE[phase];
  const trainingSets = TRAINING_SETS_BY_PHASE[phase];
  const trainingReference = trainingSets
    .map((set) => set.setName)
    .join(" -> ");
  const phasePurpose = PHASE_CONTEXT[phase].purpose;
  const phaseRules = PHASE_CONTEXT[phase].constraints;
  const verificationRules = diagnosisBlock.activeRules;
  const previousPhase = getAdjacentDiagnosisPhase(phase, "previous");
  const nextPhase = getAdjacentDiagnosisPhase(phase, "next");
  const adaptiveCoverage = [previousPhase, phase, nextPhase].filter(Boolean) as PhaseLabel[];
  const adaptiveCoverageNotes = adaptiveCoverage
    .map((coveragePhase) => {
      const coverageBlock = ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE[coveragePhase];
      return `${coveragePhase}: ${coverageBlock.reps} ${coverageBlock.setName} problems`;
    });
  const adaptiveCoverageProblemTotal = adaptiveCoverage.reduce((total, coveragePhase) => {
    const coverageBlock = ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE[coveragePhase];
    return total + coverageBlock.reps;
  }, 0);

  if (mode === "diagnosis") {
    return {
      title: "Diagnosis Prep",
      objective: `Place the topic correctly inside ${phase}. ${phasePurpose}`,
      problemPlan: `Prepare the starting ${phase} block first. Also prepare the nearest phase below and above it, because the system may move there during diagnosis.`,
      problemCoverage: adaptiveCoverageNotes,
      totalProblems: adaptiveCoverageProblemTotal,
      tutorRules: [
        ...verificationRules,
        ...phaseRules,
        "Diagnosis is adaptive, so prep the starting phase and the nearest lower and higher phase where they exist.",
        "Do not expand into full training volume.",
      ],
      derivedFrom: `Derived from the ${phase} training lane and reduced to adaptive verification coverage around the ${diagnosisBlock.setName} block. Training reference: ${trainingReference}.`,
      checklist: [
        `I prepared the starting ${phase} block and the adjacent phase blocks the system may move into.`,
        `My diagnosis prep covers these phases: ${adaptiveCoverage.join(", ")}.`,
        "I will keep this as placement verification, not normal training.",
        `I will hold the ${phase} phase rules exactly as shown by the system.`,
      ],
    };
  }

  if (mode === "handover") {
    return {
      title: "Handover Prep",
      objective: `Verify whether the inherited ${phase} topic-state is still trustworthy. ${phasePurpose}`,
      problemPlan: `Prepare a small bank of clean ${phase} continuity problems. The system evaluates evidence after each opportunity and stops as soon as there is enough evidence to hold the inherited state, adjust stability, or require targeted re-diagnosis. Extra prepared problems are reserve only, not a completion target.`,
      tutorRules: [
        ...verificationRules,
        ...phaseRules,
        "Do not reteach from scratch.",
        "Do not progress the student during verification.",
        "Stop as soon as the system has enough continuity evidence.",
        "Do not add extra opportunities to chase a preferred result.",
      ],
      derivedFrom: `Derived from the inherited ${phase} conditions and the ${diagnosisBlock.setName} evidence dimensions, but Handover has no fixed rep-completion requirement. Training reference: ${trainingReference}.`,
      checklist: [
        `I reviewed the inherited ${phase} / ${phase === "Clarity" ? "concept-entry" : "response-state"} before starting.`,
        "I prepared a small reserve bank of clean continuity problems rather than a fixed drill sequence.",
        "I will verify continuity only and will not restart or train forward.",
      ],
    };
  }

  return {
    title: "Targeted Re-Diagnosis Prep",
    objective: `Reclassify the current topic state inside ${phase} with no drift. ${phasePurpose}`,
    problemPlan: `Prepare exactly ${diagnosisBlock.reps} clean ${phase} phase-block problems. Use this to reclassify the flagged topic, not to open normal training.`,
    tutorRules: [
      ...verificationRules,
      ...phaseRules,
      "Resolve classification only for this flagged topic.",
      "Do not turn this into standard training.",
    ],
    derivedFrom: `Derived from the ${phase} diagnosis block, which itself is anchored to the ${phase} training structure. Training reference: ${trainingReference}.`,
    checklist: [
      `I prepared exactly ${diagnosisBlock.reps} clean ${phase} phase-block problems.`,
      "I will use this only to reclassify the flagged topic.",
      "I will not turn this targeted re-diagnosis into normal training.",
    ],
  };
}

function getObservationBlockForRep(setConfig: DrillSetConfig, repIndex: number): ObservationField[] {
  if (setConfig.repObservationBlocks?.length) {
    const authoredBlock =
      setConfig.repObservationBlocks[repIndex] ||
      setConfig.repObservationBlocks[setConfig.repObservationBlocks.length - 1];
    return (authoredBlock || []).map((field) => ({
      ...field,
      label: repIndex < setConfig.repObservationBlocks!.length
        ? field.label
        : field.label.replace(/\s*\(Rep\s+\d+[^)]*\)/gi, "").trim(),
    }));
  }
  return setConfig.observationBlock || [];
}

function observationLevelForField(field: ObservationField, optionIndex: number, selectedLabel: string): ObservationLevel {
  const explicitLevel = field.optionLevels?.[selectedLabel];
  if (explicitLevel) return explicitLevel;
  return observationLevelFromOptionIndex(optionIndex, field.options.length);
}

function responseSnapshotColor(level: string) {
  if (level === "strong") return "text-green-700";
  if (level === "partial") return "text-yellow-700";
  if (level === "weak") return "text-red-700";
  return "text-muted-foreground";
}

function responseSnapshotScoreLabel(score: number | null | undefined) {
  return typeof score === "number" ? `${score}/100` : "Not scored";
}

function ResponseSnapshotCard({ snapshot }: { snapshot: ResponseSnapshotV1 }) {
  return (
    <div className="rounded-xl border border-primary/15 bg-background overflow-hidden">
      <div className="bg-primary/5 px-4 py-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold text-sm">Response Snapshot{snapshot.source.topic ? ` - ${snapshot.source.topic}` : ""}</span>
        <span className={`text-sm font-semibold ${responseSnapshotColor(snapshot.drill.responseLevel)}`}>
          {snapshot.drill.responseLabel} - {responseSnapshotScoreLabel(snapshot.drill.score)}
        </span>
      </div>
      <div className="px-4 py-3 space-y-3 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">What This Drill Tested</p>
          <p className="text-foreground">{formatSnapshotPurposeText(snapshot.drill.purposeText)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Drill Response</p>
          <p className="text-muted-foreground">{formatSnapshotResultText(snapshot.drill.resultText)}</p>
        </div>
        <div className="space-y-2 pt-1 border-t">
          {snapshot.sets.map((set) => (
            <div key={set.setId} className="rounded-md border border-primary/10 bg-primary/5 px-3 py-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-foreground">{set.setName}</p>
                <p className={`text-xs font-semibold ${responseSnapshotColor(set.responseLevel)}`}>
                  {set.responseLabel} - {responseSnapshotScoreLabel(set.score)}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatSnapshotPurposeText(set.purposeText)}</p>
              <p className="mt-1 text-xs text-foreground">{formatSnapshotResultText(set.resultText, set.purposeText)}</p>
              <div className="mt-2 space-y-1.5">
                {set.reps.map((rep) => (
                  <div key={`${set.setId}-${rep.repNumber}`} className="rounded border border-primary/10 bg-background px-2 py-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-semibold text-foreground">Rep {rep.repNumber}</p>
                      <p className={`text-xs font-semibold ${responseSnapshotColor(rep.responseLevel)}`}>
                        {rep.responseLabel} - {responseSnapshotScoreLabel(rep.score)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{formatSnapshotRepResult(rep)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function IntroSessionDrillRunner() {
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resultTopRef = useRef<HTMLDivElement | null>(null);
  const [currentSet, setCurrentSet] = useState(0);
  const [currentRep, setCurrentRep] = useState(0);
  const [observations, setObservations] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [scoring, setScoring] = useState<any[] | null>(null);
  const [responseSnapshots, setResponseSnapshots] = useState<ResponseSnapshotV1[]>([]);
  const [handoverEvidenceSummary, setHandoverEvidenceSummary] =
    useState<HandoverEvidenceSummary | null>(null);
  const [sessionTopicIndex, setSessionTopicIndex] = useState(0);
  const [sessionResults, setSessionResults] = useState<any[]>([]);
  const [prepReady, setPrepReady] = useState(false);
  const [prepChecks, setPrepChecks] = useState<Record<string, boolean>>({});
  const [showModeInstructions, setShowModeInstructions] = useState(true);
  const [topicReferenceDraft, setTopicReferenceDraft] = useState<TopicReferenceContent>(EMPTY_TOPIC_REFERENCE);
  const [topicReferenceSaving, setTopicReferenceSaving] = useState(false);
  const [topicReferenceError, setTopicReferenceError] = useState<string | null>(null);
  const [topicReferenceOpen, setTopicReferenceOpen] = useState(false);
  const [savedTopicReferenceOverride, setSavedTopicReferenceOverride] = useState<{
    topic: string;
    reference: TopicReference;
  } | null>(null);
  const [repStarted, setRepStarted] = useState(false);
  const [activePassiveAttempt, setActivePassiveAttempt] =
    useState<TpsActivePassiveAttempt | null>(null);
  const [passiveReplacementState, setPassiveReplacementState] = useState<
    Record<string, TpsReplacementState>
  >({});
  const [passiveAttemptPersisting, setPassiveAttemptPersisting] = useState(false);
  const [passiveTimingNotice, setPassiveTimingNotice] = useState<string | null>(null);
  const passiveFinalizingRef = useRef(false);
  const fallbackTrainingTimingContextRef = useRef(createTpsAttemptId());
  const [activeTpsAttempt, setActiveTpsAttempt] = useState<TpsActiveAttempt | null>(null);
  const [tpsReplacementState, setTpsReplacementState] = useState<Record<string, TpsReplacementState>>({});
  const [tpsTimerNowMs, setTpsTimerNowMs] = useState(() => Date.now());
  const [tpsAttemptPersisting, setTpsAttemptPersisting] = useState(false);
  const [tpsTimingNotice, setTpsTimingNotice] = useState<string | null>(null);
  const tpsFinalizingRef = useRef(false);
  const [supportPickerOpen, setSupportPickerOpen] = useState(false);
  const [showEvidenceExceptions, setShowEvidenceExceptions] = useState(false);

  const requestedMode = searchParams.get("mode");
  const requestedContext = searchParams.get("context");
  const handoverReDiagnosisMode = requestedMode === "handover" && searchParams.get("rediagnosis") === "1";
  const drillMode: DrillMode =
    requestedMode === "training"
      ? "training"
      : requestedMode === "session"
        ? "session"
        : requestedMode === "handover"
          ? "handover"
          : "diagnosis";
  const isSessionMode = drillMode === "session";
  const scheduledSessionId = searchParams.get("scheduledSessionId") || "";
  const rawPhase = searchParams.get("phase");
  const parsedLaunchPhase = tryParsePhase(rawPhase);
  const phase = parsedLaunchPhase || "Clarity";
  const [activeDiagnosisPhase, setActiveDiagnosisPhase] = useState<PhaseLabel>(phase);
  const [adaptiveDiagnosisBlocks, setAdaptiveDiagnosisBlocks] = useState<Array<{
    phase: PhaseLabel;
    setName: string;
    setId?: string;
    setOrder?: number;
    drillSchemaId?: string;
    drillSchemaVersion?: number;
    drillDefinitionHash?: string;
    observations: Array<Record<string, string>>;
  }>>([]);
  const [adaptiveDiagnosisMessage, setAdaptiveDiagnosisMessage] = useState<string | null>(null);
  const [adaptiveTransition, setAdaptiveTransition] = useState<AdaptiveTransitionState | null>(null);
  const previousStability = String(searchParams.get("stability") || "").trim() || null;

  const introTopic = useMemo(() => {
    const raw = searchParams.get("topic") || "";
    return String(raw).trim();
  }, [searchParams]);

  const sessionTopics = useMemo(() => {
    const raw = searchParams.get("topics") || "";
    return raw ? raw.split(',').map(t => decodeURIComponent(t).trim()).filter(Boolean) : [];
  }, [searchParams]);

  const { data: topicData, isLoading: topicDataLoading, refetch: refetchTopicData } = useQuery<{ topics: TopicConditioningRow[] } | undefined>({
    queryKey: ["/api/tutor/topic-conditioning", studentId],
    enabled: (drillMode === "training" || isSessionMode) && !!studentId,
  });

  const currentSessionTopic = useMemo(() => {
    if (!isSessionMode || !topicData?.topics || sessionTopicIndex >= sessionTopics.length) return null;
    const topicName = sessionTopics[sessionTopicIndex];
    return topicData.topics.find((t: any) => t.topic === topicName) || null;
  }, [isSessionMode, topicData, sessionTopicIndex, sessionTopics]);

  const currentTopicPhase = currentSessionTopic?.phase || phase;
  const currentTopicStability = currentSessionTopic?.stability || previousStability;
  const currentTopicName = isSessionMode && sessionTopicIndex < sessionTopics.length 
    ? sessionTopics[sessionTopicIndex]
    : introTopic;
  const currentTopicRecord = useMemo(
    () => topicData?.topics?.find(
      (topic) => topic.topic.trim().toLowerCase() === currentTopicName.trim().toLowerCase(),
    ) || null,
    [topicData, currentTopicName],
  );
  const timingReadinessBlockedTopic = useMemo(() => {
    const candidates = isSessionMode ? sessionTopics : [currentTopicName];
    for (const topicName of candidates) {
      const topic = topicData?.topics?.find(
        (entry) => entry.topic.trim().toLowerCase() === topicName.trim().toLowerCase(),
      );
      if (
        topic?.timingReadiness?.issueCode === TPS_TIMER_BASELINE_INCOMPLETE
      ) {
        return topic;
      }
    }
    return null;
  }, [isSessionMode, sessionTopics, currentTopicName, topicData]);
  const activeTopicReference =
    savedTopicReferenceOverride?.topic.trim().toLowerCase() === currentTopicName.trim().toLowerCase()
      ? savedTopicReferenceOverride.reference
      : currentTopicRecord?.topicReference || null;
  const { data: workflow, isLoading: workflowLoading } = useStudentWorkflowState(studentId || "");
  const assignmentAccepted = workflow?.assignmentAccepted ?? true;
  const diagnosisSessionKind = requestedContext === "training" ? "training" : "intro";
  const sessionKind =
    drillMode === "diagnosis" ? diagnosisSessionKind : drillMode === "handover" ? "handover" : "training";

  useEffect(() => {
    setShowModeInstructions(true);
    setHandoverEvidenceSummary(null);
  }, [drillMode, handoverReDiagnosisMode, currentTopicName, activeDiagnosisPhase, studentId]);

  const {
    data: drillSessionAccess,
    isLoading: drillSessionAccessLoading,
  } = useQuery<any>({
    queryKey: ["/api/tutor/drill-session-access", studentId, sessionKind, scheduledSessionId],
    queryFn: async () => {
      const params = new URLSearchParams({ kind: sessionKind });
      if (scheduledSessionId) params.set("sessionId", scheduledSessionId);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`${API_URL}/api/tutor/students/${studentId}/drill-session-access?${params.toString()}`, {
        headers,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load drill session access (${res.status})`);
      }
      return res.json();
    },
    enabled: !!studentId,
    retry: false,
  });
  const canUseScheduledSession = drillSessionAccess?.canLaunch ?? false;
  const scheduledSession = drillSessionAccess?.session || null;

  const trainingTimingContextId =
    String(scheduledSession?.id || scheduledSessionId || "").trim() ||
    fallbackTrainingTimingContextRef.current;

  const modeToUse: DrillMode = isSessionMode ? "training" : drillMode;
  const isAdaptiveDiagnosisMode = modeToUse === "diagnosis";
  const isHandoverMode = modeToUse === "handover";
  const isAdaptiveVerificationFlow = isAdaptiveDiagnosisMode || (isHandoverMode && handoverReDiagnosisMode);
  const evidenceModeForSubmission: EvidenceDrillMode =
    isHandoverMode && !handoverReDiagnosisMode
      ? "verification"
      : modeToUse === "training"
        ? "training"
        : "diagnosis";
  const drillStructure = useMemo(() => {
    if (isSessionMode && topicDataLoading) return null;
    if (isAdaptiveVerificationFlow) {
      return [ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE[activeDiagnosisPhase]];
    }
    const phaseToUse = (isSessionMode ? currentTopicPhase : phase) as PhaseLabel;
    return buildDrillStructure(modeToUse, phaseToUse);
  }, [isSessionMode, modeToUse, currentTopicPhase, phase, topicDataLoading, isAdaptiveVerificationFlow, activeDiagnosisPhase]);

  const displayPhase: PhaseLabel = isAdaptiveVerificationFlow
    ? activeDiagnosisPhase
    : ((isSessionMode ? currentTopicPhase : phase) as PhaseLabel);
  const getLiveObservationBlockForRep = (setConfig: DrillSetConfig, repIndex: number): ObservationField[] => {
    const configuredFields = getObservationBlockForRep(setConfig, repIndex);
    const registeredSet = getDrillSchemaDefinition(evidenceModeForSubmission, displayPhase).sets.find(
      (candidate) => candidate.setName === setConfig.setName,
    );
    if (!registeredSet) return configuredFields;

    return configuredFields.map((configuredField) => {
      const registeredField = getFieldDefinitionForRep(registeredSet, repIndex, configuredField.key);
      if (!registeredField?.optionLabels?.length) return configuredField;
      const canonicalDimension =
        evidenceModeForSubmission === "verification"
          ? DIAGNOSIS_OBSERVATION_MATRIX[
              registeredField.dimensionId as DiagnosisDimensionId
            ]
          : null;
      const trainingOptionDetails =
        evidenceModeForSubmission === "training"
          ? Object.fromEntries(
              registeredField.optionLabels
                .map((option) => [
                  option,
                  describeTrainingEvidenceOption(registeredField.fieldKey, option),
                ])
                .filter(([, detail]) => !!detail),
            )
          : null;
      return {
        ...configuredField,
        label: canonicalDimension?.label || configuredField.label,
        observationQuestion: canonicalDimension?.observationQuestion || (
          evidenceModeForSubmission === "training"
            ? describeTrainingObservationQuestion(registeredField.fieldKey, configuredField.label)
            : configuredField.observationQuestion
        ),
        options: [...registeredField.optionLabels],
        optionDetails: canonicalDimension
          ? Object.fromEntries(
              canonicalDimension.options.map((option) => [
                option.label,
                option.detail,
              ]),
            )
          : trainingOptionDetails || configuredField.optionDetails,
        optionLevels: Object.fromEntries(
          registeredField.optionLabels.map((label, optionIndex) => [
            label,
            registeredField.optionLevels[optionIndex],
          ]),
        ),
      };
    });
  };
  const verificationPrepSpec = useMemo(
    () =>
      buildVerificationPrepSpec(
        displayPhase,
        isAdaptiveDiagnosisMode
          ? "diagnosis"
          : handoverReDiagnosisMode
            ? "handover_rediagnosis"
            : "handover"
      ),
    [displayPhase, isAdaptiveDiagnosisMode, handoverReDiagnosisMode]
  );

  const hasIntroTopic = !!introTopic;

  const { data: studentsData } = useQuery<StudentListEntry[] | { students?: StudentListEntry[] }>({
    queryKey: ["/api/tutor/students"],
    staleTime: 60_000,
  });

  const studentName = useMemo(() => {
    const list = Array.isArray(studentsData)
      ? studentsData
      : Array.isArray(studentsData?.students)
      ? studentsData.students
      : [];

    const student = list.find((s) => String(s.id) === String(studentId));
    if (!student) return null;

    const directName = String(student.fullName || student.name || "").trim();
    if (directName) return directName;

    const composedName = `${String(student.firstName || "").trim()} ${String(student.lastName || "").trim()}`.trim();
    return composedName || null;
  }, [studentId, studentsData]);

  const set = drillStructure?.[currentSet] ?? null;
  const isModelingSet = !!set?.isModelingSet;
  const isTrainingEvidenceCapture = modeToUse === "training" || isSessionMode;
  const activeRegistrySet = set
    ? getDrillSchemaDefinition(evidenceModeForSubmission, displayPhase).sets.find(
        (candidate) => candidate.setName === set.setName,
      ) || null
    : null;
  const activeRepRequiresPassiveTiming =
    isTrainingEvidenceCapture &&
    displayPhase === "Structured Execution" &&
    activeRegistrySet?.setId === TPS_TRAINING_BASELINE_SET_ID;
  const activeTpsPressureLevel = activeRegistrySet
    ? getTpsTrainingPressureForSet(activeRegistrySet.setId)
    : null;
  const activeRepRequiresTpsTiming =
    isTrainingEvidenceCapture &&
    displayPhase === "Time Pressure Stability" &&
    Boolean(activeTpsPressureLevel);
  const passiveTimingObservationKey = (setIndex: number, repIndex: number) =>
    `set${setIndex}_rep${repIndex}_${PASSIVE_EXECUTION_TIMING_WIRE_KEY}`;
  const passiveAttemptObservationKey = (setIndex: number, repIndex: number) =>
    `set${setIndex}_rep${repIndex}_${PASSIVE_EXECUTION_ATTEMPT_WIRE_KEY}`;
  const tpsTimingObservationKey = (setIndex: number, repIndex: number) =>
    `set${setIndex}_rep${repIndex}_${TPS_TIMED_ATTEMPT_WIRE_KEY}`;
  const activePassiveTimingKey = passiveTimingObservationKey(currentSet, currentRep);
  const activePassiveAttemptKey = passiveAttemptObservationKey(currentSet, currentRep);
  const activeTpsTimingKey = tpsTimingObservationKey(currentSet, currentRep);
  const activePassiveTimingCaptured = Boolean(
    String(observations[activePassiveTimingKey] || "").trim() &&
      String(observations[activePassiveAttemptKey] || "").trim(),
  );
  const activeTpsTimingCaptured = Boolean(
    String(observations[activeTpsTimingKey] || "").trim(),
  );
  const activePassiveRepIdentity = `${currentTopicName.trim().toLowerCase()}::${TPS_TRAINING_BASELINE_SET_ID}::rep-${currentRep + 1}`;
  const activeTpsRepIdentity = `${currentTopicName.trim().toLowerCase()}::${activeRegistrySet?.setId || "unknown"}::rep-${currentRep + 1}`;

  const {
    data: tpsTimerContractResponse,
    isLoading: tpsTimerContractLoading,
    error: tpsTimerContractError,
  } = useQuery<{ contract: TpsTimerContractView }>({
    queryKey: [
      "/api/tutor/students",
      studentId,
      "tps-timer-contract",
      currentTopicName,
    ],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const response = await fetch(
        `${API_URL}/api/tutor/students/${studentId}/tps-timer-contract?topic=${encodeURIComponent(currentTopicName)}`,
        {
          headers,
          credentials: "include",
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(
          body?.message || `Failed to load TPS Timer Contract (${response.status})`,
        ) as Error & { code?: string; status?: number };
        error.code = body?.code;
        error.status = response.status;
        throw error;
      }
      return body;
    },
    enabled:
      activeRepRequiresTpsTiming &&
      !!studentId &&
      !!currentTopicName &&
      !timingReadinessBlockedTopic,
    retry: false,
    staleTime: 30_000,
  });
  const tpsTimerContract = tpsTimerContractResponse?.contract || null;
  const activeTpsPrescribedSeconds =
    tpsTimerContract && activeTpsPressureLevel
      ? prescribedSecondsForTpsPressure(
          tpsTimerContract,
          activeTpsPressureLevel,
        )
      : null;
  const activeTpsStartedAtMs = activeTpsAttempt
    ? Date.parse(activeTpsAttempt.startedAt)
    : NaN;
  const activeTpsRemainingMs =
    activeTpsAttempt &&
    !activeTpsAttempt.frozenAttempt &&
    Number.isFinite(activeTpsStartedAtMs)
      ? Math.max(
          0,
          activeTpsAttempt.prescribedSeconds * 1000 -
            (tpsTimerNowMs - activeTpsStartedAtMs),
        )
      : 0;
  const isHandoverContinuityVerification = isHandoverMode && !handoverReDiagnosisMode;
  const isFirstRep = currentRep === 0;
  const isFirstSet = currentSet === 0;
  const isTopicReferenceCaptureStep =
    modeToUse === "training" &&
    displayPhase === "Clarity" &&
    isFirstSet &&
    isFirstRep &&
    set?.setName === "Modeling";
  const shouldShowTopicReferenceCapture = isTopicReferenceCaptureStep && !activeTopicReference;
  const isLastRep = set ? currentRep === set.reps - 1 : false;
  const isLastSet = drillStructure ? currentSet === drillStructure.length - 1 : false;
  const showSessionInstructions = isSessionMode && sessionTopicIndex === 0 && isFirstSet;
  const scheduledSessionTypeLabel = scheduledSession?.type === "training"
    ? "Training"
    : scheduledSession?.type === "intro"
      ? "Intro Adaptive Diagnosis"
      : scheduledSession?.type === "handover"
        ? "Handover"
        : "Unknown";

  useEffect(() => {
    if (!drillStructure) return;
    if (currentSet >= drillStructure.length) {
      setCurrentSet(0);
      setCurrentRep(0);
      return;
    }
    if (set && currentRep >= set.reps) {
      setCurrentRep(0);
    }
  }, [drillStructure, currentSet, currentRep, set]);

  useEffect(() => {
    setPrepReady(false);
    setPrepChecks({});
    setAdaptiveTransition(null);
  }, [drillMode, handoverReDiagnosisMode, phase, introTopic, sessionTopicIndex]);

  useEffect(() => {
    setTopicReferenceDraft(EMPTY_TOPIC_REFERENCE);
    setTopicReferenceError(null);
    setTopicReferenceOpen(false);
    setSavedTopicReferenceOverride(null);
  }, [studentId, currentTopicName]);

  useEffect(() => {
    const existingTimingCaptured = Boolean(
      String(
        observations[passiveTimingObservationKey(currentSet, currentRep)] ||
          observations[tpsTimingObservationKey(currentSet, currentRep)] ||
          "",
      ).trim(),
    );
    setRepStarted(existingTimingCaptured);
    setActivePassiveAttempt(null);
    setPassiveAttemptPersisting(false);
    passiveFinalizingRef.current = false;
    setPassiveTimingNotice(null);
    setActiveTpsAttempt(null);
    setTpsAttemptPersisting(false);
    tpsFinalizingRef.current = false;
    setTpsTimingNotice(null);
    setSupportPickerOpen(false);
    setShowEvidenceExceptions(false);
  }, [currentSet, currentRep, sessionTopicIndex, activeDiagnosisPhase, currentTopicName]);

  const clearRepObservationState = (setIndex: number, repIndex: number) => {
    const prefix = `set${setIndex}_rep${repIndex}_`;
    setObservations((current: any) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith(prefix)),
      ),
    );
  };

  const beginTrainingRep = () => {
    if (
      modeToUse === "training" &&
      (topicDataLoading || drillSessionAccessLoading)
    ) {
      setSubmitError(
        "Wait for the canonical topic state, session authority, and timing readiness checks before beginning this rep.",
      );
      return;
    }
    if (modeToUse === "training" && !canUseScheduledSession) {
      setSubmitError(
        "A launch-ready Response Integrity training lesson is required before this rep can begin.",
      );
      return;
    }
    if (timingReadinessBlockedTopic) {
      setSubmitError(
        `${timingReadinessBlockedTopic.topic} requires targeted evidence-native re-diagnosis before ordinary Training continues.`,
      );
      return;
    }

    if (activeRepRequiresTpsTiming) {
      if (tpsTimerContractLoading) {
        setSubmitError("Individualized timing authority is still loading.");
        return;
      }
      if (!tpsTimerContract || !activeTpsPressureLevel || !activeTpsPrescribedSeconds) {
        setSubmitError(
          tpsTimerContractError instanceof Error
            ? tpsTimerContractError.message
            : "A valid individualized Timer Contract is required before this TPS rep can begin.",
        );
        return;
      }

      const replacement = tpsReplacementState[activeTpsRepIdentity];
      setActiveTpsAttempt({
        attemptId: createTpsAttemptId(),
        setId: activeRegistrySet!.setId as TpsTimedTrainingSetId,
        setName: set?.setName || activeRegistrySet!.setName,
        repNumber: currentRep + 1,
        attemptNumber: replacement?.nextAttemptNumber || 1,
        pressureLevel: activeTpsPressureLevel,
        prescribedSeconds: activeTpsPrescribedSeconds,
        startedAt: new Date().toISOString(),
        replacementForAttemptId: replacement?.replacementForAttemptId || null,
        frozenAttempt: null,
      });
      setTpsTimerNowMs(Date.now());
      setTpsTimingNotice(null);
      setObservations((current: any) => {
        const next = { ...current };
        delete next[activeTpsTimingKey];
        return next;
      });
    }

    if (activeRepRequiresPassiveTiming) {
      const replacement = passiveReplacementState[activePassiveRepIdentity];
      setActivePassiveAttempt({
        attemptId: createTpsAttemptId(),
        sourceContextId: trainingTimingContextId,
        sourceItemId: TPS_TRAINING_BASELINE_SET_ID,
        slotNumber: currentRep + 1,
        attemptNumber: replacement?.nextAttemptNumber || 1,
        startedAt: new Date().toISOString(),
        replacementForAttemptId: replacement?.replacementForAttemptId || null,
        frozenAttempt: null,
      });
      setPassiveTimingNotice(null);
      setObservations((current: any) => {
        const next = { ...current };
        delete next[activePassiveTimingKey];
        delete next[activePassiveAttemptKey];
        return next;
      });
    }
    setSubmitError(null);
    setRepStarted(true);
  };

  const persistPassiveAttempt = async (
    attempt: TpsPassiveAttemptSubmissionV1,
  ) => {
    if (!studentId) throw new Error("Student identity is unavailable.");
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const response = await fetch(
      `${API_URL}/api/tutor/students/${studentId}/tps-passive-attempt`,
      {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          topic: currentTopicName,
          attempt,
        }),
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        body?.message ||
          `Failed to persist passive timing evidence (${response.status})`,
      );
    }
    return body?.attempt;
  };

  const finishActivePassiveTiming = async (
    requestedEndReason: "student_finished" | "technical_failure" = "student_finished",
  ) => {
    if (
      !activeRepRequiresPassiveTiming ||
      !activePassiveAttempt ||
      activePassiveTimingCaptured ||
      passiveFinalizingRef.current
    ) {
      return;
    }

    let attempt = activePassiveAttempt.frozenAttempt;
    if (!attempt) {
      const endedAt = new Date().toISOString();
      const startedMs = Date.parse(activePassiveAttempt.startedAt);
      const endedMs = Date.parse(endedAt);
      if (!Number.isFinite(startedMs) || !Number.isFinite(endedMs) || endedMs < startedMs) {
        setSubmitError(
          "The passive execution boundary is invalid. Record a technical timing failure and retry.",
        );
        return;
      }
      attempt = {
        attemptId: activePassiveAttempt.attemptId,
        source: "training",
        sourceContextId: activePassiveAttempt.sourceContextId,
        sourceItemId: activePassiveAttempt.sourceItemId,
        slotNumber: activePassiveAttempt.slotNumber,
        attemptNumber: activePassiveAttempt.attemptNumber,
        startedAt: activePassiveAttempt.startedAt,
        endedAt,
        elapsedMs: endedMs - startedMs,
        timingValidity:
          requestedEndReason === "technical_failure"
            ? "timing_invalid_technical"
            : "valid",
        endReason: requestedEndReason,
        replacementForAttemptId:
          activePassiveAttempt.replacementForAttemptId,
      };
      setActivePassiveAttempt((current) =>
        current?.attemptId === activePassiveAttempt.attemptId
          ? { ...current, frozenAttempt: attempt }
          : current,
      );
    }

    passiveFinalizingRef.current = true;
    setPassiveAttemptPersisting(true);
    setSubmitError(null);
    try {
      const persisted = await persistPassiveAttempt(attempt);
      if (!persisted?.attemptId) {
        throw new Error("Passive timing evidence was not returned after persistence.");
      }

      if (attempt.timingValidity === "timing_invalid_technical") {
        setPassiveReplacementState((current) => ({
          ...current,
          [activePassiveRepIdentity]: {
            nextAttemptNumber: attempt.attemptNumber + 1,
            replacementForAttemptId: persisted.attemptId,
          },
        }));
        clearRepObservationState(currentSet, currentRep);
        setActivePassiveAttempt(null);
        setRepStarted(false);
        setPassiveTimingNotice(
          "Technical passive-timing failure preserved in lineage. Retry this same Independent Execution rep under the same no-pressure condition.",
        );
        return;
      }

      const evidence = buildPassiveExecutionTimingEvidence({
        startedAt: attempt.startedAt,
        endedAt: attempt.endedAt,
      });
      if (!evidence || evidence.elapsedMs !== attempt.elapsedMs) {
        throw new Error(
          "The persisted passive attempt does not match the execution boundary.",
        );
      }

      setObservations((current: any) => ({
        ...current,
        [activePassiveTimingKey]:
          encodePassiveExecutionTimingEvidence(evidence),
        [activePassiveAttemptKey]:
          encodeTpsPassiveAttemptEvidenceRef({
            version: 1,
            attemptId: persisted.attemptId,
            source: "training",
            sourceContextId: persisted.sourceContextId,
            sourceItemId: persisted.sourceItemId,
            slotNumber: persisted.slotNumber,
            attemptNumber: persisted.attemptNumber,
            timingValidity: "valid",
            endReason: "student_finished",
          }),
      }));
      setPassiveReplacementState((current) => {
        const next = { ...current };
        delete next[activePassiveRepIdentity];
        return next;
      });
      setPassiveTimingNotice(
        "Student execution boundary recorded. Finish the observations without adding Specialist admin time to the interval.",
      );
      setActivePassiveAttempt(null);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? `${error.message} The execution boundary is frozen; retry saving it rather than restarting the clock.`
          : "Passive timing evidence could not be persisted. The execution boundary is frozen.",
      );
    } finally {
      passiveFinalizingRef.current = false;
      setPassiveAttemptPersisting(false);
    }
  };

  const persistTpsAttempt = async (attempt: TpsTimedAttemptSubmissionV1) => {
    if (!studentId || !tpsTimerContract) {
      throw new Error("TPS timing authority is unavailable.");
    }
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const response = await fetch(
      `${API_URL}/api/tutor/students/${studentId}/tps-timed-attempt`,
      {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          topic: currentTopicName,
          contractId: tpsTimerContract.contractId,
          attempt,
        }),
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        body?.message || `Failed to persist TPS timing evidence (${response.status})`,
      );
    }
    return body?.attempt;
  };

  const finishActiveTpsTiming = async (
    requestedEndReason: TpsTimedAttemptEndReason,
  ) => {
    if (
      !activeRepRequiresTpsTiming ||
      !activeTpsAttempt ||
      !tpsTimerContract ||
      activeTpsTimingCaptured ||
      tpsFinalizingRef.current
    ) {
      return;
    }

    let attempt = activeTpsAttempt.frozenAttempt;
    if (!attempt) {
      const startedMs = Date.parse(activeTpsAttempt.startedAt);
      if (!Number.isFinite(startedMs)) {
        setSubmitError("The TPS timer start boundary is invalid. Record a technical failure and retry the rep.");
        return;
      }

      const expiryMs =
        startedMs + activeTpsAttempt.prescribedSeconds * 1000;
      const nowMs = Date.now();
      let endReason = requestedEndReason;
      let endedMs = nowMs;
      if (
        requestedEndReason === "timer_expired" ||
        (requestedEndReason === "student_finished" && nowMs >= expiryMs)
      ) {
        endReason = "timer_expired";
        endedMs = expiryMs;
      }

      attempt = {
        attemptId: activeTpsAttempt.attemptId,
        setId: activeTpsAttempt.setId,
        setName: activeTpsAttempt.setName,
        repNumber: activeTpsAttempt.repNumber,
        attemptNumber: activeTpsAttempt.attemptNumber,
        pressureLevel: activeTpsAttempt.pressureLevel,
        prescribedSeconds: activeTpsAttempt.prescribedSeconds,
        startedAt: activeTpsAttempt.startedAt,
        endedAt: new Date(endedMs).toISOString(),
        elapsedMs: Math.max(0, endedMs - startedMs),
        completedBeforeExpiry: endReason === "student_finished",
        timingValidity:
          endReason === "technical_failure"
            ? "timing_invalid_technical"
            : "valid",
        endReason,
        replacementForAttemptId:
          activeTpsAttempt.replacementForAttemptId,
      };
      setActiveTpsAttempt((current) =>
        current?.attemptId === activeTpsAttempt.attemptId
          ? { ...current, frozenAttempt: attempt }
          : current,
      );
    }

    tpsFinalizingRef.current = true;
    setTpsAttemptPersisting(true);
    setSubmitError(null);
    try {
      const persisted = await persistTpsAttempt(attempt);
      if (!persisted?.attemptId) {
        throw new Error("TPS timing evidence was not returned after persistence.");
      }

      if (attempt.timingValidity === "timing_invalid_technical") {
        setTpsReplacementState((current) => ({
          ...current,
          [activeTpsRepIdentity]: {
            nextAttemptNumber: attempt.attemptNumber + 1,
            replacementForAttemptId: persisted.attemptId,
          },
        }));
        clearRepObservationState(currentSet, currentRep);
        setActiveTpsAttempt(null);
        setRepStarted(false);
        setTpsTimingNotice(
          "Technical timer failure preserved in lineage. Retry this same rep; the replacement will use the same Timer Contract.",
        );
        return;
      }

      setObservations((current: any) => ({
        ...current,
        [activeTpsTimingKey]: encodeTpsTimedAttemptEvidenceRef({
          version: 1,
          attemptId: persisted.attemptId,
          contractId: tpsTimerContract.contractId,
          setId: activeTpsAttempt.setId,
          repNumber: activeTpsAttempt.repNumber,
          attemptNumber: persisted.attemptNumber,
          timingValidity: "valid",
          endReason: persisted.endReason,
        }),
      }));
      setTpsReplacementState((current) => {
        const next = { ...current };
        delete next[activeTpsRepIdentity];
        return next;
      });
      setTpsTimingNotice(
        persisted.endReason === "timer_expired"
          ? "Timer expired at the prescribed boundary. Record the student's response exactly as it stood at expiry."
          : "Student execution boundary recorded. Finish the observations without adding admin time to the rep.",
      );
      setActiveTpsAttempt(null);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? `${error.message} The execution boundary is frozen; retry saving it rather than restarting the clock.`
          : "TPS timing evidence could not be persisted. The execution boundary is frozen.",
      );
    } finally {
      tpsFinalizingRef.current = false;
      setTpsAttemptPersisting(false);
    }
  };

  useEffect(() => {
    if (
      !activeRepRequiresTpsTiming ||
      !repStarted ||
      !activeTpsAttempt ||
      activeTpsAttempt.frozenAttempt ||
      activeTpsTimingCaptured
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      setTpsTimerNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(interval);
  }, [
    activeRepRequiresTpsTiming,
    repStarted,
    activeTpsAttempt?.attemptId,
    activeTpsAttempt?.frozenAttempt,
    activeTpsTimingCaptured,
  ]);

  useEffect(() => {
    if (
      !activeRepRequiresTpsTiming ||
      !repStarted ||
      !activeTpsAttempt ||
      activeTpsAttempt.frozenAttempt ||
      activeTpsTimingCaptured ||
      activeTpsRemainingMs > 0 ||
      tpsAttemptPersisting
    ) {
      return;
    }
    void finishActiveTpsTiming("timer_expired");
  }, [
    activeRepRequiresTpsTiming,
    repStarted,
    activeTpsAttempt?.attemptId,
    activeTpsAttempt?.frozenAttempt,
    activeTpsTimingCaptured,
    activeTpsRemainingMs,
    tpsAttemptPersisting,
  ]);

  useEffect(() => {
    if (!submitSuccess) return;
    window.requestAnimationFrame(() => {
      resultTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [submitSuccess]);

  const handleExitToPod = () => {
    navigate("/specialist/pod");
  };

  const handleOpenTimingRediagnosis = () => {
    if (!studentId || !timingReadinessBlockedTopic) return;
    const topicParam = encodeURIComponent(timingReadinessBlockedTopic.topic);
    const phaseParam = encodeURIComponent(
      timingReadinessBlockedTopic.targetedRediagnosisStartPhase ||
        "Structured Execution",
    );
    const stabilityParam = encodeURIComponent(
      timingReadinessBlockedTopic.stability || "Low",
    );
    const sessionParam = scheduledSessionId
      ? `&scheduledSessionId=${encodeURIComponent(scheduledSessionId)}`
      : "";
    navigate(
      `/specialist/intro-session/${studentId}?topic=${topicParam}&phase=${phaseParam}&stability=${stabilityParam}&context=training&rediagnosis=1${sessionParam}`,
    );
  };

  const handleContinueToProposal = () => {
    if (!studentId) {
      navigate("/specialist/pod");
      return;
    }

    navigate(`/specialist/pod?openProposal=1&studentId=${encodeURIComponent(studentId)}`);
  };

  const handleBackStep = () => {
    if (submitting || submitSuccess) return;
    if (
      activeRepRequiresPassiveTiming &&
      repStarted &&
      !activePassiveTimingCaptured
    ) {
      setSubmitError(
        "Finish the active passive execution boundary or record a technical timing failure before leaving this rep.",
      );
      return;
    }
    if (
      activeRepRequiresTpsTiming &&
      repStarted &&
      !activeTpsTimingCaptured
    ) {
      setSubmitError(
        "Finish the active TPS timing boundary or record a technical timer failure before leaving this rep.",
      );
      return;
    }
    if (adaptiveTransition) {
      setAdaptiveTransition(null);
      setAdaptiveDiagnosisMessage(null);
      return;
    }
    if (!isFirstRep) {
      setCurrentRep((r) => r - 1);
      return;
    }
    if (isAdaptiveVerificationFlow && adaptiveDiagnosisBlocks.length > 0) {
      const previousBlock = adaptiveDiagnosisBlocks[adaptiveDiagnosisBlocks.length - 1];
      const previousSet = ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE[previousBlock.phase];
      setAdaptiveDiagnosisBlocks((prev) => prev.slice(0, -1));
      setActiveDiagnosisPhase(previousBlock.phase);
      setCurrentSet(0);
      setCurrentRep(Math.max(0, previousSet.reps - 1));
      setObservations(hydrateObservationsFromSet(previousSet, previousBlock));
      setAdaptiveDiagnosisMessage(null);
      return;
    }
    if (!isFirstSet) {
      const previousSetIndex = currentSet - 1;
      const previousSet = drillStructure[previousSetIndex];
      setCurrentSet(previousSetIndex);
      setCurrentRep(previousSet.reps - 1);
      return;
    }
    // If we're at the beginning and in session mode, go back to previous topic
    if (isSessionMode && sessionTopicIndex > 0) {
      setSessionTopicIndex(prev => prev - 1);
      // Reset to last set/rep of previous topic
      setCurrentSet(drillStructure.length - 1);
      setCurrentRep(drillStructure[drillStructure.length - 1].reps - 1);
      // Restore observations for previous topic if they exist
      const prevTopicResults = sessionResults[sessionTopicIndex - 1];
      if (prevTopicResults) {
        // This is complex - we'd need to reconstruct observations from stored results
        // For now, just reset observations and let user re-do if needed
        setObservations({});
      }
    }
  };

  const handleObservation = (field: string, value: string) => {
    setSubmitError(null);
    if (adaptiveTransition) {
      setAdaptiveTransition(null);
    }
    setObservations((prev: any) => ({
      ...prev,
      [`set${currentSet}_rep${currentRep}_${field}`]: value,
    }));
  };


  const handleTrainingEvidenceStatus = (
    field: string,
    status: TrainingEvidenceStatus,
  ) => {
    setObservations((prev: any) => ({
      ...prev,
      ["set" + currentSet + "_rep" + currentRep + "_" + trainingEvidenceStatusKey(field)]: status,
    }));
  };

  const handleTrainingIntervention = (event: TrainingInterventionEvent) => {
    setObservations((prev: any) => ({
      ...prev,
      ["set" + currentSet + "_rep" + currentRep + "_" + TRAINING_INTERVENTION_FIELD]: event,
    }));
    setSupportPickerOpen(false);
  };

  const currentTrainingIntervention = (): TrainingInterventionEvent => {
    const stored = String(
      observations[
        "set" + currentSet + "_rep" + currentRep + "_" + TRAINING_INTERVENTION_FIELD
      ] || "none",
    ) as TrainingInterventionEvent;
    return TRAINING_INTERVENTION_OPTIONS.some((option) => option.id === stored)
      ? stored
      : "none";
  };

  const currentTrainingEvidenceStatus = (
    field: string,
  ): TrainingEvidenceStatus => {
    const stored = String(
      observations[
        "set" + currentSet + "_rep" + currentRep + "_" + trainingEvidenceStatusKey(field)
      ] || "observed",
    );
    return stored === "not_observed" || stored === "confounded"
      ? stored
      : "observed";
  };

  const trainingPrerequisiteSentinelKey = (setIndex: number, repIndex: number) =>
    "set" + setIndex + "_rep" + repIndex + "_" + TRAINING_PREREQUISITE_SENTINEL_FIELD;

  const trainingPrerequisiteSentinelResultFor = (
    setIndex: number,
    repIndex: number,
  ): TrainingPrerequisiteSentinelResult | null => {
    const raw = String(observations[trainingPrerequisiteSentinelKey(setIndex, repIndex)] || "").trim();
    return raw === "held" || raw === "contradicted" || raw === "not_observed" || raw === "confounded"
      ? raw
      : null;
  };

  const handleTrainingPrerequisiteSentinel = (result: TrainingPrerequisiteSentinelResult) => {
    setObservations((prev: any) => ({
      ...prev,
      [trainingPrerequisiteSentinelKey(currentSet, currentRep)]: result,
    }));
  };

  const repNeedsTrainingPrerequisiteSentinel = (setIndex: number, repIndex: number) => {
    if (!isTrainingEvidenceCapture) return false;
    const sentinelDefinition = getTrainingPrerequisiteSentinelDefinition(displayPhase);
    if (!sentinelDefinition) return false;

    const repSet = drillStructure?.[setIndex];
    if (!repSet || repSet.isModelingSet) return false;
    const storedIntervention = String(
      observations["set" + setIndex + "_rep" + repIndex + "_" + TRAINING_INTERVENTION_FIELD] || "none",
    ) as TrainingInterventionEvent;
    const interventionEvent = TRAINING_INTERVENTION_OPTIONS.some((option) => option.id === storedIntervention)
      ? storedIntervention
      : "none";

    return getLiveObservationBlockForRep(repSet, repIndex).some((field) => {
      const rawOption = String(
        observations["set" + setIndex + "_rep" + repIndex + "_" + field.key] || "",
      ).trim();
      if (!rawOption) return false;

      const statusRaw = String(
        observations[
          "set" + setIndex + "_rep" + repIndex + "_" + trainingEvidenceStatusKey(field.key)
        ] || "observed",
      );
      const explicitStatus: TrainingEvidenceStatus =
        statusRaw === "not_observed" || statusRaw === "confounded" ? statusRaw : "observed";

      return trainingRawObservationRequiresPrerequisiteSentinel({
        phase: displayPhase,
        fieldKey: field.key,
        rawOption,
        explicitStatus,
        interventionEvent,
      });
    });
  };

  const handleTopicReferenceChange = (field: keyof TopicReferenceContent, value: string) => {
    setTopicReferenceError(null);
    setTopicReferenceDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSaveTopicReference = async () => {
    if (!studentId || !currentTopicName) return;

    const hasMissingField = Object.values(topicReferenceDraft).some((value) => !value.trim());
    if (hasMissingField) {
      setTopicReferenceError("Complete all four parts before saving the Topic Reference.");
      return;
    }

    setTopicReferenceSaving(true);
    setTopicReferenceError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const response = await fetch(`${API_URL}/api/tutor/topic-conditioning/${studentId}/topic-reference`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({
          topic: currentTopicName,
          topicReference: topicReferenceDraft,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || `Failed to save Topic Reference (${response.status})`);
      }

      setSavedTopicReferenceOverride({ topic: currentTopicName, reference: result.topicReference });
      setTopicReferenceOpen(true);
      await refetchTopicData();
    } catch (error: any) {
      setTopicReferenceError(error?.message || "Failed to save the Topic Reference. Please try again.");
    } finally {
      setTopicReferenceSaving(false);
    }
  };

  const handleContinueAdaptiveTransition = () => {
    if (!adaptiveTransition) return;
    setAdaptiveDiagnosisBlocks((prev) => [...prev, adaptiveTransition.currentBlock]);
    setAdaptiveDiagnosisMessage(
      `${adaptiveTransition.currentPhase} scored ${adaptiveTransition.phaseScore}/100. ${
        adaptiveTransition.direction === "escalate"
          ? `Moving up to ${adaptiveTransition.nextPhase}.`
          : `Dropping to ${adaptiveTransition.nextPhase}.`
      }`
    );
    setActiveDiagnosisPhase(adaptiveTransition.nextPhase);
    setCurrentSet(0);
    setCurrentRep(0);
    setObservations({});
    setAdaptiveTransition(null);
  };

  const getMissingFieldsForRep = (setIndex: number, repIndex: number) => {
    const repSet = drillStructure[setIndex];
    const observationBlock = getLiveObservationBlockForRep(repSet, repIndex);
    const missing: ObservationField[] = observationBlock.filter(
      (field) => !String(observations[`set${setIndex}_rep${repIndex}_${field.key}`] || "").trim()
    );
    if (
      repNeedsTrainingPrerequisiteSentinel(setIndex, repIndex) &&
      !trainingPrerequisiteSentinelResultFor(setIndex, repIndex)
    ) {
      missing.push({
        key: TRAINING_PREREQUISITE_SENTINEL_FIELD,
        label: "Prerequisite sentinel",
        options: [],
      });
    }
    return missing;
  };

  const getFirstMissingRep = () => {
    if (!drillStructure) return null;
    for (let setIndex = 0; setIndex < drillStructure.length; setIndex++) {
      const repSet = drillStructure[setIndex];
      for (let repIndex = 0; repIndex < repSet.reps; repIndex++) {
        const missing = getMissingFieldsForRep(setIndex, repIndex);
        if (missing.length > 0) {
          return { setIndex, repIndex, label: missing[0].label };
        }
      }
    }
    return null;
  };

  const getSubmissionRepCount = (setConfig: DrillSetConfig) => {
    if (isHandoverContinuityVerification) {
      return currentRep + 1;
    }
    return setConfig.reps;
  };

  const hydrateObservationsFromSet = (setConfig: DrillSetConfig, serializedSet: { observations?: Array<Record<string, string>> }) => {
    const nextObservations: Record<string, string> = {};
    const reps = Array.isArray(serializedSet?.observations) ? serializedSet.observations : [];
    reps.forEach((repObs, repIdx) => {
      const observationBlock = getLiveObservationBlockForRep(setConfig, repIdx);
      observationBlock.forEach((field) => {
        const selectedLabel = String(repObs?.[field.key] || "").trim();
        if (selectedLabel) {
          nextObservations[`set0_rep${repIdx}_${field.key}`] = selectedLabel;
        }
      });
    });
    return nextObservations;
  };

  const serializeSetForSubmission = (setConfig: DrillSetConfig, setIndex: number) => {
    const repCount = getSubmissionRepCount(setConfig);
    const schema = getDrillSchemaDefinition(evidenceModeForSubmission, displayPhase);
    const registrySet = schema.sets.find((candidate) => candidate.setName === setConfig.setName) || null;
    const semanticSetFields = {
      setId: registrySet?.setId || "",
      setOrder: setIndex + 1,
      drillSchemaId: schema.schemaId,
      drillSchemaVersion: schema.schemaVersion,
      drillDefinitionHash: schema.definitionHash,
      constraintProfile: registrySet?.constraints || null,
    };

    if (setConfig.isModelingSet) {
      return {
        ...semanticSetFields,
        setName: setConfig.setName,
        reps: repCount,
        observations: [],
      };
    }

    return {
      ...semanticSetFields,
      setName: setConfig.setName,
      reps: repCount,
      observations: Array.from({ length: repCount }).map((_, repIdx) => {
        const obs: Record<string, string> = {};
        if (registrySet) {
          obs._rep_id = registrySet.repPurposeIds[repIdx] || `${registrySet.setId}.opportunity_${repIdx + 1}`;
          obs._rep_number = String(repIdx + 1);
        }
        const observationBlock = getLiveObservationBlockForRep(setConfig, repIdx);
        if (isTrainingEvidenceCapture) {
          obs[TRAINING_INTERVENTION_FIELD] =
            observations[
              "set" + setIndex + "_rep" + repIdx + "_" + TRAINING_INTERVENTION_FIELD
            ] || "none";
          const prerequisiteSentinel =
            trainingPrerequisiteSentinelResultFor(setIndex, repIdx);
          if (prerequisiteSentinel) {
            obs[TRAINING_PREREQUISITE_SENTINEL_FIELD] = prerequisiteSentinel;
          }
          if (
            displayPhase === "Structured Execution" &&
            registrySet?.setId === TPS_TRAINING_BASELINE_SET_ID
          ) {
            const timingEvidence = String(
              observations[passiveTimingObservationKey(setIndex, repIdx)] || "",
            ).trim();
            if (timingEvidence) {
              obs[PASSIVE_EXECUTION_TIMING_WIRE_KEY] = timingEvidence;
            }
            const attemptEvidence = String(
              observations[passiveAttemptObservationKey(setIndex, repIdx)] || "",
            ).trim();
            if (attemptEvidence) {
              obs[PASSIVE_EXECUTION_ATTEMPT_WIRE_KEY] = attemptEvidence;
            }
          }
          if (
            displayPhase === "Time Pressure Stability" &&
            registrySet &&
            getTpsTrainingPressureForSet(registrySet.setId)
          ) {
            const timingEvidence = String(
              observations[tpsTimingObservationKey(setIndex, repIdx)] || "",
            ).trim();
            if (timingEvidence) {
              obs[TPS_TIMED_ATTEMPT_WIRE_KEY] = timingEvidence;
            }
          }
        }
        observationBlock.forEach((block) => {
          if (isTrainingEvidenceCapture) {
            obs[trainingEvidenceStatusKey(block.key)] =
              observations[
                "set" + setIndex + "_rep" + repIdx + "_" + trainingEvidenceStatusKey(block.key)
              ] || "observed";
          }
          const selectedLabel = observations[`set${setIndex}_rep${repIdx}_${block.key}`] || "";
          const optionIndex = block.options.findIndex((option) => option === selectedLabel);
          const semanticIdentity = getEvidenceSelectionIdentity({
            mode: evidenceModeForSubmission,
            phase: displayPhase,
            setName: setConfig.setName,
            repIndex: repIdx,
            fieldKey: block.key,
            optionIndex,
          });
          const selectedLevel = semanticIdentity?.level || observationLevelForField(block, optionIndex, selectedLabel);
          obs[block.key] = selectedLabel;
          obs[`${block.key}_level`] = selectedLevel;
          if (semanticIdentity) {
            obs[`${block.key}_option_id`] = semanticIdentity.optionId;
            obs[`${block.key}_dimension_id`] = semanticIdentity.dimensionId;
            if (semanticIdentity.evidenceClass) {
              obs[`${block.key}_evidence_class`] = semanticIdentity.evidenceClass;
            }
          }
        });
        return obs;
      }),
    };
  };

  const submitHandoverVerification = async (serializedSet: ReturnType<typeof serializeSetForSubmission>) => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    setScoring(null);
    setResponseSnapshots([]);
    setHandoverEvidenceSummary(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const response = await fetch(`${API_URL}/api/tutor/handover-verification-drill`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          studentId,
          drill: [serializedSet],
          handoverTopic: introTopic,
          phase,
          stability: previousStability,
          scheduledSessionId,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData?.message || `Request failed with status code ${response.status}`) as any;
        error.response = { status: response.status, data: errorData };
        throw error;
      }
      const data = await response.json();

      const queryClient = (window as any).__queryClient;
      if (queryClient) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/tutor/pod"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/tutor/sessions"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/tutor/topic-conditioning", studentId] }),
          queryClient.invalidateQueries({ queryKey: ["/api/tutor/students", studentId, "topic-conditioning-activations"] }),
          queryClient.invalidateQueries({ queryKey: [`/api/tutor/students/${studentId}/reports-center`] }),
          queryClient.invalidateQueries({ queryKey: [`/api/tutor/students/${studentId}/assignments`] }),
          queryClient.invalidateQueries({ queryKey: ["/api/parent/reports"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/parent/student-stats"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/parent/student-info"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/parent/topic-conditioning-states"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/parent/assigned-tutor"] }),
        ]);
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ["/api/tutor/pod"] }),
          queryClient.refetchQueries({ queryKey: ["/api/tutor/topic-conditioning", studentId] }),
        ]);
      }

      setHandoverEvidenceSummary(data?.summary || null);
      setSubmitSuccess(true);
      setScoring(data?.scoring || null);
      setResponseSnapshots(data?.responseSnapshot ? [data.responseSnapshot] : []);
    } catch (err: any) {
      console.error("Handover verification submission error:", err);
      const errorMessage = err?.response?.data?.message || err?.message || "Submission failed. Please try again.";
      const statusCode = err?.response?.status;
      setSubmitError(statusCode ? `${errorMessage} (${statusCode})` : errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (!drillStructure) {
      setSubmitError("Drill structure is loading. Please wait.");
      return;
    }

    if (!isSessionMode && !hasIntroTopic) {
      setSubmitError("Diagnostic topic is required. Please return and set Add Diagnostic Topic first.");
      return;
    }
    if (!isSessionMode && !parsedLaunchPhase) {
      setSubmitError("Invalid drill phase. Relaunch the drill from the student card or topic map.");
      return;
    }
    if (!canUseScheduledSession) {
      setSubmitError(
        drillMode === "diagnosis"
          ? "A confirmed Response Integrity intro session is required before running this drill."
          : "A launch-ready Response Integrity training lesson is required before running this drill."
      );
      return;
    }

    if (shouldShowTopicReferenceCapture) {
      setTopicReferenceError("Save the Topic Reference before starting the scored drill sets.");
      return;
    }

    if (timingReadinessBlockedTopic) {
      setSubmitError(
        `${timingReadinessBlockedTopic.topic} requires targeted evidence-native re-diagnosis before ordinary Training continues.`,
      );
      return;
    }

    if (activeRepRequiresTpsTiming && !activeTpsTimingCaptured) {
      setSubmitError(
        "Complete and persist the system-owned TPS timer boundary before confirming this rep.",
      );
      return;
    }

    if (activeRepRequiresPassiveTiming && !activePassiveTimingCaptured) {
      setSubmitError(
        "Mark Student Finished before confirming this Independent Execution rep so Specialist admin time is excluded from the student's baseline.",
      );
      return;
    }

    const missingCurrent = getMissingFieldsForRep(currentSet, currentRep);
    if (missingCurrent.length > 0) {
      setSubmitError(`Complete all observation toggles before continuing. Missing: ${missingCurrent.map((field) => field.label).join(", ")}.`);
      return;
    }

    if (isHandoverContinuityVerification) {
      const serializedSet = serializeSetForSubmission(set, currentSet);
      const evaluation = evaluateHandoverVerificationEvidence({
        phase: displayPhase,
        previousStability: normalizeStability(previousStability || "Low"),
        set: serializedSet,
      });
      if (evaluation.status !== "evaluated") {
        setSubmitError(`Continuity evidence is not decision-eligible: ${evaluation.reason}`);
        return;
      }
      if (evaluation.verificationOutcome === "continue_verification") {
        const completedOpportunities = currentRep + 1;
        if (completedOpportunities >= HANDOVER_VERIFICATION_MAX_OPPORTUNITIES) {
          setSubmitError("Continuity evidence is still unresolved at the verification safety cap. Stop Handover and move this topic into targeted re-diagnosis rather than turning verification into Training.");
          return;
        }
        setAdaptiveDiagnosisMessage(`Continuity evidence is not yet sufficient after opportunity ${completedOpportunities}. Record one more clean opportunity under the same inherited ${displayPhase} conditions. Do not teach forward or chase a preferred result.`);
        setCurrentRep((rep) => rep + 1);
        return;
      }
      setAdaptiveDiagnosisMessage(null);
      await submitHandoverVerification(serializedSet);
      return;
    }

    if (!isLastRep) {
      setCurrentRep((r) => r + 1);
    } else if (!isLastSet) {
      setCurrentSet((s) => s + 1);
      setCurrentRep(0);
    } else if (isAdaptiveVerificationFlow) {
      const serializedSet = serializeSetForSubmission(set, currentSet);
      const phaseSummary = computeAdaptiveDiagnosisPhaseSummary(activeDiagnosisPhase, serializedSet.observations);
      const currentBlock = {
        phase: activeDiagnosisPhase,
        ...serializedSet,
      };
      const nextPhase =
        phaseSummary.band === "de-escalate"
          ? getAdjacentDiagnosisPhase(activeDiagnosisPhase, "previous")
          : phaseSummary.band === "escalate"
            ? getAdjacentDiagnosisPhase(activeDiagnosisPhase, "next")
            : null;
      const shouldStop = !nextPhase || phaseSummary.band === "place";

      if (!shouldStop) {
        setAdaptiveDiagnosisMessage(null);
        setAdaptiveTransition({
          currentPhase: activeDiagnosisPhase,
          nextPhase,
          phaseScore: phaseSummary.phaseScore,
          direction: phaseSummary.band === "escalate" ? "escalate" : "de-escalate",
          currentBlock,
        });
        return;
      }

      const finalAdaptiveBlocks = [...adaptiveDiagnosisBlocks, currentBlock];

      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);
      setScoring(null);
      setResponseSnapshots([]);
      try {
        const payload = isHandoverMode
          ? {
              studentId,
              handoverTopic: introTopic,
              phase,
              startingPhase: phase,
              stability: previousStability,
              adaptiveBlocks: finalAdaptiveBlocks,
              scheduledSessionId,
              rediagnosis: true,
            }
          : {
              studentId,
              introTopic,
              startingPhase: phase,
              adaptiveBlocks: finalAdaptiveBlocks,
              scheduledSessionId,
              sessionContextKind: diagnosisSessionKind,
            };
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
        const adaptiveEndpoint = isHandoverMode ? "/api/tutor/handover-verification-drill" : "/api/tutor/intro-session-drill";
        const adaptiveResponse = await fetch(`${API_URL}${adaptiveEndpoint}`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!adaptiveResponse.ok) {
          const errorData = await adaptiveResponse.json().catch(() => ({}));
          const error = new Error(errorData?.message || `Request failed with status code ${adaptiveResponse.status}`) as any;
          error.response = { status: adaptiveResponse.status, data: errorData };
          throw error;
        }
        const res = { data: await adaptiveResponse.json() };

        const queryClient = (window as any).__queryClient;
        if (queryClient) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/tutor/pod"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/tutor/sessions"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/tutor/students/intro-session-details", studentId] }),
            queryClient.invalidateQueries({ queryKey: ["/api/tutor/students", studentId, "workflow-state"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/tutor/topic-conditioning", studentId] }),
            queryClient.invalidateQueries({ queryKey: ["/api/tutor/students", studentId, "topic-conditioning-activations"] }),
            queryClient.invalidateQueries({ queryKey: [`/api/tutor/students/${studentId}/reports-center`] }),
            queryClient.invalidateQueries({ queryKey: [`/api/tutor/students/${studentId}/assignments`] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/reports"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/student-stats"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/student-info"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/topic-conditioning-states"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/assigned-tutor"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/intro-session-confirmation"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/proposal"] }),
          ]);
          await Promise.all([
            queryClient.refetchQueries({ queryKey: ["/api/tutor/pod"] }),
            queryClient.refetchQueries({ queryKey: [`/api/tutor/students/${studentId}/reports-center`] }),
          ]);
        }

        setAdaptiveDiagnosisMessage(
          isHandoverMode
            ? `${phaseSummary.phaseScore}/100 in ${activeDiagnosisPhase}. Targeted re-diagnosis resolved to ${res.data?.summary?.resultingPhase || activeDiagnosisPhase}.`
            : `${phaseSummary.phaseScore}/100 in ${activeDiagnosisPhase}. Diagnosis locked at ${res.data?.summary?.phase || activeDiagnosisPhase}.`
        );
        setSubmitSuccess(true);
        setScoring(res.data?.scoring || null);
        setResponseSnapshots(res.data?.responseSnapshot ? [res.data.responseSnapshot] : []);
      } catch (err: any) {
        console.error("Adaptive intro diagnosis submission error:", err);
        const errorMessage = err?.response?.data?.message || err?.message || "Submission failed. Please try again.";
        const statusCode = err?.response?.status;
        setSubmitError(statusCode ? `${errorMessage} (${statusCode})` : errorMessage);
      } finally {
        setSubmitting(false);
      }
    } else {
      // Last rep of last set - either submit or move to next topic in session
      if (isSessionMode && sessionTopicIndex < sessionTopics.length - 1) {
        // Save current drill results and move to next topic
        const drillResult = {
          trainingTopic: currentTopicName,
          phase: currentTopicPhase,
          previousStability: currentTopicStability,
          tpsTimingSourceContextId: trainingTimingContextId,
          drill: drillStructure.map((set, setIdx) => serializeSetForSubmission(set, setIdx)),
        };
        
        setSessionResults(prev => [...prev, drillResult]);
        setSessionTopicIndex(prev => prev + 1);
        setCurrentSet(0);
        setCurrentRep(0);
        setObservations({});
        return;
      }

      // Submit observations to backend for scoring
      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);
      setScoring(null);
      setResponseSnapshots([]);
      try {
        const firstMissing = getFirstMissingRep();
        if (firstMissing) {
          setCurrentSet(firstMissing.setIndex);
          setCurrentRep(firstMissing.repIndex);
          setSubmitError(
            `Set ${firstMissing.setIndex + 1}, Rep ${firstMissing.repIndex + 1} is incomplete. Missing: ${firstMissing.label}.`
          );
          setSubmitting(false);
          return;
        }

        // Construct drill data for this topic - ensure ALL sets are included
        const currentDrill = {
          trainingTopic: isSessionMode ? currentTopicName : introTopic,
          phase: isSessionMode ? currentTopicPhase : phase,
          previousStability: isSessionMode ? currentTopicStability : previousStability,
          tpsTimingSourceContextId: trainingTimingContextId,
          // IMPORTANT: Include all sets from drillStructure - no filtering
          // Training drills MUST have exactly 3 sets per validation rules
          drill: drillStructure.map((set, setIdx) => serializeSetForSubmission(set, setIdx)),
        };

        // Collect all drills (for multi-topic sessions, include previous + current)
        const allDrills = isSessionMode 
          ? [...sessionResults.map(d => ({ ...d, trainingTopic: d.trainingTopic || d.topic })), currentDrill]
          : [currentDrill];

        // Diagnosis submits from the adaptive branch above. Reaching this branch means the
        // completed payload is either a handover verification or a training session.
        const endpoint = isHandoverMode
          ? "/api/tutor/handover-verification-drill"
          : "/api/tutor/training-session-drill";
        const payload = isHandoverMode
          ? {
                studentId,
                drill: currentDrill.drill,
                handoverTopic: currentDrill.trainingTopic,
                phase: currentDrill.phase,
                stability: currentDrill.previousStability,
                scheduledSessionId,
            }
          : {
              studentId,
              sessionDrills: allDrills,
              scheduledSessionId,
            };
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
        const submitResponse = await fetch(`${API_URL}${endpoint}`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!submitResponse.ok) {
          const errorData = await submitResponse.json().catch(() => ({}));
          const error = new Error(errorData?.message || `Request failed with status code ${submitResponse.status}`) as any;
          error.response = { status: submitResponse.status, data: errorData };
          throw error;
        }
        const res = { data: await submitResponse.json() };
        
        // Invalidate relevant caches so updated status/stage/state appear immediately
        const queryClient = (window as any).__queryClient;
        if (queryClient) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/tutor/pod"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/tutor/sessions"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/tutor/topic-conditioning", studentId] }),
            queryClient.invalidateQueries({ queryKey: ["/api/tutor/students", studentId, "topic-conditioning-activations"] }),
            queryClient.invalidateQueries({ queryKey: [`/api/tutor/students/${studentId}/reports-center`] }),
            queryClient.invalidateQueries({ queryKey: [`/api/tutor/students/${studentId}/assignments`] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/reports"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/student-stats"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/student-info"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/topic-conditioning-states"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/assigned-tutor"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/intro-session-confirmation"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/parent/proposal"] }),
          ]);
          await Promise.all([
            queryClient.refetchQueries({ queryKey: ["/api/tutor/pod"] }),
            queryClient.refetchQueries({ queryKey: [`/api/tutor/students/${studentId}/reports-center`] }),
          ]);
        }
        
        setSubmitSuccess(true);
        const drillResults = res.data?.drillResults;
        const returnedSnapshots = res.data?.responseSnapshot
          ? [res.data.responseSnapshot]
          : Array.isArray(drillResults)
            ? drillResults.map((result: any) => result.responseSnapshot).filter(Boolean)
            : [];
        const scoringRows = res.data?.scoring || (Array.isArray(drillResults)
          ? drillResults.flatMap((result: any) =>
              Array.isArray(result.scoring)
                ? result.scoring.map((row: any) => ({ ...row, topic: result.topic }))
                : []
            )
          : null);
        setScoring(scoringRows || null);
        setResponseSnapshots(returnedSnapshots);
      } catch (err: any) {
        console.error("Intro session drill submission error:", err);
        const errorMessage = err?.response?.data?.message || err?.message || "Submission failed. Please try again.";
        const statusCode = err?.response?.status;
        setSubmitError(statusCode ? `${errorMessage} (${statusCode})` : errorMessage);
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      {drillSessionAccessLoading && (
        <div className="mb-4 p-3 rounded-md border border-primary/20 bg-primary/5">
          <p className="text-sm">Validating Response Integrity lesson context...</p>
        </div>
      )}
      {!drillSessionAccessLoading && !canUseScheduledSession && (
        <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="font-semibold">Live lesson context required</p>
            <p className="mt-2 text-sm">
              {drillMode === "diagnosis"
                ? "Return to the student card and launch this intro drill from the confirmed Response Integrity intro lesson."
                : "Return to Topic Conditioning and launch this drill from a live or imminently scheduled Response Integrity training lesson."}
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded-md border border-primary/20 bg-background hover:bg-primary/5"
              onClick={handleExitToPod}
            >
              Back to Pod
            </button>
          </div>
        </div>
      )}
      {canUseScheduledSession && scheduledSession && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Response Integrity Lesson</p>
          <p className="text-sm font-medium">
            {new Date(scheduledSession.scheduled_time).toLocaleString()}
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Status: {scheduledSession.status}</span>
            <span>Lesson Context: {scheduledSessionTypeLabel}</span>
          </div>
        </div>
      )}
      {(drillMode === "training" || isSessionMode) && workflowLoading && (
        <div className="mb-4 p-3 rounded-md border border-primary/20 bg-primary/5">
          <p className="text-sm">Checking assignment access...</p>
        </div>
      )}
      {(drillMode === "training" || isSessionMode) && !workflowLoading && !assignmentAccepted && (
        <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="font-semibold">Training access is locked</p>
            <p className="mt-2 text-sm">
              This student is assigned to you, but you must accept the assignment before running drills or training sessions.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded-md border border-primary/20 bg-background hover:bg-primary/5"
              onClick={handleExitToPod}
            >
              Back to Pod
            </button>
          </div>
        </div>
      )}
      {!drillSessionAccessLoading && canUseScheduledSession && !((drillMode === "training" || isSessionMode) && !workflowLoading && !assignmentAccepted) && (
      <>
      <div ref={resultTopRef} />
      {timingReadinessBlockedTopic && !submitSuccess && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Timing readiness required
          </div>
          <p className="mt-2 font-semibold">
            {timingReadinessBlockedTopic.topic} cannot continue ordinary Training yet.
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            This topic is already above Structured Execution but does not have valid individualized timing authority.
            RI is preserving the current phase truth and routing targeted evidence-native re-diagnosis instead of inserting calibration side reps.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
              onClick={handleOpenTimingRediagnosis}
            >
              Open Targeted Re-Diagnosis
            </button>
            <button
              type="button"
              className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-amber-100"
              onClick={handleExitToPod}
            >
              Exit to Pod
            </button>
          </div>
        </div>
      )}
      {(!drillStructure || (isSessionMode && topicDataLoading)) && (
        <div className="mb-4 p-3 rounded-md border border-primary/20 bg-primary/5">
          <p className="text-sm">Loading drill structure...</p>
        </div>
      )}
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          className="px-3 py-2 rounded-md border border-primary/20 bg-background hover:bg-primary/5"
          onClick={handleExitToPod}
        >
          Exit to Pod
        </button>
      </div>
      {submitSuccess && scoring && scoring.length > 0 && (() => {
        // Group rows by topic and set name so multi-topic sessions render clearly
        const setGroups: Record<string, typeof scoring> = {};
        scoring.forEach((row) => {
          const key = row.topic ? `${row.topic} · ${row.set}` : row.set;
          if (!setGroups[key]) setGroups[key] = [];
          setGroups[key].push(row);
        });
        const setNames = Object.keys(setGroups);
        const topicRows = scoring.reduce((acc: Record<string, typeof scoring>, row) => {
          const topicKey = row.topic || "Session";
          if (!acc[topicKey]) acc[topicKey] = [];
          acc[topicKey].push(row);
          return acc;
        }, {});
        const topicNames = Object.keys(topicRows);
        const topicSummaries = topicNames.map((topicName) => {
          const rows = topicRows[topicName];
          const lastRow = rows[rows.length - 1];
          const topicScore = lastRow?.sessionScore ?? 0;
          return {
            topicName,
            rows,
            lastRow,
            topicScore,
          };
        });
        const overallSessionScore = Math.round(
          topicSummaries.reduce((sum, topic) => sum + topic.topicScore, 0) / Math.max(topicSummaries.length, 1)
        );
        const compatibilityIsTechnicalOnly = scoring.every((row: any) =>
          row?.scoreAuthority === false ||
          row?.decisionAuthority === "evidence_native" ||
          row?.decisionAuthority === "behavioral_evidence"
        );
        const stabilityColorFor = (stability?: string | null) =>
          stability === "High Maintenance"
            ? "text-blue-700"
            : stability === "High"
            ? "text-green-700"
            : stability === "Medium"
            ? "text-yellow-700"
            : "text-red-700";
        const resultLabelFor = (row: any, topicName: string) => {
          if (drillMode === "diagnosis" && row?.bandLabel) {
            return `${topicName}: placed in ${row?.phase} at ${row?.stability} stability`;
          }
          const transitionReason = String(row?.transitionReason || row?.phaseDecision || "remain").toLowerCase();
          if (transitionReason === "targeted re-diagnosis required" || row?.requiresTargetedRediagnosis) {
            return `${topicName}: prerequisite trust is no longer sufficient for ordinary Training; state is held pending targeted re-diagnosis`;
          }
          if ((transitionReason === "phase progress" || row?.phaseDecision === "advance") && row?.phaseBefore !== row?.phase) {
            return `${topicName}: phase advanced to ${row?.phase} at ${row?.stability} stability`;
          }
          if (row?.phase === "Time Pressure Stability" && row?.stability === "High Maintenance") {
            return `${topicName}: sustained final-phase maintenance in ${row?.phase}`;
          }
          if (transitionReason === "stability regress" || row?.phaseDecision === "regress") {
            return `${topicName}: stability regressed to ${row?.stability} in ${row?.phase}`;
          }
          if (transitionReason === "high maintenance entry") {
            return `${topicName}: High Maintenance earned in ${row?.phase}`;
          }
          if (transitionReason === "stability advance") {
            return `${topicName}: stability improved to ${row?.stability} in ${row?.phase}`;
          }
          if (transitionReason === "final maintenance hold") {
            return `${topicName}: sustained final-phase maintenance in ${row?.phase}`;
          }
          return `${topicName}: stability held at ${row?.stability} in ${row?.phase}`;
        };
        const formatState = (phaseValue?: string | null, stabilityValue?: string | null) => {
          if (!phaseValue && !stabilityValue) return "Not recorded";
          if (!phaseValue) return String(stabilityValue || "Not recorded");
          if (!stabilityValue) return String(phaseValue || "Not recorded");
          return `${phaseValue} (${stabilityValue})`;
        };
        const getDisplayedActionDetails = (row: any) => {
          const transitionReason = String(row?.transitionReason || row?.phaseDecision || "remain").toLowerCase();
          const enteredMaintenanceCheckpoint =
            (transitionReason === "high maintenance entry" || transitionReason === "stability advance") &&
            row?.phaseBefore === row?.phase &&
            row?.stabilityBefore === "High" &&
            row?.stability === "High Maintenance";

          if (!enteredMaintenanceCheckpoint) {
            return {
              nextFocusLabel: "Next Session Focus",
              nextFocus: row?.nextAction || "Not recorded",
              followOnLabel: null as string | null,
              followOnAction: null as string | null,
              constraint: row?.constraint || null,
            };
          }

          const maintenanceAction = getNextActionData(row.phaseBefore, row.stabilityBefore);
          return {
            nextFocusLabel: "Immediate Next Drill",
            nextFocus: maintenanceAction.nextActions?.[0] || maintenanceAction.primaryAction || row?.nextAction || "Not recorded",
            followOnLabel: "Then If Strong Again",
            followOnAction: row?.nextAction || null,
            constraint: maintenanceAction.rules?.[0] || row?.constraint || null,
          };
        };
        return (
          <div className="mb-6 space-y-4">
            <div className="p-3 rounded-md border border-primary/25 bg-primary/10 text-foreground font-medium">
              Drill submitted. Evidence decision complete.
            </div>

            {isHandoverContinuityVerification && handoverEvidenceSummary && (
              <div className="rounded-2xl border border-primary/20 bg-background overflow-hidden">
                <div className="bg-primary/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    Response Evidence Decision
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {handoverEvidenceSummary.verificationOutcomeLabel ||
                      handoverEvidenceSummary.verificationOutcome.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="space-y-4 px-4 py-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-primary/10 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Inherited state
                      </p>
                      <p className="mt-1 font-semibold">
                        {handoverEvidenceSummary.phase} · {handoverEvidenceSummary.previousStability}
                      </p>
                    </div>
                    <div className="rounded-xl border border-primary/10 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Resulting state
                      </p>
                      <p className="mt-1 font-semibold">
                        {handoverEvidenceSummary.resultingPhase} · {handoverEvidenceSummary.resultingStability}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/10 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Why the system decided this
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {handoverEvidenceSummary.evidenceReason || handoverEvidenceSummary.reason}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Dimension evidence
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {handoverEvidenceSummary.dimensions.map((dimension) => {
                        const canonical = DIAGNOSIS_OBSERVATION_MATRIX[
                          dimension.dimensionId as DiagnosisDimensionId
                        ];
                        const latest = [...dimension.evidence].reverse()[0] || null;
                        const latestEligible = [...dimension.evidence].reverse().find(
                          (item) =>
                            item.evidenceClass !== "not_observed" &&
                            item.evidenceClass !== "confounded",
                        ) || null;
                        return (
                          <div
                            key={dimension.dimensionId}
                            className="rounded-xl border border-primary/10 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">
                                  {canonical?.label || dimension.dimensionId}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {latestEligible?.rawOption ||
                                    latest?.rawOption ||
                                    "No decision-eligible behavior yet"}
                                </p>
                              </div>
                              <span className="rounded-full border border-primary/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
                                {dimension.state.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                              {dimension.validOpportunityCount} valid · {dimension.supportedCount} supported · {dimension.nearStableCount} near-stable · {dimension.conditionalCount} conditional · {dimension.breakdownCount} breakdown
                            </p>
                            {dimension.recoveredAfterBreakdown && (
                              <p className="mt-1 text-xs font-medium text-foreground">
                                Recovery confirmed after earlier breakdown.
                              </p>
                            )}
                            {latest && ["not_observed", "confounded"].includes(latest.evidenceClass) && !latestEligible && (
                              <p className="mt-1 text-xs font-medium text-muted-foreground">
                                Latest evidence is {latest.evidenceClass.replace("_", " ")} and does not count as weakness or strength.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {handoverEvidenceSummary.nextAction && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                        What happens next
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {handoverEvidenceSummary.nextAction}
                      </p>
                      {handoverEvidenceSummary.constraint && (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Constraint: {handoverEvidenceSummary.constraint}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-xs leading-5 text-muted-foreground">
                    No compatibility score decided this Handover outcome. The decision above comes from the recorded Response Evidence behavior classes.
                  </p>
                </div>
              </div>
            )}

            {isHandoverContinuityVerification && responseSnapshots.length > 0 ? (
              <details className="rounded-xl border border-primary/15 bg-background px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  View technical Response Snapshot
                </summary>
                <div className="mt-3 space-y-3">
                  {responseSnapshots.map((snapshot) => (
                    <ResponseSnapshotCard
                      key={snapshot.source.sourceDrillId || `${snapshot.source.topic}-${snapshot.source.observedPhase}`}
                      snapshot={snapshot}
                    />
                  ))}
                </div>
              </details>
            ) : (
              responseSnapshots.map((snapshot) => (
                <ResponseSnapshotCard
                  key={snapshot.source.sourceDrillId || `${snapshot.source.topic}-${snapshot.source.observedPhase}`}
                  snapshot={snapshot}
                />
              ))
            )}

            <details className="rounded-xl border border-primary/15 bg-background px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                View compatibility scoring breakdown
              </summary>
              {compatibilityIsTechnicalOnly && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Technical reference only. These values do not determine phase, stability, regression, recovery, or re-diagnosis.
                </p>
              )}
              <div className="mt-3 space-y-3">
                {setNames.map((setName) => {
                  const rows = setGroups[setName];
                  const setMeta = rows.find((r) => typeof r.setPoints === "number" && typeof r.setMaxPoints === "number");
                  const setPercent = setMeta?.setScore ?? Math.round(rows.reduce((sum, r) => sum + (r.score ?? 0), 0) / rows.length);
                  const setPoints = setMeta?.setPoints ?? setPercent;
                  const setMaxPoints = setMeta?.setMaxPoints ?? 100;
                  return (
                    <div key={setName} className="rounded-xl border border-primary/15 bg-background overflow-hidden">
                      <div className="bg-primary/5 px-4 py-2 flex justify-between items-center">
                        <span className="font-semibold text-sm">{setName}</span>
                        <span className="text-sm text-muted-foreground">
                          Set Total: <strong>{setPoints}/{setMaxPoints || 100}</strong>
                          <span className="ml-2 text-xs">({setPercent}%)</span>
                        </span>
                      </div>
                      <div className="divide-y">
                        {rows.map((row, i) => (
                          <div key={i} className="px-4 py-2 flex justify-between items-center text-sm bg-background">
                            <span className="text-muted-foreground">Rep {row.rep}</span>
                            <span className={`font-medium ${
                              compatibilityIsTechnicalOnly
                                ? "text-muted-foreground"
                                : row.score >= 70
                                  ? "text-green-700"
                                  : row.score >= 45
                                    ? "text-yellow-700"
                                    : "text-red-700"
                            }`}>{row.score}/100</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>

            {/* Compatibility total remains visible only where score is still authoritative legacy metadata. */}
            {!compatibilityIsTechnicalOnly && (
              <div className="rounded-xl border border-primary/15 bg-background px-4 py-3 flex justify-between items-center">
                <span className="font-semibold">
                  {topicSummaries.length > 1 ? "Overall Compatibility Average" : "Compatibility Score"}
                </span>
                <span className={`text-lg font-bold ${
                  overallSessionScore >= 70 ? "text-green-700" : overallSessionScore >= 45 ? "text-yellow-700" : "text-red-700"
                }`}>{overallSessionScore}/100</span>
              </div>
            )}

            {/* Per-topic direction cards */}
            {!isHandoverContinuityVerification && topicSummaries.map(({ topicName, lastRow, topicScore }) => {
              const stabilityColor = stabilityColorFor(lastRow?.stability);
              const actionDetails = getDisplayedActionDetails(lastRow);
              return (
                <div key={topicName} className="rounded-xl border border-primary/15 bg-background overflow-hidden">
                  <div className="bg-primary/5 px-4 py-2">
                    <span className="font-semibold text-sm">
                      System Direction{topicSummaries.length > 1 ? ` · ${topicName}` : ""}
                    </span>
                  </div>
                  <div className="px-4 py-3 space-y-3 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">This Session Result</p>
                      <p className={`font-semibold ${stabilityColor}`}>{resultLabelFor(lastRow, topicName)}</p>
                    </div>
                    {!(
                      lastRow?.scoreAuthority === false ||
                      lastRow?.decisionAuthority === "evidence_native" ||
                      lastRow?.decisionAuthority === "behavioral_evidence"
                    ) && (
                      <div className="flex justify-between items-center pt-1 border-t">
                        <span className="text-muted-foreground">Topic Score</span>
                        <span className={`font-bold ${
                          topicScore >= 70 ? "text-green-700" : topicScore >= 45 ? "text-yellow-700" : "text-red-700"
                        }`}>{topicScore}/100</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Before</span>
                      <span className="font-medium">{formatState(lastRow?.phaseBefore, lastRow?.stabilityBefore)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Now</span>
                      <span className="font-medium">{formatState(lastRow?.phase, lastRow?.stability)}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{actionDetails.nextFocusLabel}</p>
                      <p className="font-semibold text-blue-700">{actionDetails.nextFocus}</p>
                    </div>
                    {actionDetails.followOnAction && (
                      <div className="mt-1 pt-2 border-t">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{actionDetails.followOnLabel}</p>
                        <p className="font-medium text-foreground">{actionDetails.followOnAction}</p>
                      </div>
                    )}
                    {actionDetails.constraint && (
                      <div className="mt-1 pt-2 border-t text-xs text-muted-foreground">
                        Constraint: {actionDetails.constraint}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
      {submitSuccess && (!scoring || scoring.length === 0) && (
        <div className="mb-4 p-3 rounded-md border border-primary/25 bg-primary/10 text-foreground">
          Drill submitted successfully.
        </div>
      )}
      {submitError && (
        <div className="mb-4 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive">
          {submitError}
        </div>
      )}
      {adaptiveDiagnosisMessage && !adaptiveTransition && !submitSuccess && (isAdaptiveVerificationFlow || isHandoverContinuityVerification) && (
        <div className="mb-4 p-3 rounded-md border border-primary/20 bg-primary/5 text-sm text-foreground">
          {adaptiveDiagnosisMessage}
        </div>
      )}
      {adaptiveTransition && !submitSuccess && isAdaptiveVerificationFlow && (
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">System Transition</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The current phase block is complete. Review the decision before opening the next diagnosis block.
            </p>
          </div>
          <div className="rounded-lg border border-primary/15 bg-background/80 p-4 space-y-2 text-sm">
            <p>
              <span className="font-medium text-foreground">Current Phase:</span> {adaptiveTransition.currentPhase}
            </p>
            <p>
              <span className="font-medium text-foreground">Phase Score:</span> {adaptiveTransition.phaseScore}/100
            </p>
            <p>
              <span className="font-medium text-foreground">System Decision:</span>{" "}
              {adaptiveTransition.direction === "escalate"
                ? `Move up to ${adaptiveTransition.nextPhase}`
                : `Drop to ${adaptiveTransition.nextPhase}`}
            </p>
            <p>
              <span className="font-medium text-foreground">Why:</span>{" "}
              {explainAdaptiveTransition(
                adaptiveTransition.currentPhase,
                adaptiveTransition.nextPhase,
                adaptiveTransition.direction,
              )}
            </p>
            <p>
              <span className="font-medium text-foreground">What happens next:</span>{" "}
              The drill screen will reset and open the {adaptiveTransition.nextPhase} diagnosis block.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleContinueAdaptiveTransition}
            >
              Continue to {adaptiveTransition.nextPhase}
            </button>
          </div>
        </div>
      )}
      {(isAdaptiveDiagnosisMode || isHandoverMode) && !submitSuccess && !prepReady && (
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {verificationPrepSpec.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdaptiveDiagnosisMode
                ? "Diagnosis prep is verification-readiness prep, not training prep."
                : handoverReDiagnosisMode
                  ? "Targeted re-diagnosis prep is for resolving one flagged inherited topic, not for normal training."
                  : "Handover prep is continuity-check prep, not intro prep and not training prep."}
            </p>
          </div>
          <div className="rounded-lg border border-primary/15 bg-background/80 p-3 space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Topic:</span> {hasIntroTopic ? introTopic : "Not set"}
            </p>
              <p>
                <span className="font-medium text-foreground">Phase:</span> {displayPhase}
              </p>
              {!isAdaptiveDiagnosisMode && (
              <p>
                <span className="font-medium text-foreground">Inherited Stability:</span> {previousStability || "Not recorded"}
              </p>
            )}
            <p>
              <span className="font-medium text-foreground">Objective:</span> {verificationPrepSpec.objective}
            </p>
            <div className="space-y-1">
              <p>
                <span className="font-medium text-foreground">Problem Prep:</span> {verificationPrepSpec.problemPlan}
              </p>
              {verificationPrepSpec.problemCoverage?.length ? (
                <div className="pl-0.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coverage For This Session</p>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    {verificationPrepSpec.problemCoverage.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {typeof verificationPrepSpec.totalProblems === "number" ? (
                    <p className="mt-2 text-sm text-foreground">
                      <span className="font-medium">Total problems:</span> {verificationPrepSpec.totalProblems}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <ul className="list-disc pl-5 text-sm text-foreground/90 space-y-1">
            {verificationPrepSpec.tutorRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <div className="rounded-lg border border-primary/15 bg-background/80 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required Confirmations</p>
            <div className="space-y-2">
              {verificationPrepSpec.checklist.map((item, index) => {
                const checkKey = `prep-${index}`;
                const checked = !!prepChecks[checkKey];
                return (
                  <button
                    type="button"
                    key={item}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      checked
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-primary/15 bg-background hover:bg-primary/5 text-muted-foreground"
                    }`}
                    onClick={() =>
                      setPrepChecks((prev) => ({
                        ...prev,
                        [checkKey]: !checked,
                      }))
                    }
                  >
                    <span className="font-medium">{checked ? "[x]" : "[ ]"}</span> {item}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{verificationPrepSpec.derivedFrom}</p>
          <div className="flex justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              onClick={() => setPrepReady(true)}
              disabled={!verificationPrepSpec.checklist.every((_, index) => prepChecks[`prep-${index}`])}
            >
              {isAdaptiveDiagnosisMode
                ? "Start Diagnosis"
                : handoverReDiagnosisMode
                  ? "Start Re-Diagnosis"
                  : "Start Verification"}
            </button>
          </div>
        </div>
      )}
      {drillStructure && set && (
        !((isAdaptiveDiagnosisMode || isHandoverMode) && !submitSuccess && (!prepReady || !!adaptiveTransition)) && (
        <>
          <h2 className="text-xl font-bold sm:text-2xl mb-2">
            {isSessionMode
              ? `Training Session - Topic ${sessionTopicIndex + 1} of ${sessionTopics.length}`
              : drillMode === "training"
              ? `Training Drill - ${phase}`
              : drillMode === "handover"
                ? handoverReDiagnosisMode
                  ? `Targeted Re-Diagnosis - ${displayPhase}`
                  : `Handover Verification - ${displayPhase}`
                : `Adaptive Intro Diagnosis - ${displayPhase}`}
          </h2>
      <p className="mb-2 text-sm">
        <span className="font-semibold">
          {isSessionMode ? "Current Topic:" : drillMode === "handover" ? "Carry-Over Topic:" : "Diagnostic Topic:"}
        </span>{" "}
        {isSessionMode ? currentTopicName : hasIntroTopic ? introTopic : "Not set"}
        {isSessionMode && currentSessionTopic && (
          <span className="ml-2 text-muted-foreground">
            ({currentTopicPhase} - {currentTopicStability})
          </span>
        )}
      </p>
      {!hasIntroTopic && !isSessionMode && (
        <div className="mb-4 p-3 rounded-md border border-primary/20 bg-primary/5 text-sm">
          {drillMode === "handover"
            ? "No carry-over topic was provided. Go back to the student card and open handover verification from the inherited topic state."
            : "No diagnostic topic was provided. Go back to the student card and use Add Diagnostic Topic before opening the intro session."}
        </div>
      )}
      <p className="mb-4 text-muted-foreground">{studentName || studentId}</p>
      {showSessionInstructions && (
        <div className="mb-4 p-3 rounded-md border border-primary/20 bg-primary/5">
          <p className="font-semibold mb-1">Session Instructions:</p>
          <ul className="list-disc pl-5 text-sm text-foreground/90 space-y-1">
            <li>
              This is a multi-topic training session. Complete drills for each selected topic in sequence.
            </li>
            <li>Each topic follows its own phase-specific drill structure based on current state.</li>
            <li>After completing all topics, the session results will be submitted together.</li>
            <li>You can navigate back to previous topics if needed, but all topics must be completed.</li>
          </ul>
        </div>
      )}
      {drillMode === "diagnosis" && showModeInstructions && (
        <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="font-semibold">Instructions</p>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowModeInstructions(false)}
            >
              Dismiss
            </button>
          </div>
          <ul className="list-disc pl-5 text-sm text-foreground/90 space-y-1">
            <li>This diagnosis is adaptive. Complete the current phase verification block exactly as shown.</li>
            <li><strong>Before you begin:</strong> Prepare <span className="font-semibold">3 distinct problems</span> for the current phase block.</li>
            <li>The system will move up, place here, or move down after each phase block based on the score band.</li>
            <li>You cannot skip steps or edit outside the verification structure. Complete each observation in order.</li>
            <li>Diagnosis stops automatically once the correct entry phase is verified.</li>
          </ul>
        </div>
      )}
      {drillMode === "handover" && showModeInstructions && (
        <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="font-semibold">Instructions</p>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowModeInstructions(false)}
            >
              Dismiss
            </button>
          </div>
          <ul className="list-disc pl-5 text-sm text-foreground/90 space-y-1">
            <li>
              {handoverReDiagnosisMode
                ? "This is targeted re-diagnosis inside handover. The inherited topic-state was not trustworthy enough to continue from."
                : "This is handover verification. You are checking whether the inherited topic-state is still trustworthy."}
            </li>
            <li>
              <strong>Before you begin:</strong>{" "}
              {handoverReDiagnosisMode
                ? "Prepare the diagnosis problems required for the targeted phase block."
                : "Prepare a small reserve bank of clean continuity problems. There is no fixed Handover rep count."}
            </li>
            <li>Do not turn this into normal training.</li>
            <li>
              {handoverReDiagnosisMode
                ? "Run adaptive diagnosis only for this flagged topic until the correct current phase is clear."
                : "Record one continuity opportunity at a time. The system stops Handover as soon as evidence is sufficient to hold, adjust, or require targeted re-diagnosis."}
            </li>
            {!handoverReDiagnosisMode && (
              <li>
                If a behavior was not meaningfully observable, record that directly. If support, interruption, or another condition changed what you were observing, record it as confounded. Neither outcome counts as weakness or strength.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Phase-level context bar -shown only on set 1 */}
      {isFirstSet && isFirstRep && <div className="mb-4 p-3 rounded-xl border border-primary/20 bg-primary/5 text-sm">
        <div className="font-semibold text-foreground mb-1">Phase: {displayPhase}</div>
        <div className="text-muted-foreground text-xs mb-2">{PHASE_CONTEXT[displayPhase].purpose}</div>
        <div className="flex flex-wrap gap-1">
          {PHASE_CONTEXT[displayPhase].constraints.map((c, i) => (
            <span key={i} className="px-2 py-0.5 bg-background border border-primary/20 text-foreground rounded text-xs font-medium">✕ {c}</span>
          ))}
        </div>
      </div>}

      {modeToUse === "training" && topicDataLoading && (
        <div className="mb-4 rounded-xl border border-primary/15 bg-background p-3 text-sm text-muted-foreground">
          Loading Topic Reference...
        </div>
      )}

      {modeToUse === "training" && !topicDataLoading && activeTopicReference && (
        <div className="mb-4 overflow-hidden rounded-xl border border-primary/20 bg-background">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-primary/5"
            onClick={() => setTopicReferenceOpen((open) => !open)}
            aria-expanded={topicReferenceOpen}
          >
            <span>
              <span className="block text-sm font-semibold text-foreground">Topic Reference</span>
              <span className="block text-xs text-muted-foreground">{currentTopicName}</span>
            </span>
            <span className="text-xs font-semibold text-primary">{topicReferenceOpen ? "Close" : "Open"}</span>
          </button>
          {topicReferenceOpen && (
            <div className="space-y-3 border-t border-primary/15 px-4 py-4">
              {[
                ["Vocabulary", activeTopicReference.vocabulary],
                ["Recognition / Method", activeTopicReference.method],
                ["Ordered Steps", activeTopicReference.steps],
                ["Reason", activeTopicReference.reason],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {shouldShowTopicReferenceCapture && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="mb-1 text-sm font-bold text-foreground">Create Topic Reference Before Drilling</div>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            Capture the mental map once for this student and topic. It will remain available to the Specialist throughout later drill phases.
          </p>
          <div className="space-y-4">
            {([
              ["vocabulary", "Vocabulary", "Define the important terms in clear, simple language."],
              ["method", "Recognition / Method", "Explain how to recognize this problem type and which method applies."],
              ["steps", "Ordered Steps", "Enter the exact step-by-step execution sequence, one step per line."],
              ["reason", "Reason", "Explain why the method and steps work."],
            ] as Array<[keyof TopicReferenceContent, string, string]>).map(([field, label, placeholder]) => (
              <label key={field} className="block">
                <span className="mb-1.5 block text-sm font-semibold text-foreground">{label}</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-primary/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  value={topicReferenceDraft[field]}
                  onChange={(event) => handleTopicReferenceChange(field, event.target.value)}
                  placeholder={placeholder}
                  maxLength={4000}
                  disabled={topicReferenceSaving}
                />
              </label>
            ))}
          </div>
          {topicReferenceError && (
            <p className="mt-3 text-sm font-medium text-destructive">{topicReferenceError}</p>
          )}
          {topicDataLoading && (
            <p className="mt-3 text-xs text-muted-foreground">
              Checking whether a Topic Reference already exists for this topic...
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              onClick={handleSaveTopicReference}
              disabled={topicReferenceSaving || topicDataLoading || Object.values(topicReferenceDraft).some((value) => !value.trim())}
            >
              {topicReferenceSaving ? "Saving..." : "Save Topic Reference"}
            </button>
          </div>
        </div>
      )}

      {/* Modeling session callout - shown only for Clarity Training Set 1 */}
      {set?.isModelingSet && (
        <div className="mb-4 p-4 rounded-xl border border-primary/25 bg-primary/10">
          <div className="font-bold text-foreground text-sm mb-1">MODELING STEP</div>
          <div className="text-muted-foreground text-xs leading-relaxed">
            Specialist teaches first. Student does <strong>NOT</strong> solve yet.<br />
            Run <strong>Vocabulary → Recognition / Method → Ordered Steps → Reason</strong>, then ask the student to explain back.<br />
            Sets 2 and 3 are the scored drill sets.
          </div>
        </div>
      )}

      {isTrainingEvidenceCapture && !set?.isModelingSet && !repStarted && (
        <div className="mb-5 rounded-2xl border border-primary/20 bg-background p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">Ready</span>
            <span>Observe</span>
            <span className="text-primary/30">→</span>
            <span>Confirm</span>
          </div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Set {currentSet + 1} of {drillStructure?.length ?? 0} · {set?.setName}
          </div>
          <div className="mt-1 flex items-end gap-3">
            <div className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              REP {currentRep + 1}
            </div>
            <div className="pb-1 text-sm font-semibold text-muted-foreground">
              of {set?.reps ?? 0}
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{set?.purpose}</p>
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              {instructionPromptLabelFor(set?.repInstruction || "")}
            </div>
            <div className="mt-1 text-base font-semibold text-foreground">
              {instructionPromptDisplayText(set?.repInstruction || "")}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {set?.activeRules?.map((rule, i) => (
              <span key={i} className="rounded-full border border-primary/15 px-2.5 py-1 text-xs text-muted-foreground">
                {rule}
              </span>
            ))}
          </div>
          {activeRepRequiresTpsTiming && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Individualized Timer Contract
              </div>
              {tpsTimerContractLoading ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Loading the student/topic timing authority...
                </p>
              ) : tpsTimerContract && activeTpsPrescribedSeconds ? (
                <>
                  <p className="mt-1 text-sm font-semibold">
                    This rep runs for {activeTpsPrescribedSeconds}s.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Baseline: {tpsTimerContract.baselineSeconds}s · Timer is system-owned and cannot be paused, edited, rounded, or replaced by a Specialist stopwatch.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-amber-800">
                  {tpsTimerContractError instanceof Error
                    ? tpsTimerContractError.message
                    : "TPS timing authority is unavailable. Do not begin this rep."}
                </p>
              )}
            </div>
          )}
          {passiveTimingNotice && !repStarted && (
            <div className="mt-3 rounded-lg border border-primary/15 bg-background p-3 text-xs leading-5 text-muted-foreground">
              {passiveTimingNotice}
            </div>
          )}
          {tpsTimingNotice && (
            <div className="mt-3 rounded-lg border border-primary/15 bg-background p-3 text-xs leading-5 text-muted-foreground">
              {tpsTimingNotice}
            </div>
          )}
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Use the problem prepared before the session. Once the rep starts, keep attention on the student's response rather than on form administration.
          </p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              onClick={beginTrainingRep}
              disabled={
                (modeToUse === "training" &&
                  (topicDataLoading ||
                    drillSessionAccessLoading ||
                    !canUseScheduledSession)) ||
                Boolean(timingReadinessBlockedTopic) ||
                (activeRepRequiresTpsTiming &&
                  (tpsTimerContractLoading ||
                    !tpsTimerContract ||
                    !activeTpsPrescribedSeconds ||
                    tpsAttemptPersisting))
              }
            >
              Begin Rep {currentRep + 1}
            </button>
          </div>
        </div>
      )}

      {isTrainingEvidenceCapture && !set?.isModelingSet && repStarted && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="rounded-full border border-primary/15 px-2 py-1">Ready ✓</span>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">Observe</span>
          <span className="text-primary/30">→</span>
          <span>Confirm</span>
        </div>
      )}

      {activeRepRequiresPassiveTiming && repStarted && (
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Passive baseline measurement
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                No countdown and no time target. Let the student execute naturally. The system began measuring at Begin Rep.
                Freeze the interval the moment the student's mathematical execution ends, before finishing observation admin.
              </p>
              {passiveTimingNotice && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {passiveTimingNotice}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                className="rounded-md border border-primary/20 bg-background px-4 py-2 text-sm font-semibold hover:bg-primary/5 disabled:cursor-default disabled:opacity-70"
                onClick={() => void finishActivePassiveTiming("student_finished")}
                disabled={
                  activePassiveTimingCaptured ||
                  passiveAttemptPersisting ||
                  !activePassiveAttempt
                }
              >
                {passiveAttemptPersisting
                  ? "Saving timing..."
                  : activePassiveAttempt?.frozenAttempt
                    ? "Retry Timing Save"
                    : activePassiveTimingCaptured
                      ? "Student Finished ✓"
                      : "Student Finished"}
              </button>
              {!activePassiveTimingCaptured && (
                <button
                  type="button"
                  className="rounded-md border border-amber-300 bg-background px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:cursor-default disabled:opacity-60"
                  onClick={() => void finishActivePassiveTiming("technical_failure")}
                  disabled={
                    passiveAttemptPersisting ||
                    !activePassiveAttempt ||
                    Boolean(activePassiveAttempt?.frozenAttempt)
                  }
                >
                  Technical Timing Failure
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Do not rush the student because timing is being measured, and do not let avoidable dead time enter the execution interval.
          </p>
        </div>
      )}

      {activeRepRequiresTpsTiming && repStarted && !activeTpsTimingCaptured && (
        <div className="mb-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                System timer · {set?.setName}
              </div>
              <div className="mt-1 text-4xl font-black tabular-nums tracking-tight">
                {activeTpsAttempt?.frozenAttempt
                  ? "Boundary frozen"
                  : formatCountdownSeconds(activeTpsRemainingMs)}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Prescribed: {activeTpsAttempt?.prescribedSeconds || activeTpsPrescribedSeconds || 0}s. There is no pause or manual override.
                Mark Student Finished at actual completion. If the timing system itself fails, record Technical Timer Failure so this attempt stays in lineage and the same rep can be replaced cleanly.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-default disabled:opacity-60"
                onClick={() =>
                  void finishActiveTpsTiming(
                    activeTpsAttempt?.frozenAttempt?.endReason ||
                      "student_finished",
                  )
                }
                disabled={tpsAttemptPersisting || !activeTpsAttempt}
              >
                {tpsAttemptPersisting
                  ? "Saving timing..."
                  : activeTpsAttempt?.frozenAttempt
                    ? "Retry Timing Save"
                    : "Student Finished"}
              </button>
              <button
                type="button"
                className="rounded-md border border-amber-300 bg-background px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:cursor-default disabled:opacity-60"
                onClick={() => void finishActiveTpsTiming("technical_failure")}
                disabled={
                  tpsAttemptPersisting ||
                  !activeTpsAttempt ||
                  Boolean(activeTpsAttempt?.frozenAttempt)
                }
              >
                Technical Timer Failure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set context block -purpose, rep instruction, active rules */}
      <div className={`mb-4 p-2 sm:p-3 rounded-xl border border-primary/15 bg-background shadow-sm ${isTrainingEvidenceCapture && !set?.isModelingSet && !repStarted ? "hidden" : ""}`}>
        <div className="mb-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Set {currentSet + 1} of {drillStructure.length} · {set?.setName}
          </div>
          <div className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {isModelingSet
              ? "PRE-DRILL STEP"
              : isHandoverContinuityVerification
                ? `EVIDENCE OPPORTUNITY ${currentRep + 1}`
                : `REP ${currentRep + 1} OF ${set?.reps ?? 0}`}
          </div>
        </div>
        <div className="text-xs text-muted-foreground mb-2 sm:mb-3">{set?.purpose}</div>
        <div className="p-2 rounded-md border border-primary/20 bg-primary/5 mb-2 sm:mb-3">
          <div className="text-xs font-semibold text-primary mb-0.5">
            {instructionPromptLabelFor(set?.repInstruction || "")}
          </div>
          <div className="text-xs sm:text-sm text-foreground font-medium">
            {instructionPromptDisplayText(set?.repInstruction || "")}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {set?.activeRules?.map((rule, i) => (
            <span key={i} className="px-1 sm:px-2 py-0.5 bg-background border border-primary/15 text-muted-foreground rounded text-[10px] sm:text-xs">{rule}</span>
          ))}
        </div>
      </div>

      {isTrainingEvidenceCapture && !set?.isModelingSet && repStarted && (
        <div className="mb-4 rounded-xl border border-primary/15 bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Support this rep</div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {TRAINING_INTERVENTION_OPTIONS.find((option) => option.id === currentTrainingIntervention())?.label || "No intervention"}
              </div>
            </div>
            <button
              type="button"
              className="rounded-md border border-primary/20 px-3 py-1.5 text-xs font-semibold hover:bg-primary/5"
              onClick={() => setSupportPickerOpen((open) => !open)}
            >
              {supportPickerOpen ? "Close" : "Change support"}
            </button>
          </div>
          {supportPickerOpen && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {TRAINING_INTERVENTION_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => handleTrainingIntervention(option.id)}
                  className={[
                    "rounded-lg border p-3 text-left",
                    currentTrainingIntervention() === option.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-primary/15 hover:bg-primary/5",
                  ].join(" ")}
                >
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.detail}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 border-t border-primary/10 pt-2">
            <button
              type="button"
              className="text-[11px] font-semibold text-primary hover:underline"
              onClick={() => setShowEvidenceExceptions((open) => !open)}
            >
              {showEvidenceExceptions ? "Hide evidence exceptions" : "Mark an evidence exception"}
            </button>
          </div>
        </div>
      )}

      <form className={`space-y-4 ${isTrainingEvidenceCapture && !set?.isModelingSet && !repStarted ? "hidden" : ""}`}>
        {getLiveObservationBlockForRep(set, currentRep).length === 0 && (
          <div className="p-3 rounded-md border border-primary/20 bg-primary/5 text-sm">
            No observations are captured for this step. Continue when pre-drill teaching is complete.
          </div>
        )}
        {getLiveObservationBlockForRep(set, currentRep).map((obs) => (
          <div key={obs.key}>
            <div className="mb-2">
              <label className="block font-medium text-sm sm:text-base">
                {obs.observationQuestion || obs.label}
              </label>
              {obs.observationQuestion && (
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {obs.label}
                </p>
              )}
            </div>
            <div className={(isHandoverContinuityVerification || isTrainingEvidenceCapture) ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-1 sm:gap-2"}>
              {obs.options.map((option: string) => (
                <button
                  type="button"
                  key={option}
                  className={
                    isHandoverContinuityVerification || isTrainingEvidenceCapture
                      ? [
                          "rounded-lg border p-3 text-left transition-colors",
                          observations[`set${currentSet}_rep${currentRep}_${obs.key}`] === option
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-primary/15 bg-background hover:bg-primary/5",
                        ].join(" ")
                      : `px-2 sm:px-3 py-1 rounded-md border text-xs sm:text-sm transition-colors whitespace-nowrap ${observations[`set${currentSet}_rep${currentRep}_${obs.key}`] === option ? "bg-primary text-primary-foreground border-primary" : "bg-background border-primary/20 hover:bg-primary/5"}`
                  }
                  onClick={() => handleObservation(obs.key, option)}
                >
                  {isHandoverContinuityVerification || isTrainingEvidenceCapture ? (
                    <>
                      <span className="block text-sm font-medium text-foreground">{option}</span>
                      {obs.optionDetails?.[option] && (
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {obs.optionDetails[option]}
                        </span>
                      )}
                    </>
                  ) : (
                    option
                  )}
                </button>
              ))}
            </div>
            {isTrainingEvidenceCapture && showEvidenceExceptions && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Evidence validity
                </span>
                {([
                  ["observed", "Observed cleanly"],
                  ["not_observed", "Not meaningfully observed"],
                  ["confounded", "Confounded"],
                ] as Array<[TrainingEvidenceStatus, string]>).map(([status, label]) => (
                  <button
                    type="button"
                    key={status}
                    onClick={() => handleTrainingEvidenceStatus(obs.key, status)}
                    className={[
                      "rounded-md border px-2 py-1 text-[11px]",
                      currentTrainingEvidenceStatus(obs.key) === status
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-primary/15 text-muted-foreground hover:bg-primary/5",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {isTrainingEvidenceCapture &&
          !set?.isModelingSet &&
          repStarted &&
          repNeedsTrainingPrerequisiteSentinel(currentSet, currentRep) &&
          (() => {
            const sentinelDefinition = getTrainingPrerequisiteSentinelDefinition(displayPhase);
            if (!sentinelDefinition) return null;
            const selected = trainingPrerequisiteSentinelResultFor(currentSet, currentRep);
            const options: Array<{
              id: TrainingPrerequisiteSentinelResult;
              label: string;
              detail: string;
            }> = [
              {
                id: "held",
                label: sentinelDefinition.heldLabel,
                detail: "The stripped-constraint check preserves trust in the earlier prerequisite. Keep this breakdown inside the current phase.",
              },
              {
                id: "contradicted",
                label: sentinelDefinition.contradictedLabel,
                detail: "The lower prerequisite is contradicted. The system will freeze ordinary Training and require evidence-native re-diagnosis.",
              },
              {
                id: "not_observed",
                label: "Could not meaningfully observe the prerequisite",
                detail: "The prerequisite is unresolved. The system will require re-diagnosis rather than guess.",
              },
              {
                id: "confounded",
                label: "Prerequisite check was confounded",
                detail: "Support, interruption, task mismatch, or another factor prevented a clean prerequisite check.",
              },
            ];
            return (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  Prerequisite sentinel required
                </div>
                <p className="mt-2 text-sm font-semibold text-amber-950">
                  {sentinelDefinition.evidenceQuestion}
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  {sentinelDefinition.specialistInstruction}
                </p>
                <p className="mt-2 text-xs leading-5 text-amber-800">
                  This check does not move the topic backward. It only decides whether the earlier prerequisite can still be trusted or whether the evidence-complete diagnosis engine must re-establish the entry state.
                </p>
                <div className="mt-3 grid gap-2">
                  {options.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => handleTrainingPrerequisiteSentinel(option.id)}
                      className={[
                        "rounded-lg border p-3 text-left",
                        selected === option.id
                          ? "border-amber-600 bg-white ring-1 ring-amber-600"
                          : "border-amber-200 bg-white/70 hover:bg-white",
                      ].join(" ")}
                    >
                      <span className="block text-sm font-medium text-foreground">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.detail}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
      </form>
        </>
        )
      )}
      {(!(isTrainingEvidenceCapture && !set?.isModelingSet && !repStarted) && !((isAdaptiveDiagnosisMode || isHandoverMode) && !submitSuccess && (!prepReady || !!adaptiveTransition))) && (
      <div className="mt-6 flex justify-end">
        {!submitSuccess && (
          <button
            type="button"
            className="mr-2 px-4 py-2 rounded-md border border-primary/20 bg-background hover:bg-primary/5 disabled:opacity-60"
            onClick={handleBackStep}
            disabled={submitting || (isFirstSet && isFirstRep && (!isSessionMode || sessionTopicIndex === 0))}
          >
            Back
          </button>
        )}
        <button
          type="button"
            className={`px-4 py-2 rounded-md text-primary-foreground disabled:opacity-60 ${
            submitSuccess ? "bg-primary cursor-default" : "bg-primary hover:bg-primary/90"
          }`}
          onClick={handleNext}
          disabled={
            submitting ||
            submitSuccess ||
            topicReferenceSaving ||
            (!isSessionMode && !hasIntroTopic) ||
            (modeToUse === "training" && topicDataLoading && !shouldShowTopicReferenceCapture) ||
            !drillStructure ||
            !set ||
            shouldShowTopicReferenceCapture ||
            Boolean(timingReadinessBlockedTopic) ||
            (activeRepRequiresPassiveTiming && !activePassiveTimingCaptured) ||
            (activeRepRequiresTpsTiming && !activeTpsTimingCaptured)
          }
        >
          {submitSuccess
            ? "Submitted"
            : submitting
            ? "Submitting..."
            : isHandoverContinuityVerification
            ? "Evaluate Continuity Evidence"
            : isAdaptiveVerificationFlow && isLastRep
            ? "Verify Phase"
            : isHandoverMode && isLastSet && isLastRep
            ? "Submit Verification"
            : isLastSet && isLastRep
            ? "Submit Drill"
            : set?.isModelingSet && isLastRep
            ? "Start Drilling"
            : isTrainingEvidenceCapture
            ? isLastRep
              ? "Confirm Set"
              : "Confirm Rep"
            : "Next"}
        </button>
      </div>
      )}
      {submitSuccess && (
        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            className="px-4 py-2 rounded-md border border-primary/20 bg-background hover:bg-primary/5"
            onClick={handleExitToPod}
          >
            Back to Pod
          </button>
          {drillMode === "diagnosis" && diagnosisSessionKind === "intro" && (
            <button
              type="button"
              className="px-4 py-2 rounded bg-primary text-white"
              onClick={handleContinueToProposal}
            >
              Continue to Proposal
            </button>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}
