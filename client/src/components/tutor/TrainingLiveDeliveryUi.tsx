import type { ReactNode } from "react";
import {
  instructionPromptDisplayText,
  instructionPromptLabelFor,
} from "@/lib/instructionPromptLabel";
import {
  TRAINING_OBSERVATION_MATRIX_V2,
} from "@shared/trainingObservationContractV2";
import type { TrainingDimensionId } from "@shared/trainingEvidenceContract";

export type LivePhaseLabel =
  | "Clarity"
  | "Structured Execution"
  | "Controlled Discomfort"
  | "Time Pressure Stability";

export const LIVE_PHASE_CONTEXT: Record<
  LivePhaseLabel,
  { purpose: string; constraints: string[] }
> = {
  Clarity: {
    purpose:
      "Can the student see the problem clearly before solving? Clarity is naming what's there, recognizing the method, understanding why. If this fails - everything else collapses.",
    constraints: ["No Boss Battles", "No time pressure", "No skipping layers"],
  },
  "Structured Execution": {
    purpose:
      "Test and build ability to execute the known method independently. Student knows - now prove they can do it alone, repeatably.",
    constraints: [
      "State steps before solving",
      "No guessing tolerated",
      "No skipping steps",
    ],
  },
  "Controlled Discomfort": {
    purpose:
      "Test and stabilize behavior under uncertainty and difficulty. Does the student persist - or shut down?",
    constraints: [
      "No full rescue",
      "Hold discomfort window",
      "One-step confirmation max",
    ],
  },
  "Time Pressure Stability": {
    purpose:
      "Maintain method structure under urgency. Structure is the target - speed is secondary.",
    constraints: [
      "Method over speed",
      "Timer is active",
      "Structured response required - panic responding is logged as instability.",
    ],
  },
};

const LIVE_TRAINING_INSTRUCTIONS: Record<string, string> = {
  "Clarity::Identification":
    "Show the problem. Ask student to: name the terms, identify the type, state the steps, explain why it works. No solving allowed.",
  "Clarity::Light Apply":
    "Ask student to solve. Minimal guidance. Observe clarity under execution.",
  "Structured Execution::Required Structure":
    "Before you solve, tell me the steps you will follow. Then solve using those steps.",
  "Structured Execution::Independent Execution":
    "Solve independently.",
  "Structured Execution::Variation Control":
    "Solve slightly different form.",
  "Controlled Discomfort::Controlled Entry":
    "Pause. Then state the first step.",
  "Controlled Discomfort::No Rescue":
    "Continue. No full help.",
  "Controlled Discomfort::Repeat Exposure":
    "Another similar difficulty.",
  "Time Pressure Stability::Structure Under Timer":
    "Focus on method, not speed.",
  "Time Pressure Stability::Repeated Timed Execution":
    "Repeat under timer.",
  "Time Pressure Stability::Full Constraint":
    "Solve under tighter time.",
};

export function liveTrainingInstruction(
  phase: string,
  setName: string,
): string {
  return (
    LIVE_TRAINING_INSTRUCTIONS[`${phase}::${setName}`] ||
    "Run the prescribed rep exactly as shown and preserve the active condition."
  );
}


const LIVE_TRAINING_RULES: Record<string, string[]> = {
  "Clarity::Identification": [
    "No solving allowed",
    "Push for vocabulary precision",
    "All 4 layers: terms, type, steps, reason",
  ],
  "Clarity::Light Apply": [
    "Minimal guidance only",
    "No step-by-step help",
    "Observe independent start and execution",
  ],
  "Structured Execution::Required Structure": [
    "Student states step order before solving",
    "Specialist does not supply the steps",
    "Student solves using the stated order",
  ],
  "Structured Execution::Independent Execution": [
    "No help from Specialist",
    "Full independence expected",
    "Observe repeatability and step discipline",
  ],
  "Structured Execution::Variation Control": [
    "Same method - different form",
    "Test transfer not memorization",
    "No hints on what changed",
  ],
  "Controlled Discomfort::Controlled Entry": [
    "Force a pause before starting",
    "First step must be stated out loud",
    "Do not let them jump in",
  ],
  "Controlled Discomfort::No Rescue": [
    "No rescue allowed",
    "Hold the hold - do not relieve",
    "Observe rescue-seeking pattern",
  ],
  "Controlled Discomfort::Repeat Exposure": [
    "Same difficulty level",
    "Repeat exposure - build tolerance",
    "Observe consistency of response",
  ],
  "Time Pressure Stability::Structure Under Timer": [
    "Timer active",
    "Method priority - not speed",
    "Structure must be maintained throughout",
  ],
  "Time Pressure Stability::Repeated Timed Execution": [
    "Same timer constraint",
    "Build consistency - not just completion",
    "Observe pace regulation",
  ],
  "Time Pressure Stability::Full Constraint": [
    "Tighter timer",
    "Full constraint - no relief",
    "Structure + completion both required",
  ],
};

export function liveTrainingActiveRules(
  phase: string,
  setName: string,
  fallback: string[] = [],
): string[] {
  return LIVE_TRAINING_RULES[`${phase}::${setName}`] || fallback;
}

export function liveObservationQuestion(
  dimensionId: string,
  fallback: string,
): string {
  return (
    TRAINING_OBSERVATION_MATRIX_V2[dimensionId as TrainingDimensionId]
      ?.observationQuestion || fallback
  );
}

export function liveObservationLabel(
  dimensionId: string,
  fallback?: string,
): string {
  return (
    TRAINING_OBSERVATION_MATRIX_V2[dimensionId as TrainingDimensionId]?.label ||
    fallback ||
    dimensionId
  );
}

export function liveObservationOptionDetails(
  dimensionId: string,
): Record<string, string> {
  const definition =
    TRAINING_OBSERVATION_MATRIX_V2[dimensionId as TrainingDimensionId];
  return definition
    ? Object.fromEntries(
        definition.options.map((option) => [option.label, option.detail]),
      )
    : {};
}

export function LivePhaseContext({
  phase,
}: {
  phase: LivePhaseLabel;
}) {
  const context = LIVE_PHASE_CONTEXT[phase];
  return (
    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
      <div className="mb-1 font-semibold text-foreground">Phase: {phase}</div>
      <div className="mb-2 text-xs text-muted-foreground">{context.purpose}</div>
      <div className="flex flex-wrap gap-1">
        {context.constraints.map((constraint) => (
          <span
            key={constraint}
            className="rounded border border-primary/20 bg-background px-2 py-0.5 text-xs font-medium text-foreground"
          >
            ✕ {constraint}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LiveRepStage({
  stage,
  sandbox = false,
}: {
  stage: "ready" | "observe" | "confirm";
  sandbox?: boolean;
}) {
  const pill = (value: "ready" | "observe" | "confirm", label: string) => {
    const active = stage === value;
    const complete =
      (value === "ready" && stage !== "ready") ||
      (value === "observe" && stage === "confirm");
    return (
      <span
        className={
          active
            ? "rounded-full bg-primary/10 px-2 py-1 text-primary"
            : complete
              ? "rounded-full border border-primary/15 px-2 py-1"
              : ""
        }
      >
        {label}
        {complete ? " ✓" : ""}
      </span>
    );
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {sandbox && (
        <span className="rounded-full border border-primary/25 bg-background px-2 py-1 text-primary">
          Sandbox
        </span>
      )}
      {pill("ready", "Ready")}
      <span className="text-primary/30">→</span>
      {pill("observe", "Observe")}
      <span className="text-primary/30">→</span>
      {pill("confirm", "Confirm")}
    </div>
  );
}

export function LiveRepContextCard({
  setIndex,
  setCount,
  setName,
  repNumber,
  repCount,
  purpose,
  instruction,
  activeRules,
}: {
  setIndex: number;
  setCount: number;
  setName: string;
  repNumber: number;
  repCount: number;
  purpose: string;
  instruction: string;
  activeRules: string[];
}) {
  return (
    <div className="mb-4 rounded-xl border border-primary/15 bg-background p-2 shadow-sm sm:p-3">
      <div className="mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Set {setIndex} of {setCount} · {setName}
        </div>
        <div className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          REP {repNumber} OF {repCount}
        </div>
      </div>
      <div className="mb-2 text-xs text-muted-foreground sm:mb-3">{purpose}</div>
      <div className="mb-2 rounded-md border border-primary/20 bg-primary/5 p-2 sm:mb-3">
        <div className="mb-0.5 text-xs font-semibold text-primary">
          {instructionPromptLabelFor(instruction)}
        </div>
        <div className="text-xs font-medium text-foreground sm:text-sm">
          {instructionPromptDisplayText(instruction)}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {activeRules.map((rule) => (
          <span
            key={rule}
            className="rounded border border-primary/15 bg-background px-1 py-0.5 text-[10px] text-muted-foreground sm:px-2 sm:text-xs"
          >
            {rule}
          </span>
        ))}
      </div>
    </div>
  );
}

export type LiveSupportOption = {
  id: string;
  label: string;
  detail: string;
};

export function LiveSupportPanel({
  options,
  selectedId,
  open,
  onToggle,
  onSelect,
  showEvidenceExceptions,
  onToggleEvidenceExceptions,
  evidenceExceptionsEnabled = true,
}: {
  options: LiveSupportOption[];
  selectedId: string;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  showEvidenceExceptions: boolean;
  onToggleEvidenceExceptions: () => void;
  evidenceExceptionsEnabled?: boolean;
}) {
  const selected =
    options.find((option) => option.id === selectedId) || options[0] || null;

  return (
    <div className="mb-4 rounded-xl border border-primary/15 bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Support this rep
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {selected?.label || "No intervention"}
          </div>
        </div>
        <button
          type="button"
          className="rounded-md border border-primary/20 px-3 py-1.5 text-xs font-semibold hover:bg-primary/5"
          onClick={onToggle}
        >
          {open ? "Close" : "Change support"}
        </button>
      </div>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <button
              type="button"
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={[
                "rounded-lg border p-3 text-left",
                selectedId === option.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-primary/15 hover:bg-primary/5",
              ].join(" ")}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {option.detail}
              </span>
            </button>
          ))}
        </div>
      )}
      {evidenceExceptionsEnabled && (
        <div className="mt-3 border-t border-primary/10 pt-2">
          <button
            type="button"
            className="text-[11px] font-semibold text-primary hover:underline"
            onClick={onToggleEvidenceExceptions}
          >
            {showEvidenceExceptions
              ? "Hide evidence exceptions"
              : "Mark an evidence exception"}
          </button>
        </div>
      )}
    </div>
  );
}

export function LiveObservationField({
  question,
  label,
  options,
  selected,
  optionDetails,
  onSelect,
  showEvidenceExceptions,
  evidenceStatus,
  onEvidenceStatus,
  allowEvidenceExceptionWithoutOption = false,
}: {
  question: string;
  label?: string;
  options: Array<{ id: string; label: string }>;
  selected?: string | null;
  optionDetails?: Record<string, string>;
  onSelect: (id: string) => void;
  showEvidenceExceptions: boolean;
  evidenceStatus: "observed" | "not_observed" | "confounded";
  onEvidenceStatus: (
    status: "observed" | "not_observed" | "confounded",
  ) => void;
  allowEvidenceExceptionWithoutOption?: boolean;
}) {
  const statuses: Array<[
    "observed" | "not_observed" | "confounded",
    string,
  ]> = [
    ["observed", "Observed cleanly"],
    ["not_observed", "Not meaningfully observed"],
    ["confounded", "Confounded"],
  ];

  return (
    <div>
      <div className="mb-2">
        <label className="block text-sm font-medium sm:text-base">{question}</label>
        {label && label !== question && (
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            type="button"
            key={option.id}
            className={[
              "rounded-lg border p-3 text-left transition-colors",
              selected === option.id
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-primary/15 bg-background hover:bg-primary/5",
            ].join(" ")}
            onClick={() => onSelect(option.id)}
          >
            <span className="block text-sm font-medium text-foreground">
              {option.label}
            </span>
            {optionDetails?.[option.id] && (
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {optionDetails[option.id]}
              </span>
            )}
          </button>
        ))}
      </div>
      {showEvidenceExceptions && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Evidence validity
          </span>
          {statuses.map(([status, statusLabel]) => {
            const needsBehaviorSelection =
              status === "observed" || !allowEvidenceExceptionWithoutOption;
            return (
              <button
                type="button"
                key={status}
                disabled={needsBehaviorSelection && !selected}
                onClick={() => onEvidenceStatus(status)}
                className={[
                  "rounded-md border px-2 py-1 text-[11px] disabled:opacity-50",
                  evidenceStatus === status
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-primary/15 text-muted-foreground hover:bg-primary/5",
                ].join(" ")}
              >
                {statusLabel}
              </button>
            );
          })}
          {allowEvidenceExceptionWithoutOption &&
            evidenceStatus !== "observed" && (
              <span className="text-[11px] text-muted-foreground">
                No behavior option is required when the evidence itself was not interpretable.
              </span>
            )}
        </div>
      )}
    </div>
  );
}

export function LiveSandboxStudentResponse({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mb-4 rounded-xl border border-primary/15 bg-primary/[0.025] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
        Simulated student response
      </div>
      <div className="mt-2 text-sm leading-6 text-foreground">{children}</div>
    </div>
  );
}
