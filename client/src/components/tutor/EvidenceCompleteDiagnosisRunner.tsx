import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { API_URL } from "@/lib/config";
import { supabase } from "@/lib/supabaseClient";
import {
  DIAGNOSIS_DIMENSIONS,
  type DiagnosisDimensionId,
  type DiagnosisObservationLevel,
  type DiagnosisProbeDefinition,
  type DiagnosisProbeResult,
  type DiagnosisSupportEvent,
  type EvidenceCompleteDiagnosisDecision,
} from "@shared/evidenceCompleteDiagnosis";
import { tryParsePhase, type TopicPhase } from "@shared/topicConditioningEngine";

type DiagnosisApiResponse = {
  success: boolean;
  runId: string;
  finalized: boolean;
  sourceDrillId?: string | null;
  probeHistory: DiagnosisProbeResult[];
  decision: EvidenceCompleteDiagnosisDecision;
  nextProbe: DiagnosisProbeDefinition | null;
  opportunityNumber: number | null;
  opportunityPurpose: string | null;
  summary?: Record<string, unknown>;
};

type DimensionCopy = {
  label: string;
  weak: string;
  partial: string;
  clear: string;
};

const DIMENSION_COPY: Record<DiagnosisDimensionId, DimensionCopy> = {
  "clarity.vocabulary": {
    label: "Vocabulary",
    weak: "Cannot name what is present",
    partial: "Names some parts but not cleanly",
    clear: "Names the important terms accurately",
  },
  "clarity.method": {
    label: "Method recognition",
    weak: "Does not identify the method",
    partial: "Hesitant or only partly identifies it",
    clear: "Identifies the method cleanly",
  },
  "clarity.reason": {
    label: "Reason awareness",
    weak: "Cannot explain why",
    partial: "Reason is incomplete or uncertain",
    clear: "Explains why the method fits",
  },
  "clarity.immediate_apply": {
    label: "Immediate engagement",
    weak: "Avoids or cannot engage",
    partial: "Engages after delay or uncertainty",
    clear: "Engages immediately and appropriately",
  },
  "execution.start": {
    label: "Independent start",
    weak: "Waits, guesses, or does not start",
    partial: "Starts after a noticeable delay",
    clear: "Starts independently with a valid first move",
  },
  "execution.step_discipline": {
    label: "Step structure",
    weak: "Steps are random or structurally broken",
    partial: "Some structure is present but it drifts",
    clear: "Maintains the method structure",
  },
  "execution.repeatability": {
    label: "Repeatability",
    weak: "Structure breaks on another opportunity",
    partial: "Repeats inconsistently",
    clear: "Repeats the structure reliably",
  },
  "execution.independence": {
    label: "Independence",
    weak: "Needs rescue or waits for help",
    partial: "Tries first but still depends on support",
    clear: "Works independently throughout",
  },
  "difficulty.initial_response": {
    label: "First response to difficulty",
    weak: "Freezes or withdraws",
    partial: "Hesitates but remains present",
    clear: "Attempts without losing control",
  },
  "difficulty.first_step_control": {
    label: "First-step control",
    weak: "Cannot produce a controlled first step",
    partial: "First step is unstable or uncertain",
    clear: "Produces an independent controlled first step",
  },
  "difficulty.tolerance": {
    label: "Discomfort tolerance",
    weak: "Breaks, gives up, or exits the problem",
    partial: "Stays briefly but control is inconsistent",
    clear: "Stays engaged without rescue",
  },
  "difficulty.rescue_dependence": {
    label: "Rescue dependence",
    weak: "Seeks help immediately",
    partial: "Seeks help after a short attempt",
    clear: "Does not seek rescue",
  },
  "time.start": {
    label: "Start under time",
    weak: "Freezes or panics at the start",
    partial: "Starts late or with visible disruption",
    clear: "Starts promptly without losing structure",
  },
  "time.structure": {
    label: "Structure under time",
    weak: "Method structure collapses",
    partial: "Structure is only partly maintained",
    clear: "Structure holds under the timer",
  },
  "time.pace": {
    label: "Pace control",
    weak: "Panic or rushing controls the response",
    partial: "Pace is uneven",
    clear: "Pace stays controlled",
  },
  "time.completion_integrity": {
    label: "Completion integrity",
    weak: "Does not complete with usable structure",
    partial: "Completes only partly or with structural loss",
    clear: "Completes while preserving the method",
  },
};

const LEVELS: DiagnosisObservationLevel[] = ["weak", "partial", "clear"];

const LEVEL_LABEL: Record<DiagnosisObservationLevel, string> = {
  weak: "Weak",
  partial: "Partial",
  clear: "Clear",
};

const SUPPORT_OPTIONS: Array<{
  value: DiagnosisSupportEvent;
  title: string;
  detail: string;
  contaminated: boolean;
}> = [
  {
    value: "none",
    title: "No intervention",
    detail: "You only presented the problem and observed.",
    contaminated: false,
  },
  {
    value: "neutral_clarification",
    title: "Neutral clarification only",
    detail: "You clarified wording without giving method, step, or answer information.",
    contaminated: false,
  },
  {
    value: "first_step_confirmation",
    title: "First-step confirmation happened",
    detail: "Baseline evidence is contaminated. The system will not use this opportunity to place the student.",
    contaminated: true,
  },
  {
    value: "teaching",
    title: "Teaching or correction happened",
    detail: "Baseline evidence is contaminated. Record it honestly - the system will request clean evidence if needed.",
    contaminated: true,
  },
];

const PHASE_ORDER: TopicPhase[] = [
  "Clarity",
  "Structured Execution",
  "Controlled Discomfort",
  "Time Pressure Stability",
];

const createRunId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  throw new Error("This browser cannot create a secure diagnosis run ID.");
};

const buildStorageKey = (studentId: string, topic: string, scheduledSessionId: string | null) =>
  [
    "ri-evidence-diagnosis",
    studentId,
    topic.trim().toLowerCase(),
    scheduledSessionId || "unscheduled",
  ].join(":");

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

export default function EvidenceCompleteDiagnosisRunner() {
  const { studentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const topic = String(searchParams.get("topic") || "").trim();
  const startingPhase = tryParsePhase(searchParams.get("phase")) || "Clarity";
  const scheduledSessionId = String(searchParams.get("scheduledSessionId") || "").trim() || null;
  const sessionContextKind =
    String(searchParams.get("sessionContextKind") || "").trim().toLowerCase() === "training"
      ? "training"
      : "intro";

  const storageKey = useMemo(
    () => buildStorageKey(studentId, topic, scheduledSessionId),
    [studentId, topic, scheduledSessionId],
  );

  const [runId, setRunId] = useState<string | null>(null);
  const [apiState, setApiState] = useState<DiagnosisApiResponse | null>(null);
  const [observations, setObservations] = useState<Partial<Record<DiagnosisDimensionId, DiagnosisObservationLevel>>>({});
  const [supportEvent, setSupportEvent] = useState<DiagnosisSupportEvent>("none");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postHistory = async (
    id: string,
    probeHistory: DiagnosisProbeResult[],
  ): Promise<DiagnosisApiResponse> => {
    const headers = await authHeaders();
    const response = await fetch(`${API_URL}/api/tutor/evidence-complete-diagnosis`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({
        diagnosisRunId: id,
        studentId,
        topic,
        startingPhase,
        scheduledSessionId,
        sessionContextKind,
        probeHistory,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.message || "Diagnosis evidence could not be processed.");
    }
    return body as DiagnosisApiResponse;
  };

  const loadExisting = async (id: string): Promise<DiagnosisApiResponse | null> => {
    const headers = await authHeaders();
    const response = await fetch(
      `${API_URL}/api/tutor/evidence-complete-diagnosis/${encodeURIComponent(id)}`,
      { headers, credentials: "include" },
    );
    if (response.status === 404) return null;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.message || "Diagnosis run could not be restored.");
    }
    return body as DiagnosisApiResponse;
  };

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!studentId) throw new Error("Student is missing.");
        if (!topic) throw new Error("Choose a topic before starting diagnosis.");

        const storedRunId = window.sessionStorage.getItem(storageKey);
        const id = storedRunId && isUuidLike(storedRunId) ? storedRunId : createRunId();
        window.sessionStorage.setItem(storageKey, id);
        if (!cancelled) setRunId(id);

        let state = storedRunId ? await loadExisting(id) : null;
        if (!state) state = await postHistory(id, []);

        if (!cancelled) {
          setApiState(state);
          setObservations({});
          setSupportEvent("none");
        }
      } catch (bootError) {
        if (!cancelled) {
          setError(bootError instanceof Error ? bootError.message : "Diagnosis could not start.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [studentId, topic, startingPhase, scheduledSessionId, sessionContextKind, storageKey]);

  const currentProbe = apiState?.nextProbe || null;
  const allDimensionsComplete = currentProbe
    ? currentProbe.dimensions.every((dimensionId) => !!observations[dimensionId])
    : false;

  const groupedDimensions = useMemo(() => {
    if (!currentProbe) return [] as Array<{ phase: TopicPhase; dimensions: DiagnosisDimensionId[] }>;
    return PHASE_ORDER
      .map((phase) => ({
        phase,
        dimensions: currentProbe.dimensions.filter(
          (dimensionId) => DIAGNOSIS_DIMENSIONS[dimensionId].phase === phase,
        ),
      }))
      .filter((group) => group.dimensions.length > 0);
  }, [currentProbe]);

  const submitProbe = async () => {
    if (!runId || !apiState || !currentProbe || !allDimensionsComplete) return;
    setSubmitting(true);
    setError(null);

    try {
      const result: DiagnosisProbeResult = {
        probeId: currentProbe.id,
        supportEvent,
        observations: currentProbe.dimensions.map((dimensionId) => ({
          dimensionId,
          level: observations[dimensionId]!,
        })),
      };

      const nextState = await postHistory(runId, [...apiState.probeHistory, result]);
      setApiState(nextState);
      setObservations({});
      setSupportEvent("none");

      if (nextState.finalized) {
        window.sessionStorage.removeItem(storageKey);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Evidence could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-8">
          <p className="text-sm text-muted-foreground">Opening response diagnosis...</p>
        </div>
      </main>
    );
  }

  if (error && !apiState) {
    return (
      <main className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border bg-card p-8">
          <h1 className="text-2xl font-semibold">Response Diagnosis</h1>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
          <button className="rounded-lg border px-4 py-2 text-sm" onClick={() => navigate(-1)}>
            Go back
          </button>
        </div>
      </main>
    );
  }

  const decision = apiState?.decision;
  const complete = Boolean(apiState?.finalized && decision?.complete);
  const blocked = Boolean(decision && !decision.complete && !decision.nextProbeId);

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-2xl border bg-card p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Evidence-complete response diagnosis
              </p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{topic}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Starting signal: {startingPhase}. The system decides every next probe from recorded evidence.
              </p>
            </div>
            <div className="rounded-xl border px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Evidence opportunities</div>
              <div className="mt-1 text-xl font-semibold">{apiState?.probeHistory.length || 0}</div>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {complete && decision ? (
          <section className="rounded-2xl border bg-card p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Diagnosis complete
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <ResultCell label="Entry phase" value={decision.placementPhase || "Unknown"} />
              <ResultCell label="Starting stability" value={decision.stability || "Unknown"} />
              <ResultCell label="Evidence confidence" value={decision.confidence} />
            </div>
            <div className="mt-6 rounded-xl border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why diagnosis stopped</p>
              <p className="mt-2 text-sm leading-6">{decision.reason}</p>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Placement was produced from {decision.cleanProbeCount} clean evidence opportunity
              {decision.cleanProbeCount === 1 ? "" : "ies"}
              {decision.contaminatedProbeCount
                ? ` and ${decision.contaminatedProbeCount} contaminated opportunity${decision.contaminatedProbeCount === 1 ? "" : "ies"} kept for audit only`
                : ""}.
            </p>
            <button
              type="button"
              className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              onClick={() => navigate("/operational/tutor/pod")}
            >
              Back to Pod
            </button>
          </section>
        ) : blocked && decision ? (
          <section className="rounded-2xl border border-amber-500/30 bg-card p-6">
            <h2 className="text-xl font-semibold">Evidence review required</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{decision.reason}</p>
            <p className="mt-4 text-sm font-medium">Do not guess a placement or choose another probe manually.</p>
          </section>
        ) : currentProbe ? (
          <>
            <section className="rounded-2xl border bg-card p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Opportunity {apiState?.opportunityNumber || (apiState?.probeHistory.length || 0) + 1}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">{currentProbe.label}</h2>
                </div>
                <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                  System-selected
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <InfoBlock label="Question this probe must answer" text={currentProbe.evidenceQuestion} />
                <InfoBlock
                  label="Why this opportunity exists"
                  text={apiState?.opportunityPurpose || "Resolve the next unanswered evidence question."}
                />
              </div>

              <div className="mt-4 rounded-xl border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialist instruction</p>
                <p className="mt-2 text-sm leading-6">{currentProbe.specialistInstruction}</p>
              </div>

              <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <p className="text-sm font-semibold">Zero tutoring contamination</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Observe exactly what happens. Do not teach the method, supply a step, correct the work, or rescue the student.
                  If intervention happens, log it below instead of hiding it.
                </p>
              </div>
            </section>

            {groupedDimensions.map((group) => (
              <section key={group.phase} className="rounded-2xl border bg-card p-5 sm:p-7">
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Evidence layer</p>
                  <h3 className="mt-1 text-xl font-semibold">{group.phase}</h3>
                </div>
                <div className="space-y-4">
                  {group.dimensions.map((dimensionId) => {
                    const copy = DIMENSION_COPY[dimensionId];
                    return (
                      <div key={dimensionId} className="rounded-xl border p-4">
                        <p className="font-medium">{copy.label}</p>
                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          {LEVELS.map((level) => {
                            const selected = observations[dimensionId] === level;
                            return (
                              <button
                                key={level}
                                type="button"
                                onClick={() => setObservations((current) => ({ ...current, [dimensionId]: level }))}
                                className={[
                                  "rounded-lg border p-3 text-left transition",
                                  selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                                ].join(" ")}
                              >
                                <span className="block text-xs font-semibold uppercase tracking-wide">
                                  {LEVEL_LABEL[level]}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{copy[level]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className="rounded-2xl border bg-card p-5 sm:p-7">
              <h3 className="text-lg font-semibold">Did you intervene?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This determines whether the observation can count as baseline diagnosis evidence.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {SUPPORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSupportEvent(option.value)}
                    className={[
                      "rounded-xl border p-4 text-left",
                      supportEvent === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "",
                      option.contaminated ? "border-amber-500/30" : "",
                    ].join(" ")}
                  >
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.detail}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {currentProbe.dimensions.filter((id) => observations[id]).length} / {currentProbe.dimensions.length} observations recorded
                </p>
                <button
                  type="button"
                  disabled={!allDimensionsComplete || submitting}
                  onClick={submitProbe}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Recording evidence..." : "Record evidence and continue"}
                </button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function ResultCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function InfoBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm leading-6">{text}</p>
    </div>
  );
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
