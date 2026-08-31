import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, Expand, X } from "lucide-react";
import { observationLevelFromOptionIndex, type ObservationLevel } from "@shared/observationScoring";
import {
  buildResponseSnapshotV1,
  formatSnapshotPurposeText,
  formatSnapshotRepResult,
  formatSnapshotResultText,
  type ResponseSnapshotV1,
} from "@shared/responseSnapshot";
import {
  computeAdaptiveDiagnosisPhaseSummary,
  getAdjacentDiagnosisPhase,
} from "@shared/adaptiveDiagnosis";
import {
  getNextActionData,
  type PhaseLabel,
  type StabilityLabel,
} from "@/components/tutor/topicConditioningEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ObservationField = {
  key: string;
  label: string;
  options: string[];
  optionLevels?: Record<string, ObservationLevel>;
};
type DrillSetConfig = {
  setName: string;
  reps: number;
  purpose: string;
  repInstruction: string;
  activeRules: string[];
  observationBlock?: ObservationField[];
  repObservationBlocks?: ObservationField[][];
  isModelingSet?: boolean;
};

type DemoMode = "diagnosis" | "training" | "handover";

type DemoSummary = {
  phase: PhaseLabel;
  stability: StabilityLabel;
  phaseScore: number;
  nextAction: string;
  constraint: string | null;
  highGuardPasses: boolean;
  setScores: number[];
  repRows: Array<{ set: string; rep: number; repScore: number }>;
  systemDecision: string;
  transitionReason: string;
  tutorMeaning: string;
  phaseBefore: string | null;
  stabilityBefore: string | null;
};

function responseSnapshotColor(level: string) {
  if (level === "strong") return "text-green-700";
  if (level === "partial") return "text-yellow-700";
  if (level === "weak") return "text-red-700";
  return "text-muted-foreground";
}

function ResponseSnapshotCard({ snapshot }: { snapshot: ResponseSnapshotV1 }) {
  return (
    <div className="overflow-hidden rounded-xl border border-primary/15 bg-background">
      <div className="flex flex-col gap-1 bg-primary/5 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold">Response Snapshot</span>
        <span className={`text-sm font-semibold ${responseSnapshotColor(snapshot.drill.responseLevel)}`}>
          {snapshot.drill.responseLabel} - {snapshot.drill.score ?? "Not scored"}/100
        </span>
      </div>
      <div className="space-y-3 px-4 py-3 text-sm">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">What This Drill Tested</p>
          <p className="text-foreground">{formatSnapshotPurposeText(snapshot.drill.purposeText)}</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Drill Response</p>
          <p className="text-muted-foreground">{formatSnapshotResultText(snapshot.drill.resultText)}</p>
        </div>
        <div className="space-y-2 border-t pt-1">
          {snapshot.sets.map((set) => (
            <div key={set.setId} className="rounded-md border border-primary/10 bg-primary/5 px-3 py-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-foreground">{set.setName}</p>
                <p className={`text-xs font-semibold ${responseSnapshotColor(set.responseLevel)}`}>
                  {set.responseLabel} - {set.score ?? "Not scored"}/100
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
                        {rep.responseLabel} - {rep.score ?? "Not scored"}/100
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

type DemoAdaptiveStep = {
  phase: PhaseLabel;
  phaseScore: number;
  band: "de-escalate" | "place" | "escalate";
  nextPhase: PhaseLabel | null;
};

type DemoAdaptiveTransition = {
  currentPhase: PhaseLabel;
  nextPhase: PhaseLabel;
  phaseScore: number;
  direction: "escalate" | "de-escalate";
  currentStep: DemoAdaptiveStep;
};

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

type DemoPrepPlan = {
  title: string;
  drillType: string;
  setPlans: Array<{ label: string; problems: number; difficulty: string }>;
  objective: string;
  prepNotes: string[];
  checklist: string[];
  derivedFrom: string;
};

const PHASES: PhaseLabel[] = [
  "Clarity",
  "Structured Execution",
  "Controlled Discomfort",
  "Time Pressure Stability",
];

const PHASE_CONTEXT: Record<PhaseLabel, { purpose: string; constraints: string[] }> = {
  Clarity: {
    purpose:
      "Can the student see the problem clearly before solving? Clarity is naming what's there, recognizing the method, understanding why. If this is unstable, later performance also becomes unstable.",
    constraints: ["No Boss Battles", "No time pressure", "No skipping layers"],
  },
  "Structured Execution": {
    purpose:
      "Test and build ability to execute the known method independently. Student knows - now prove they can do it alone, repeatably.",
    constraints: ["State steps before solving", "No guessing tolerated", "No skipping steps"],
  },
  "Controlled Discomfort": {
    purpose:
      "Test and stabilize behavior under uncertainty and difficulty. Does the student persist - or shut down?",
    constraints: ["No full rescue", "Hold discomfort window", "One-step confirmation max"],
  },
  "Time Pressure Stability": {
    purpose:
      "Maintain method structure under urgency. Structure is the target - speed is secondary.",
    constraints: ["Method over speed", "Timer is active", "Structured response required - reactive responding is logged as instability"],
  },
};

const DIAGNOSIS_SETS_BY_PHASE: Record<PhaseLabel, DrillSetConfig[]> = {
  Clarity: [
    {
      setName: "Recognition Probe",
      reps: 3,
      purpose: "Student does not solve. Tests vocabulary, type recognition, and step awareness only.",
      repInstruction:
        "Show the problem. Ask student to name terms, identify type, and state the steps. Do not let them solve.",
      activeRules: ["Student does not solve", "Recognition only", "No hints or steps from tutor"],
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
      activeRules: ["No help for 10 seconds", "Observe cold start behavior", "Record exactly what happens"],
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
      activeRules: ["Similar problem", "No step-by-step guidance", "Observe consistency across reps"],
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
      activeRules: ["No help for 10 seconds", "Hold the discomfort window", "Avoid rescue beyond the phase allowance"],
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
      activeRules: ["One-step confirmation only", "No rescue allowed", "Hold pressure"],
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
      activeRules: ["Timer is active", "Observe structure", "Record panic vs controlled response"],
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
      activeRules: ["Same timer", "Observe drift and consistency", "Pattern matters more than speed"],
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
      repInstruction: "Teach Vocabulary -> Method -> Reason, then ask the student to explain back.",
      isModelingSet: true,
      activeRules: ["Tutor models first", "Student does not solve yet", "Use Vocabulary -> Method -> Reason"],
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
      purpose: "Test clarity under active solving with minimal guidance.",
      repInstruction: "Ask student to solve. Minimal guidance only.",
      activeRules: ["Minimal guidance only", "No step-by-step help", "Observe whether clarity holds under solving"],
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
      purpose: "Student must state all steps first, then solve.",
      repInstruction: "State steps first. Then solve.",
      activeRules: ["Steps must be stated first", "No skipping steps", "Correct step order required"],
      observationBlock: [
        { key: "startBehavior", label: "Start", options: ["delayed", "hesitant", "immediate"] },
        { key: "stepExecution", label: "Step Discipline", options: ["skips", "partial", "full"] },
        {
          key: "repeatability",
          label: "Correction Response",
          options: ["resists", "accepts", "adjusts", "already structured correctly"],
          optionLevels: {
            resists: "weak",
            accepts: "partial",
            adjusts: "clear",
            "already structured correctly": "clear",
          },
        },
        { key: "independence", label: "Independence", options: ["needs help", "light support", "independent"] },
      ],
    },
    {
      setName: "Independent Execution",
      reps: 3,
      purpose: "Full independent execution without help.",
      repInstruction: "Solve independently.",
      activeRules: ["No help from tutor", "Full independence expected", "Watch consistency and error handling"],
      observationBlock: [
        { key: "independence", label: "Independence", options: ["needs help", "light support", "independent"] },
        { key: "repeatability", label: "Consistency", options: ["breaks", "inconsistent", "stable"] },
        {
          key: "stepExecution",
          label: "Error Handling",
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
      purpose: "Test transfer to a slightly different form using the same method.",
      repInstruction: "Solve slightly different form.",
      activeRules: ["Same method, different form", "Test transfer, not memorization", "No hints on what changed"],
      observationBlock: [
        { key: "stepExecution", label: "Transfer", options: ["cannot adapt", "partial", "adapts"] },
        { key: "repeatability", label: "Step Retention", options: ["lost", "partial", "stable"] },
        { key: "independence", label: "Completion", options: ["fails", "partial", "complete"] },
        { key: "startBehavior", label: "Start", options: ["delayed", "hesitant", "immediate"] },
      ],
    },
  ],
  "Controlled Discomfort": [
    {
      setName: "Controlled Entry",
      reps: 3,
      purpose: "Build controlled entry under difficulty.",
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
      purpose: "Build independence under difficulty with no rescue.",
      repInstruction: "Continue. No full help.",
      activeRules: ["No full rescue in this phase", "Maintain the discomfort window", "Observe rescue-seeking pattern"],
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
      purpose: "Repeat exposure to build tolerance at the same difficulty.",
      repInstruction: "Another similar difficulty.",
      activeRules: ["Same difficulty level", "Repeat exposure", "Observe consistency of response"],
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
      purpose: "Build structured execution under a timer.",
      repInstruction: "Focus on method, not speed.",
      activeRules: ["Timer active", "Method first", "Structure must be maintained"],
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
      purpose: "Build consistency under repeated timed execution.",
      repInstruction: "Repeat under timer.",
      activeRules: ["Same timer", "Build consistency", "Observe pace regulation"],
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
      purpose: "Full constraint drill with tighter time.",
      repInstruction: "Solve under tighter time.",
      activeRules: ["Tighter timer", "No relief", "Structure and completion both matter"],
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

const INTRO_PHASE_WEIGHTS: Record<PhaseLabel, Array<{ aliases: string[]; weight: number }>> = {
  Clarity: [
    { aliases: ["vocabulary"], weight: 30 },
    { aliases: ["method"], weight: 30 },
    { aliases: ["reason"], weight: 20 },
    { aliases: ["immediateApply"], weight: 20 },
  ],
  "Structured Execution": [
    { aliases: ["startBehavior"], weight: 25 },
    { aliases: ["stepExecution"], weight: 30 },
    { aliases: ["repeatability"], weight: 25 },
    { aliases: ["independence"], weight: 20 },
  ],
  "Controlled Discomfort": [
    { aliases: ["initialResponse"], weight: 30 },
    { aliases: ["firstStepControl"], weight: 25 },
    { aliases: ["discomfortTolerance"], weight: 25 },
    { aliases: ["rescueDependence"], weight: 20 },
  ],
  "Time Pressure Stability": [
    { aliases: ["startUnderTime"], weight: 20 },
    { aliases: ["structureUnderTime"], weight: 35 },
    { aliases: ["paceControl"], weight: 20 },
    { aliases: ["completionIntegrity"], weight: 25 },
  ],
};

const flow = [
  "Open the verification block and review the tutor prep step first.",
  "Run each rep exactly as written.",
  "Choose the option that best matches what the student actually did.",
  "Finish the block without rewriting what happened.",
  "Submit to see the evidence summary and system output.",
];

const rules = [
  "Only log what the student actually did.",
  "Do not guess or fill gaps with your own interpretation.",
  "Use the drill options exactly as they are written.",
  "If you did not see it happen, do not log it.",
];

const scoringRules = [
  "The first option is the weakest response.",
  "The middle option is partial.",
  "The last option is the strongest response.",
  "The selected options roll up into rep scores, set totals, and the final phase summary.",
];

const resultOutputs = [
  "Rep totals and grouped drill totals",
  "Phase total",
  "System output",
  "Reason",
  "Tutor meaning",
  "Next action",
  "Current phase rule or drill constraint",
];

const auditRisks = [
  "Selecting stronger observation options than the rep justified",
  "Logging a smoother response pattern than the drill score supports",
  "Altering or misreporting the automatic system result after scoring",
  "Writing around a rescue, pressure break, or structure collapse",
];

function getObservationBlockForRep(setConfig: DrillSetConfig, repIndex: number): ObservationField[] {
  if (setConfig.repObservationBlocks?.[repIndex]) {
    return setConfig.repObservationBlocks[repIndex];
  }
  return setConfig.observationBlock || [];
}

function hasScoredObservations(setConfig: DrillSetConfig): boolean {
  return setConfig.reps > 0 && getObservationBlockForRep(setConfig, 0).length > 0;
}

function observationLevelForField(field: ObservationField, optionIndex: number, selectedLabel: string): ObservationLevel {
  const explicitLevel = field.optionLevels?.[selectedLabel];
  if (explicitLevel) return explicitLevel;
  return observationLevelFromOptionIndex(optionIndex, field.options.length);
}

function weightedScoreFor(field: ObservationField, weight: number, optionIndex: number, selectedLabel: string) {
  const level = observationLevelForField(field, optionIndex, selectedLabel);
  if (level === "clear") return weight;
  if (level === "partial") return Math.round(weight * 0.6);
  return 0;
}

function observationKey(setIndex: number, repIndex: number, fieldKey: string) {
  return `set${setIndex}_rep${repIndex}_${fieldKey}`;
}

function guardPassesForPhase(phase: PhaseLabel, repObservations: Record<string, string>[]) {
  if (phase === "Clarity") {
    return !repObservations.some((repObs) =>
      INTRO_PHASE_WEIGHTS[phase].some((field) => {
        const rawValue = String(repObs[field.aliases[0]] || "").trim();
        return !rawValue || rawValue === "none" || rawValue === "wrong" || rawValue.includes("cannot");
      }),
    );
  }

  if (phase === "Structured Execution") {
    return !repObservations.some((repObs) => {
      const step = String(repObs.stepExecution || "").toLowerCase();
      const start = String(repObs.startBehavior || "").toLowerCase();
      return step.includes("guess") || start.includes("avoid");
    });
  }

  if (phase === "Controlled Discomfort") {
    return !repObservations.some((repObs) => {
      const initial = String(repObs.initialResponse || "").toLowerCase();
      const firstStep = String(repObs.firstStepControl || "").toLowerCase();
      return initial.includes("freeze") || firstStep === "none";
    });
  }

  return !repObservations.some((repObs) => {
    const structure = String(repObs.structureUnderTime || "").toLowerCase();
    const pace = String(repObs.paceControl || "").toLowerCase();
    return !structure.includes("maintained") || !pace.includes("controlled");
  });
}

function buildDemoSummary(
  phase: PhaseLabel,
  sets: DrillSetConfig[],
  observations: Record<string, string>,
  mode: DemoMode,
): DemoSummary {
  const repRows: Array<{ set: string; rep: number; repScore: number }> = [];
  const setScores: number[] = [];
  let highGuardPasses = true;

  sets.forEach((setConfig, setIndex) => {
    if (!hasScoredObservations(setConfig)) return;

    const repScores: number[] = [];
    const repObservations: Record<string, string>[] = [];

    for (let repIndex = 0; repIndex < setConfig.reps; repIndex += 1) {
      const fields = getObservationBlockForRep(setConfig, repIndex);
      let repScore = 0;
      const repObs: Record<string, string> = {};

      fields.forEach((field) => {
        const selected = observations[observationKey(setIndex, repIndex, field.key)] || "";
        repObs[field.key] = selected;
        const optionIndex = field.options.indexOf(selected);
        if (optionIndex >= 0) {
          const phaseWeight = INTRO_PHASE_WEIGHTS[phase].find((item) => item.aliases.includes(field.key))?.weight || 0;
          repScore += weightedScoreFor(field, phaseWeight, optionIndex, selected);
        }
      });

      const normalizedRepScore = Math.max(0, Math.min(100, Math.round(repScore)));
      repRows.push({ set: setConfig.setName, rep: repIndex + 1, repScore: normalizedRepScore });
      repScores.push(normalizedRepScore);
      repObservations.push(repObs);
    }

    const setScore = repScores.length > 0
      ? Math.round(repScores.reduce((sum, value) => sum + value, 0) / repScores.length)
      : 0;
    setScores.push(setScore);

    if (!guardPassesForPhase(phase, repObservations)) {
      highGuardPasses = false;
    }
  });

  const phaseScore = setScores.length > 0
    ? Math.round(setScores.reduce((sum, score) => sum + score, 0) / setScores.length)
    : 0;

  let stability: StabilityLabel = "Low";
  if (phaseScore <= 49) stability = "Low";
  else if (phaseScore <= 69) stability = "Medium";
  else stability = highGuardPasses ? "High" : "Medium";

  const nextActionData = getNextActionData(phase, stability);
  const systemDecision =
    stability === "High"
      ? "Advance signal"
      : stability === "Medium"
      ? "Hold current phase"
      : "Reinforce before advancing";
  const transitionReason =
    stability === "High"
      ? "Observation totals cleared the drill threshold and the high guard held."
      : stability === "Medium"
      ? "The drill showed partial stability, but not enough repeatable proof for a clean advance."
      : "The drill still shows breakdowns strong enough to block progression.";
  const tutorMeaning =
    stability === "High"
      ? "The student is showing repeatable control in this phase. The tutor can prepare the next drill direction, but should still respect the system constraint."
      : stability === "Medium"
      ? "The student is improving, but the phase is not stable enough to move on. The tutor should keep drilling this response pattern."
      : "The student is still unstable in the target behavior. The tutor needs another reinforcement pass before expecting reliable carryover.";
  const phaseBefore = mode === "diagnosis" ? null : phase;
  const stabilityBefore = mode === "diagnosis" ? null : "Starting Point";

  return {
    phase,
    stability,
    phaseScore,
    nextAction: nextActionData.primaryAction,
    constraint: nextActionData.rules[0] || null,
    highGuardPasses,
    setScores,
    repRows,
    systemDecision,
    transitionReason,
    tutorMeaning,
    phaseBefore,
    stabilityBefore,
  };
}

function serializeDemoSetObservations(
  setConfig: DrillSetConfig,
  setIndex: number,
  observations: Record<string, string>,
): Array<Record<string, string>> {
  return Array.from({ length: setConfig.reps }, (_, repIndex) => {
    const fields = getObservationBlockForRep(setConfig, repIndex);
    const repObs: Record<string, string> = {};
    fields.forEach((field) => {
      const selectedLabel = observations[observationKey(setIndex, repIndex, field.key)] || "";
      const optionIndex = field.options.findIndex((option) => option === selectedLabel);
      const selectedLevel = observationLevelForField(field, optionIndex, selectedLabel);
      repObs[field.key] = selectedLabel;
      repObs[`${field.key}_level`] = selectedLevel;
    });
    return repObs;
  });
}

function demoPrepPlanFor(phase: PhaseLabel, mode: DemoMode): DemoPrepPlan | null {
  const baseDifficulty = "Simple/Normal";
  const drillType =
    mode === "diagnosis"
      ? `${phase} Diagnosis Block`
      : mode === "handover"
        ? `${phase} Verification Block`
        : `${phase} Drill`;
  const isVerificationMode = mode === "diagnosis" || mode === "handover";
  const title =
    mode === "diagnosis"
      ? "Diagnosis Prep"
      : mode === "handover"
        ? "Handover Prep"
        : "Training Prep";
  const objective =
    mode === "diagnosis"
      ? `Place the topic correctly in ${phase}.`
      : mode === "handover"
        ? `Verify whether the inherited ${phase} topic-state still holds.`
        : `Run the correct ${phase} training drill for the current topic-state.`;
  const verificationSetPlan = [
    {
      label: mode === "handover" ? "Verification Block" : "Diagnosis Block",
      problems: 3,
      difficulty:
        phase === "Clarity"
          ? "Simple/Normal"
          : phase === "Structured Execution"
            ? "Simple/Normal"
            : "Phase-appropriate challenge",
    },
  ];
  const previousPhase = getAdjacentDiagnosisPhase(phase, "previous");
  const nextPhase = getAdjacentDiagnosisPhase(phase, "next");
  const adaptiveCoverage = [previousPhase, phase, nextPhase].filter(Boolean) as PhaseLabel[];
  const adaptiveCoverageNotes = adaptiveCoverage.map((coveragePhase) => {
    const coverageBlock = ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE[coveragePhase];
    return `${coveragePhase}: ${coverageBlock.reps} ${coverageBlock.setName} problems`;
  });
  const adaptiveCoverageProblemTotal = adaptiveCoverage.reduce((total, coveragePhase) => {
    const coverageBlock = ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE[coveragePhase];
    return total + coverageBlock.reps;
  }, 0);

  if (phase === "Clarity") {
    return {
      title,
      drillType,
      setPlans: isVerificationMode
        ? verificationSetPlan
        : [
            { label: "Set 1: Modeling", problems: 2, difficulty: baseDifficulty },
            { label: "Set 2: Identification", problems: 3, difficulty: baseDifficulty },
            { label: "Set 3: Light Apply", problems: 3, difficulty: baseDifficulty },
          ],
      objective,
      prepNotes: [
        ...(isVerificationMode
          ? [
              ...(mode === "diagnosis"
                ? [
                    "Prepare the starting phase first.",
                    ...adaptiveCoverageNotes,
                    `Total problems across this diagnosis coverage: ${adaptiveCoverageProblemTotal}.`,
                    "Also prepare the phase just below and the phase just above it, because the system may move there during diagnosis.",
                  ]
                : [
                    "Prepare exactly 3 clean Clarity phase-block problems.",
                  ]),
              "Use the Clarity phase target, but strip the system down to verification only.",
              "No full teaching cycle and no normal training expansion.",
            ]
          : [
              "Set 1 is teaching only; no scored observations.",
              "Prepare 8 total problems (2 model + 6 drill reps).",
              "No boss battles and no timed pressure in Clarity.",
              "Difficulty: keep all problems at Simple/Normal level.",
            ]),
      ],
      checklist: isVerificationMode
        ? [
            mode === "diagnosis"
              ? `I prepared the starting phase and adjacent coverage for: ${adaptiveCoverage.join(", ")}.`
              : "I prepared exactly 3 clean Clarity verification problems.",
            mode === "diagnosis"
              ? "I will use this to place the topic, not to run a normal training session."
              : "I will use this to verify inherited state, not to restart or train forward.",
            "I will hold the Clarity phase rules exactly as shown.",
          ]
        : [
            "I prepared the full drill problem count.",
            "I am ready to run the full training structure.",
            "I will hold the phase rules exactly as shown.",
          ],
      derivedFrom: isVerificationMode
        ? mode === "diagnosis"
          ? "Derived from the Clarity training lane and expanded to bidirectional adaptive diagnosis coverage."
          : "Derived from the Clarity training lane and reduced to a single phase verification block."
        : "Full Clarity training structure.",
    };
  }

  if (phase === "Structured Execution") {
    return {
      title,
      drillType,
      setPlans: isVerificationMode
        ? verificationSetPlan
        : [
            { label: "Set 1", problems: 3, difficulty: baseDifficulty },
            { label: "Set 2", problems: 3, difficulty: baseDifficulty },
            { label: "Set 3", problems: 3, difficulty: baseDifficulty },
          ],
      objective,
      prepNotes: [
        ...(isVerificationMode
          ? [
              ...(mode === "diagnosis"
                ? [
                    "Prepare the starting phase first.",
                    ...adaptiveCoverageNotes,
                    `Total problems across this diagnosis coverage: ${adaptiveCoverageProblemTotal}.`,
                    "Also prepare the phase just below and the phase just above it, because the system may move there during diagnosis.",
                  ]
                : [
                    "Prepare exactly 3 clean Structured Execution phase-block problems.",
                  ]),
              "Use the same cold-start execution target as training, but only for verification.",
              "No extra tutor prompting beyond the phase rules.",
            ]
          : [
              "Prepare 9 total problems (3 sets x 3 reps).",
              "Focus on independent starts and full step sequence.",
              "Difficulty: keep all problems at Simple/Normal level.",
            ]),
      ],
      checklist: isVerificationMode
        ? [
            mode === "diagnosis"
              ? `I prepared the starting phase and adjacent coverage for: ${adaptiveCoverage.join(", ")}.`
              : "I prepared exactly 3 Structured Execution verification problems.",
            "I will hold the no-help start window and structure target.",
            mode === "diagnosis"
              ? "I will place the topic only."
              : "I will verify continuity only.",
          ]
        : [
            "I prepared the full drill problem count.",
            "I am ready to run the full training structure.",
            "I will hold the phase rules exactly as shown.",
          ],
      derivedFrom: isVerificationMode
        ? mode === "diagnosis"
          ? "Derived from the Structured Execution training lane and expanded to bidirectional adaptive diagnosis coverage."
          : "Derived from the Structured Execution training lane and reduced to a single phase verification block."
        : "Full Structured Execution training structure.",
    };
  }

  if (phase === "Controlled Discomfort") {
    return {
      title,
      drillType,
      setPlans: isVerificationMode
        ? verificationSetPlan
        : [
            { label: "Set 1", problems: 3, difficulty: "Hard" },
            { label: "Set 2", problems: 3, difficulty: "Challenging (but solvable)" },
            { label: "Set 3", problems: 3, difficulty: "Challenging (but solvable)" },
          ],
      objective,
      prepNotes: [
        ...(isVerificationMode
          ? [
              ...(mode === "diagnosis"
                ? [
                    "Prepare the starting phase first.",
                    ...adaptiveCoverageNotes,
                    `Total problems across this diagnosis coverage: ${adaptiveCoverageProblemTotal}.`,
                    "Also prepare the phase just below and the phase just above it, because the system may move there during diagnosis.",
                  ]
                : [
                    "Prepare exactly 3 clean Controlled Discomfort verification problems.",
                  ]),
              "Problems should be challenging enough to expose discomfort behavior, but still solvable.",
              "No rescue beyond the phase allowance.",
            ]
          : [
              "Prepare 9 total problems with controlled challenge increase.",
              "No rescue beyond first-step guidance.",
            ]),
      ],
      checklist: isVerificationMode
        ? [
            mode === "diagnosis"
              ? `I prepared the starting phase and adjacent coverage for: ${adaptiveCoverage.join(", ")}.`
              : "I prepared exactly 3 Controlled Discomfort verification problems.",
            "The problems are challenging enough to test the phase honestly.",
            mode === "diagnosis"
              ? "I will classify the topic only."
              : "I will verify inherited state only.",
          ]
        : [
            "I prepared the full drill problem count.",
            "I am ready to run the full training structure.",
            "I will hold the phase rules exactly as shown.",
          ],
      derivedFrom: isVerificationMode
        ? mode === "diagnosis"
          ? "Derived from the Controlled Discomfort training lane and expanded to bidirectional adaptive diagnosis coverage."
          : "Derived from the Controlled Discomfort training lane and reduced to a single phase verification block."
        : "Full Controlled Discomfort training structure.",
    };
  }

  return {
    title,
    drillType,
    setPlans: isVerificationMode
      ? verificationSetPlan
      : [
          { label: "Set 1", problems: 3, difficulty: "Hard" },
          { label: "Set 2", problems: 3, difficulty: "Challenging (but solvable)" },
          { label: "Set 3", problems: 3, difficulty: "Challenging (but solvable)" },
        ],
    objective,
    prepNotes: [
      ...(isVerificationMode
        ? [
              ...(mode === "diagnosis"
                ? [
                    "Prepare the starting phase first.",
                    ...adaptiveCoverageNotes,
                    `Total problems across this diagnosis coverage: ${adaptiveCoverageProblemTotal}.`,
                    "Also prepare the nearest adjacent phase the system may move into during diagnosis.",
                  ]
                : [
                    "Prepare exactly 3 clean Time Pressure Stability verification problems.",
                  ]),
            "Use timed pressure only to verify whether structure survives urgency.",
            "Keep pressure controlled. Structure matters more than speed.",
          ]
        : [
            "Prepare 9 total timed problems.",
            "Keep pressure controlled; preserve structure over speed.",
          ]),
    ],
    checklist: isVerificationMode
      ? [
          mode === "diagnosis"
            ? `I prepared the starting phase and adjacent coverage for: ${adaptiveCoverage.join(", ")}.`
            : "I prepared exactly 3 Time Pressure Stability verification problems.",
          "I will keep pressure controlled and score structure honestly.",
          mode === "diagnosis"
            ? "I will place the topic only."
            : "I will verify inherited state only.",
        ]
      : [
          "I prepared the full drill problem count.",
          "I am ready to run the full training structure.",
          "I will hold the phase rules exactly as shown.",
        ],
    derivedFrom: isVerificationMode
      ? mode === "diagnosis"
        ? "Derived from the Time Pressure Stability training lane and expanded to bidirectional adaptive diagnosis coverage."
        : "Derived from the Time Pressure Stability training lane and reduced to a single phase verification block."
      : "Full Time Pressure Stability training structure.",
  };
}

function DemoRunnerOverlay({
  phase,
  mode,
  open,
  onClose,
}: {
  phase: PhaseLabel;
  mode: DemoMode;
  open: boolean;
  onClose: () => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeDiagnosisPhase, setActiveDiagnosisPhase] = useState<PhaseLabel>(phase);
  const [currentSet, setCurrentSet] = useState(0);
  const [currentRep, setCurrentRep] = useState(0);
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [prepComplete, setPrepComplete] = useState(false);
  const [prepChecks, setPrepChecks] = useState<Record<string, boolean>>({});
  const [adaptiveTrail, setAdaptiveTrail] = useState<DemoAdaptiveStep[]>([]);
  const [adaptiveMessage, setAdaptiveMessage] = useState<string | null>(null);
  const [adaptiveTransition, setAdaptiveTransition] = useState<DemoAdaptiveTransition | null>(null);
  const [finalSummary, setFinalSummary] = useState<DemoSummary | null>(null);
  const displayPhase = mode === "diagnosis" ? activeDiagnosisPhase : phase;
  const drillStructure =
    mode === "training"
      ? TRAINING_SETS_BY_PHASE[displayPhase]
      : [ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE[displayPhase]];
  const prepPlan = demoPrepPlanFor(displayPhase, mode);

  useEffect(() => {
    if (!open) return;
    setActiveDiagnosisPhase(phase);
    setCurrentSet(0);
    setCurrentRep(0);
    setObservations({});
    setSubmitSuccess(false);
    setPrepComplete(false);
    setPrepChecks({});
    setAdaptiveTrail([]);
    setAdaptiveMessage(null);
    setAdaptiveTransition(null);
    setFinalSummary(null);
  }, [open, phase, mode]);

  useEffect(() => {
    if (!submitSuccess) return;
    window.requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [submitSuccess]);

  const prepChecklistComplete = prepPlan
    ? prepPlan.checklist.every((_, index) => prepChecks[`prep-${index}`])
    : true;

  const currentSetConfig = drillStructure[currentSet];
  const fields = currentSetConfig ? getObservationBlockForRep(currentSetConfig, currentRep) : [];
  const isFirstSet = currentSet === 0;
  const isFirstRep = currentRep === 0;
  const isLastSet = currentSet === drillStructure.length - 1;
  const isLastRep = currentRep === currentSetConfig.reps - 1;
  const isModelingSet = !!currentSetConfig?.isModelingSet;

  const canAdvance = fields.every((field) => {
    return Boolean(observations[observationKey(currentSet, currentRep, field.key)]);
  });

  const summary = useMemo(
    () => buildDemoSummary(displayPhase, drillStructure, observations, mode),
    [displayPhase, drillStructure, observations, mode],
  );
  const displaySummary = finalSummary || summary;
  const responseSnapshot = useMemo(() => {
    const summaryForSnapshot = finalSummary || summary;
    return buildResponseSnapshotV1({
      generatedBy: "deterministic-client-demo",
      topic: "Selected Practice Topic",
      mode: mode === "handover" ? "handover_verification" : mode,
      phase: displayPhase,
      sets: drillStructure
        .filter((setConfig) => hasScoredObservations(setConfig))
        .map((setConfig, index) => ({
          setName: setConfig.setName,
          setOrder: index + 1,
          observations: serializeDemoSetObservations(setConfig, index, observations),
        })),
      drillScore: summaryForSnapshot.phaseScore,
      setScores: summaryForSnapshot.setScores,
      engineOutcomeRef: {
        phaseBefore: summaryForSnapshot.phaseBefore as PhaseLabel | null,
        stabilityBefore: summaryForSnapshot.stabilityBefore as StabilityLabel | null,
        phaseAfter: summaryForSnapshot.phase,
        stabilityAfter: summaryForSnapshot.stability,
        transitionReason: summaryForSnapshot.transitionReason,
      },
    });
  }, [displayPhase, drillStructure, finalSummary, mode, observations, summary]);
  const stabilityColor =
    displaySummary.stability === "High Maintenance"
      ? "text-blue-700"
      : displaySummary.stability === "High"
      ? "text-green-700"
      : displaySummary.stability === "Medium"
      ? "text-yellow-700"
      : "text-red-700";
  const resultLabel =
    mode === "diagnosis"
      ? `Placed in ${displaySummary.phase} at ${displaySummary.stability} stability`
      : displaySummary.systemDecision === "Advance signal" && displaySummary.stability === "High"
      ? `Strong ${displaySummary.phase} evidence. Run High Maintenance check before phase progression.`
      : displaySummary.systemDecision === "Advance signal" && displaySummary.phase !== "Time Pressure Stability"
      ? `High Maintenance is ready to progress from ${displaySummary.phase}`
      : displaySummary.systemDecision === "Hold current phase"
      ? `Stability is holding in ${displaySummary.phase}`
      : `Reinforcement is still needed in ${displaySummary.phase}`;
  const formatState = (phaseValue?: string | null, stabilityValue?: string | null) => {
    if (!phaseValue && !stabilityValue) return "Not recorded";
    if (!phaseValue) return String(stabilityValue || "Not recorded");
    if (!stabilityValue) return String(phaseValue || "Not recorded");
    return `${phaseValue} (${stabilityValue})`;
  };
  const displayActionDetails = (() => {
    if (mode === "diagnosis") {
      return {
        nextFocusLabel: "Next Session Focus",
        nextFocus: displaySummary.nextAction,
        followOnLabel: null as string | null,
        followOnAction: null as string | null,
        constraint: displaySummary.constraint,
      };
    }

    if (displaySummary.stability === "High") {
      const maintenanceAction = getNextActionData(displaySummary.phase, "High");
      const followOnAction = getNextActionData(displaySummary.phase, "High Maintenance");
      return {
        nextFocusLabel: "Immediate Next Drill",
        nextFocus: maintenanceAction.nextActions?.[0] || maintenanceAction.primaryAction,
        followOnLabel: followOnAction.advanceTo ? "Then If Strong Again" : null,
        followOnAction: followOnAction.advanceTo ? followOnAction.primaryAction : null,
        constraint: maintenanceAction.rules?.[0] || displaySummary.constraint,
      };
    }

    return {
      nextFocusLabel: "Next Session Focus",
      nextFocus: displaySummary.nextAction,
      followOnLabel: null as string | null,
      followOnAction: null as string | null,
      constraint: displaySummary.constraint,
    };
  })();

  const handleObservation = (fieldKey: string, option: string) => {
    if (adaptiveTransition) {
      setAdaptiveTransition(null);
    }
    setObservations((prev) => ({
      ...prev,
      [observationKey(currentSet, currentRep, fieldKey)]: option,
    }));
  };

  const handleBack = () => {
    if (adaptiveTransition) {
      setAdaptiveTransition(null);
      setAdaptiveMessage(null);
      return;
    }
    if (submitSuccess) {
      setSubmitSuccess(false);
      setFinalSummary(null);
      setCurrentSet(drillStructure.length - 1);
      setCurrentRep(drillStructure[drillStructure.length - 1].reps - 1);
      return;
    }
    if (isFirstSet && isFirstRep) return;
    if (currentRep > 0) {
      setCurrentRep((prev) => prev - 1);
      return;
    }
    const previousSet = drillStructure[currentSet - 1];
    setCurrentSet((prev) => prev - 1);
    setCurrentRep(previousSet.reps - 1);
  };

  const handleContinueAdaptiveTransition = () => {
    if (!adaptiveTransition) return;
    setAdaptiveTrail((prev) => [...prev, adaptiveTransition.currentStep]);
    setAdaptiveMessage(
      `${adaptiveTransition.currentPhase} scored ${adaptiveTransition.phaseScore}/100. ${
        adaptiveTransition.direction === "escalate"
          ? `Moving up to ${adaptiveTransition.nextPhase}.`
          : `Dropping to ${adaptiveTransition.nextPhase}.`
      }`,
    );
    setActiveDiagnosisPhase(adaptiveTransition.nextPhase);
    setCurrentSet(0);
    setCurrentRep(0);
    setObservations({});
    setAdaptiveTransition(null);
  };

  const handleNext = () => {
    if (isLastSet && isLastRep) {
      if (mode === "diagnosis") {
        const diagnosisBlock = ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE[displayPhase];
        const phaseSummary = computeAdaptiveDiagnosisPhaseSummary(
          displayPhase,
          serializeDemoSetObservations(diagnosisBlock, 0, observations),
        );
        const nextPhase =
          phaseSummary.band === "de-escalate"
            ? getAdjacentDiagnosisPhase(displayPhase, "previous")
            : phaseSummary.band === "escalate"
              ? getAdjacentDiagnosisPhase(displayPhase, "next")
              : null;
        const currentStep: DemoAdaptiveStep = {
          phase: displayPhase,
          phaseScore: phaseSummary.phaseScore,
          band: phaseSummary.band,
          nextPhase,
        };
        const nextTrail = [...adaptiveTrail, currentStep];

        if (nextPhase && phaseSummary.band !== "place") {
          setAdaptiveTransition({
            currentPhase: displayPhase,
            nextPhase,
            phaseScore: phaseSummary.phaseScore,
            direction: phaseSummary.band === "escalate" ? "escalate" : "de-escalate",
            currentStep,
          });
          return;
        }

        const finalTransitionReason =
          nextTrail.length > 1
            ? `Adaptive path: ${nextTrail
                .map((step) =>
                  `${step.phase} ${step.phaseScore}/100${step.nextPhase ? ` -> ${step.nextPhase}` : " -> place"}`
                )
                .join(" | ")}. Diagnosis locked here.`
            : "This verification block was enough to lock placement here.";

        setAdaptiveTrail(nextTrail);
        setAdaptiveMessage(`${displayPhase} scored ${phaseSummary.phaseScore}/100. Diagnosis locked at ${displayPhase}.`);
        setFinalSummary({
          ...summary,
          phase: displayPhase,
          phaseBefore: null,
          stabilityBefore: null,
          systemDecision: "Placed by adaptive diagnosis",
          transitionReason: finalTransitionReason,
        });
        setSubmitSuccess(true);
        return;
      }
      setSubmitSuccess(true);
      return;
    }
    if (currentRep < currentSetConfig.reps - 1) {
      setCurrentRep((prev) => prev + 1);
      return;
    }
    setCurrentSet((prev) => prev + 1);
    setCurrentRep(0);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="border-b bg-card/95">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:gap-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                {mode === "training"
                  ? `Training Drill - ${displayPhase}`
                  : mode === "handover"
                  ? `Handover Verification - ${displayPhase}`
                  : `Adaptive Intro Diagnosis - ${displayPhase}`}
              </h2>
              <p className="mb-2 mt-2 text-sm">
                <span className="font-semibold">
                  {mode === "training" ? "Current Topic:" : "Diagnostic Topic:"}
                </span>{" "}
                Selected Practice Topic
              </p>
              <p className="mb-4 text-sm text-muted-foreground">Practice Student</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close demo runner">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            {!submitSuccess && !prepComplete ? (
              <div className="mx-auto max-w-4xl">
                {mode === "diagnosis" ? (
                  prepPlan ? (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
                      <p className="text-sm font-medium">{prepPlan.title}</p>
                      <p className="text-xs text-muted-foreground">Drill type: {prepPlan.drillType}</p>
                      <p className="text-xs text-foreground">{prepPlan.objective}</p>
                      <div className="space-y-1.5">
                        {prepPlan.setPlans.map((setPlan) => (
                          <div key={setPlan.label} className="rounded border border-primary/20 bg-background/70 px-2 py-1.5 text-xs">
                            <p className="font-medium text-foreground">{setPlan.label}</p>
                            <p className="text-muted-foreground">Problems: {setPlan.problems}</p>
                            <p className="text-muted-foreground">Difficulty: {setPlan.difficulty}</p>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prep Rules</p>
                        <ul className="space-y-0.5 text-xs text-muted-foreground">
                          {prepPlan.prepNotes.map((note) => (
                            <li key={note} className="flex items-start gap-1.5">
                              <span className="shrink-0 text-foreground/40">-</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required Confirmations</p>
                        <div className="space-y-1.5">
                          {prepPlan.checklist.map((item, index) => {
                            const checkKey = `prep-${index}`;
                            const checked = !!prepChecks[checkKey];
                            return (
                              <button
                                type="button"
                                key={item}
                                className={`w-full rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                                  checked
                                    ? "border-primary bg-primary/10 text-foreground"
                                    : "border-primary/20 bg-background/70 text-muted-foreground hover:bg-primary/5"
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
                      <p className="text-[11px] text-muted-foreground">{prepPlan.derivedFrom}</p>
                  </div>
                ) : null
                ) : prepPlan ? (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
                      <p className="text-sm font-medium">{prepPlan.title}</p>
                      <p className="text-xs text-muted-foreground">Drill type: {prepPlan.drillType}</p>
                      <p className="text-xs text-foreground">{prepPlan.objective}</p>
                      <div className="space-y-1.5">
                        {prepPlan.setPlans.map((setPlan) => (
                          <div key={setPlan.label} className="rounded border border-primary/20 bg-background/70 px-2 py-1.5 text-xs">
                            <p className="font-medium text-foreground">{setPlan.label}</p>
                            <p className="text-muted-foreground">Problems: {setPlan.problems}</p>
                            <p className="text-muted-foreground">Difficulty: {setPlan.difficulty}</p>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prep Rules</p>
                        <ul className="space-y-0.5 text-xs text-muted-foreground">
                          {prepPlan.prepNotes.map((note) => (
                            <li key={note} className="flex items-start gap-1.5">
                              <span className="shrink-0 text-foreground/40">-</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required Confirmations</p>
                        <div className="space-y-1.5">
                          {prepPlan.checklist.map((item, index) => {
                            const checkKey = `prep-${index}`;
                            const checked = !!prepChecks[checkKey];
                            return (
                              <button
                                type="button"
                                key={item}
                                className={`w-full rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                                  checked
                                    ? "border-primary bg-primary/10 text-foreground"
                                    : "border-primary/20 bg-background/70 text-muted-foreground hover:bg-primary/5"
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
                      <p className="text-[11px] text-muted-foreground">{prepPlan.derivedFrom}</p>
                  </div>
                ) : null}
              </div>
            ) : !submitSuccess ? (
              <>
                {adaptiveMessage && mode === "diagnosis" && (
                  <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
                    {adaptiveMessage}
                  </div>
                )}
                {adaptiveTransition && mode === "diagnosis" && (
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
                        The demo will reset and open the {adaptiveTransition.nextPhase} diagnosis block.
                      </p>
                    </div>
                  </div>
                )}
                {!adaptiveTransition && isFirstSet && isFirstRep && (
                  <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                    <div className="mb-1 font-semibold text-foreground">Phase: {displayPhase}</div>
                    <div className="mb-2 text-xs text-muted-foreground">{PHASE_CONTEXT[displayPhase].purpose}</div>
                    <div className="flex flex-wrap gap-1">
                      {PHASE_CONTEXT[displayPhase].constraints.map((rule) => (
                        <span
                          key={rule}
                          className="rounded border border-primary/20 bg-background px-2 py-0.5 text-xs font-medium"
                        >
                          {rule}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!adaptiveTransition && isModelingSet && (
                  <div className="mb-4 rounded-xl border border-primary/25 bg-primary/10 p-4">
                    <div className="mb-1 text-sm font-bold text-foreground">MODELING STEP</div>
                    <div className="text-xs leading-relaxed text-muted-foreground">
                      Tutor teaches first. Student does <strong>NOT</strong> solve yet.
                      <br />
                      Run <strong>Vocabulary -&gt; Method -&gt; Reason</strong>, then ask the student to explain back.
                      <br />
                      Sets 2 and 3 are the scored drill sets.
                    </div>
                  </div>
                )}

                {!adaptiveTransition && (
                <div className="mb-4 rounded-xl border border-primary/15 bg-background p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      Set {currentSet + 1} / {drillStructure.length}: {currentSetConfig.setName}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {isModelingSet ? "Pre-Drill Step" : `Rep ${currentRep + 1} / ${currentSetConfig.reps}`}
                    </div>
                  </div>
                  <div className="mb-3 text-xs text-muted-foreground">{currentSetConfig.purpose}</div>
                  <div className="mb-3 rounded-md border border-primary/20 bg-primary/5 p-2">
                    <div className="mb-0.5 text-xs font-semibold text-primary">Rep instruction</div>
                    <div className="text-sm font-medium text-foreground">{currentSetConfig.repInstruction}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {currentSetConfig.activeRules.map((rule) => (
                      <span
                        key={rule}
                        className="rounded border border-primary/15 bg-background px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {rule}
                      </span>
                    ))}
                  </div>
                </div>
                )}

                {!adaptiveTransition && (
                <form className="space-y-4">
                  {fields.length === 0 && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                      No observations are captured for this step. Continue when pre-drill teaching is complete.
                    </div>
                  )}
                  {fields.map((field) => {
                    const selected = observations[observationKey(currentSet, currentRep, field.key)] || "";
                    const selectedIndex = field.options.indexOf(selected);
                    const selectedLevel =
                      selectedIndex >= 0
                        ? observationLevelForField(field, selectedIndex, selected)
                        : null;

                    return (
                      <div key={field.key}>
                        <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                          <label className="block font-medium text-sm sm:text-base">{field.label}</label>
                          {selectedLevel && <Badge variant="secondary" className="w-fit">{selectedLevel}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-1 sm:gap-2">
                          {field.options.map((option) => (
                            <button
                              type="button"
                              key={option}
                              className={`rounded-md border px-2 sm:px-3 py-1 text-xs sm:text-sm transition-colors whitespace-nowrap ${
                                selected === option
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-primary/20 bg-background hover:bg-primary/5"
                              }`}
                              onClick={() => handleObservation(field.key, option)}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </form>
                )}
              </>
            ) : (
              <div className="mb-6 space-y-4">
                <div className="rounded-md border border-primary/25 bg-primary/10 p-3 font-medium text-foreground">
                  Drill submitted. Scoring complete.
                </div>

                <ResponseSnapshotCard snapshot={responseSnapshot} />

                {drillStructure
                  .filter((setConfig) => hasScoredObservations(setConfig))
                  .map((setConfig, index) => {
                    const rows = displaySummary.repRows.filter((row) => row.set === setConfig.setName);
                    const setPercent = displaySummary.setScores[index] || 0;
                    return (
                      <div key={setConfig.setName} className="overflow-hidden rounded-xl border border-primary/15 bg-background">
                        <div className="flex items-center justify-between bg-primary/5 px-4 py-2">
                          <span className="text-sm font-semibold">{setConfig.setName}</span>
                          <span className="text-sm text-muted-foreground">
                            Set Total: <strong>{setPercent}/100</strong>
                            <span className="ml-2 text-xs">({setPercent}%)</span>
                          </span>
                        </div>
                        <div className="divide-y">
                          {rows.map((row) => (
                            <div key={`${row.set}-${row.rep}`} className="flex items-center justify-between bg-background px-4 py-2 text-sm">
                              <span className="text-muted-foreground">Rep {row.rep}</span>
                              <span
                                className={`font-medium ${
                                  row.repScore >= 70 ? "text-green-700" : row.repScore >= 45 ? "text-yellow-700" : "text-red-700"
                                }`}
                              >
                                {row.repScore}/100
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                <div className="flex items-center justify-between rounded-xl border border-primary/15 bg-background px-4 py-3">
                  <span className="font-semibold">
                    {mode === "training" ? "Drill Total" : mode === "handover" ? "Verification Total" : "Diagnosis Total"}
                  </span>
                  <span
                    className={`text-lg font-bold ${
                      displaySummary.phaseScore >= 70 ? "text-green-700" : displaySummary.phaseScore >= 45 ? "text-yellow-700" : "text-red-700"
                    }`}
                  >
                    {displaySummary.phaseScore}/100
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-primary/15 bg-background">
                  <div className="bg-primary/5 px-4 py-2">
                    <span className="text-sm font-semibold">System Direction</span>
                  </div>
                  <div className="space-y-3 px-4 py-3 text-sm">
                    <div>
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">This Session Result</p>
                      <p className={`font-semibold ${stabilityColor}`}>{resultLabel}</p>
                    </div>
                    <div className="flex items-center justify-between border-t pt-1">
                      <span className="text-muted-foreground">Topic Score</span>
                      <span
                        className={`font-bold ${
                          displaySummary.phaseScore >= 70 ? "text-green-700" : displaySummary.phaseScore >= 45 ? "text-yellow-700" : "text-red-700"
                        }`}
                      >
                        {displaySummary.phaseScore}/100
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Before</span>
                      <span className="font-medium">{formatState(displaySummary.phaseBefore, displaySummary.stabilityBefore)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Now</span>
                      <span className="font-medium">{formatState(displaySummary.phase, displaySummary.stability)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{displayActionDetails.nextFocusLabel}</p>
                      <p className="font-semibold text-blue-700">{displayActionDetails.nextFocus}</p>
                    </div>
                    {displayActionDetails.followOnAction && (
                      <div className="border-t pt-2">
                        <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{displayActionDetails.followOnLabel}</p>
                        <p className="font-medium">{displayActionDetails.followOnAction}</p>
                      </div>
                    )}
                    <div className="border-t pt-2">
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Reason</p>
                      <p className="font-medium">{displaySummary.transitionReason}</p>
                    </div>
                    <div className="border-t pt-2">
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Tutor Meaning</p>
                      <p className="font-medium">{displaySummary.tutorMeaning}</p>
                    </div>
                    {displayActionDetails.constraint && (
                      <div className="mt-1 border-t pt-2 text-xs text-muted-foreground">
                        Constraint: {displayActionDetails.constraint}
                      </div>
                    )}
                  </div>
                </div>
                {mode === "diagnosis" && adaptiveTrail.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-primary/15 bg-background">
                    <div className="bg-primary/5 px-4 py-2">
                      <span className="text-sm font-semibold">Adaptive Path</span>
                    </div>
                    <div className="space-y-2 px-4 py-3 text-sm">
                      {adaptiveTrail.map((step, index) => (
                        <p key={`${step.phase}-${index}`} className="text-muted-foreground">
                          {step.phase}: {step.phaseScore}/100. {step.band === "place" ? "Placed here." : step.nextPhase ? `Moved to ${step.nextPhase}.` : "Stopped here."}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t bg-card/95">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <Button variant="outline" onClick={handleBack} disabled={!submitSuccess && !prepComplete && isFirstSet && isFirstRep}>
              Back
            </Button>
            <div className="flex items-center gap-3">
              {submitSuccess ? (
                <>
                  <Button variant="outline" onClick={() => {
                    setCurrentSet(0);
                    setCurrentRep(0);
                    setObservations({});
                    setSubmitSuccess(false);
                    setPrepComplete(false);
                  }}>
                    Restart Demo
                  </Button>
                  <Button onClick={onClose}>Close Demo</Button>
                </>
              ) : (
                  <Button
                    onClick={() => {
                      if (!prepComplete) {
                        if (!prepChecklistComplete) {
                          return;
                        }
                        setPrepComplete(true);
                        return;
                      }
                    if (adaptiveTransition) {
                      handleContinueAdaptiveTransition();
                      return;
                    }
                    handleNext();
                  }}
                  disabled={prepComplete ? (!adaptiveTransition && !canAdvance) : !prepChecklistComplete}
                >
                  {!prepComplete
                    ? "Start Demo Drill"
                    : adaptiveTransition
                      ? `Continue to ${adaptiveTransition.nextPhase}`
                      : isLastSet && isLastRep
                        ? "Submit Demo Drill"
                        : "Next"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResponseConditioningLoggingSystem() {
  const navigate = useNavigate();
  const [selectedPhase, setSelectedPhase] = useState<PhaseLabel>("Structured Execution");
  const [demoMode, setDemoMode] = useState<DemoMode>("training");
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <Button
            variant="ghost"
            className="mb-4 -ml-2"
            onClick={() => navigate("/responseconditioningsystem")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Response Conditioning System
          </Button>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Response Integrity-OS Deep Dive
              </p>
              <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">Logging System</h2>
              <p className="mt-1 text-muted-foreground">
                Evidence capture, score resolution, and system-led output
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        <Card className="space-y-4 border-2 border-primary/20 bg-primary/5 p-6">
          <h2 className="text-2xl font-bold">What Logging Is For</h2>
          <p className="text-muted-foreground">
            Tutors do not log opinions. Tutors log what actually happened. The system uses that
            evidence to decide whether to hold, place, or move.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="font-semibold">Intro diagnosis</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Logging supports phase verification and placement.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="font-semibold">Active training</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Logging supports continuity, reinforcement, and next-step selection.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="font-semibold">Handover verification</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Logging supports continuity checks after tutor reassignment.
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-6 border-2 border-primary/20 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Phase Verification Demo</Badge>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">What This Page Shows</h2>
            <p className="max-w-4xl text-muted-foreground">
              This page shows how tutors use the drill runner in intro diagnosis, active training, and handover verification.
              You can switch modes, open the runner, complete reps, and review the result screen.
            </p>
          </div>

          <div className="rounded-2xl border bg-card/60 p-4 md:p-6">
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <h3 className="text-xl font-bold">Choose a Mode and Phase</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Switch between training, diagnosis, and handover. For diagnosis, the selected phase is the starting point, not the final placement.
                  </p>
                </div>
                <Button onClick={() => setDemoOpen(true)} className="w-full sm:w-auto">
                  <Expand className="mr-2 h-4 w-4" />
                  Open Demo
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDemoMode("training")}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    demoMode === "training"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-background hover:border-primary/30 hover:bg-muted/20"
                  }`}
                >
                  <p className="text-sm font-semibold">Training</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Use the active training drill flow for the selected phase.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoMode("diagnosis")}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    demoMode === "diagnosis"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-background hover:border-primary/30 hover:bg-muted/20"
                  }`}
                >
                  <p className="text-sm font-semibold">Diagnosis</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Use the diagnosis flow to start from a phase block and let the system move up, place, or move down.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoMode("handover")}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    demoMode === "handover"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-background hover:border-primary/30 hover:bg-muted/20"
                  }`}
                >
                  <p className="text-sm font-semibold">Handover</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Use the continuity-check flow to verify where training should resume with a new tutor.
                  </p>
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {PHASES.map((phase) => {
                  const isActive = phase === selectedPhase;
                  return (
                    <button
                      type="button"
                      key={phase}
                      onClick={() => setSelectedPhase(phase)}
                      className={`rounded-2xl border p-4 text-left transition-colors ${
                        isActive
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background hover:border-primary/30 hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                    <p className="text-sm font-semibold">{phase}</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {PHASE_CONTEXT[phase].purpose}
                          </p>
                        </div>
                        {isActive && <Badge className="bg-primary text-primary-foreground">Selected</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="rounded-2xl border border-primary/15 bg-background p-3 sm:p-4 shadow-sm">
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Selected Demo</p>
                  <h4 className="mt-2 text-lg sm:text-xl font-semibold">
                    {demoMode === "training" ? "Training" : demoMode === "handover" ? "Handover" : "Intro Diagnosis Start"}: {selectedPhase}
                  </h4>
                  <p className="mt-1 text-xs sm:mt-2 sm:text-sm text-muted-foreground">{PHASE_CONTEXT[selectedPhase].purpose}</p>
                  <div className="mt-3 sm:mt-4 flex flex-wrap gap-1 sm:gap-2">
                    {PHASE_CONTEXT[selectedPhase].constraints.map((rule) => (
                      <span
                        key={rule}
                        className="rounded border border-primary/20 bg-primary/5 px-2 py-1 text-xs"
                      >
                        {rule}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/15 bg-background p-3 sm:p-4 shadow-sm">
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-muted-foreground">In This Demo</p>
                  <ul className="mt-2 sm:mt-3 space-y-1 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
                    <li>Tutor prep before the drill starts</li>
                    <li>
                      {demoMode === "training"
                        ? "A phase-based training drill"
                        : demoMode === "handover"
                        ? "A continuity-check verification block"
                        : "An adaptive phase verification block"}
                    </li>
                    <li>Clickable observation choices for each rep</li>
                    <li>A result screen that mirrors the live runner more closely</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-2xl font-bold">Primary Rules</h2>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-2xl font-bold">How Choices Turn Into a Result</h2>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            {scoringRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-2xl font-bold">What Tutors Do in the Runner</h2>
          <ol className="space-y-1 pl-4 text-muted-foreground">
            {flow.map((step, index) => (
              <li key={step}>
                {index + 1}. {step}
              </li>
            ))}
          </ol>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-2xl font-bold">What the Result Screen Shows</h2>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            {resultOutputs.map((output) => (
              <li key={output}>{output}</li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-4 border-2 border-primary/20 p-6">
          <h2 className="text-2xl font-bold">Audit Relevance</h2>
          <p className="text-muted-foreground">
            Because Response Integrity logging is tied directly to evidence and system output, dishonest logging
            means dishonest evidence capture. That is a compliance issue, not a note-taking issue.
          </p>
          <ul className="space-y-1 pl-4 text-muted-foreground">
            {auditRisks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
          <p className="font-medium">
            If the observation record is manipulated, the system output is compromised and the tutor
            can be flagged for audit failure.
          </p>
        </Card>
      </div>

      <DemoRunnerOverlay
        phase={selectedPhase}
        mode={demoMode}
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
      />
    </div>
  );
}
