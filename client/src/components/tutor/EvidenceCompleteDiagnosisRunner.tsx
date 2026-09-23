import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { API_URL } from "@/lib/config";
import { supabase } from "@/lib/supabaseClient";
import {
  type DiagnosisDimensionId,
  type DiagnosisProbeDefinition,
  getDiagnosisPhaseSupportEvidence,
  type DiagnosisProbeResult,
  type DiagnosisSupportEvent,
  type EvidenceCompleteDiagnosisDecision,
} from "@shared/evidenceCompleteDiagnosis";
import {
  DIAGNOSIS_OBSERVATION_MATRIX,
  DIAGNOSIS_STABILITY_MEANINGS,
  type DiagnosisObservationOption,
} from "@shared/diagnosisObservationMatrix";
import { NEXT_ACTION_ENGINE, tryParsePhase, type TopicPhase } from "@shared/topicConditioningEngine";

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
    detail: "You clarified wording without supplying mathematical content, a method, a step, or an answer.",
    contaminated: false,
  },
  {
    value: "first_step_confirmation",
    title: "First-step confirmation happened",
    detail: "Record this honestly. The system will preserve the opportunity for audit but will not use it as clean baseline evidence.",
    contaminated: true,
  },
  {
    value: "teaching",
    title: "Teaching, correction, or rescue happened",
    detail: "Record this honestly. The system will preserve the opportunity but will request clean evidence rather than treating post-support behavior as baseline capability.",
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

const buildStorageKey = (
  studentId: string,
  topic: string,
  scheduledSessionId: string | null,
) =>
  [
    "ri-evidence-diagnosis",
    studentId,
    topic.trim().toLowerCase(),
    scheduledSessionId || "unscheduled",
  ].join(":");

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

export default function EvidenceCompleteDiagnosisRunner() {
  const { studentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const topic = String(searchParams.get("topic") || "").trim();
  const startingSignalPhase = tryParsePhase(searchParams.get("phase"));
  const startingPhase = startingSignalPhase || "Structured Execution";
  const scheduledSessionId =
    String(searchParams.get("scheduledSessionId") || "").trim() || null;
  const requestedSessionContext = String(
    searchParams.get("sessionContextKind") ||
      searchParams.get("context") ||
      "",
  )
    .trim()
    .toLowerCase();
  const sessionContextKind =
    requestedSessionContext === "handover"
      ? "handover"
      : requestedSessionContext === "training"
        ? "training"
        : "intro";

  const storageKey = useMemo(
    () => buildStorageKey(studentId, topic, scheduledSessionId),
    [studentId, topic, scheduledSessionId],
  );

  const [runId, setRunId] = useState<string | null>(null);
  const [apiState, setApiState] = useState<DiagnosisApiResponse | null>(null);
  const [observations, setObservations] = useState<
    Partial<Record<DiagnosisDimensionId, string>>
  >({});
  const [supportEvent, setSupportEvent] =
    useState<DiagnosisSupportEvent>("none");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opportunityStarted, setOpportunityStarted] = useState(false);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [confirmStep, setConfirmStep] = useState(false);

  const postHistory = async (
    id: string,
    probeHistory: DiagnosisProbeResult[],
  ): Promise<DiagnosisApiResponse> => {
    const headers = await authHeaders();
    const response = await fetch(
      `${API_URL}/api/tutor/evidence-complete-diagnosis`,
      {
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
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        body?.message || "Diagnosis evidence could not be processed.",
      );
    }
    return body as DiagnosisApiResponse;
  };

  const loadExisting = async (
    id: string,
  ): Promise<DiagnosisApiResponse | null> => {
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
        const id =
          storedRunId && isUuidLike(storedRunId) ? storedRunId : createRunId();
        window.sessionStorage.setItem(storageKey, id);
        if (!cancelled) setRunId(id);

        let state = storedRunId ? await loadExisting(id) : null;
        if (!state) {
          state = await postHistory(id, []);
        } else if (!state.finalized && state.decision?.complete) {
          // A prior finalization can fail after probe_history is durable but before
          // ledger/topic-state completion. Re-submit the exact stored history to
          // resume finalization instead of stranding the specialist outside the runner.
          state = await postHistory(id, state.probeHistory);
        }

        if (!cancelled) {
          setApiState(state);
          setObservations({});
          setSupportEvent("none");
          setOpportunityStarted(false);
          setActiveLayerIndex(0);
          setConfirmStep(false);
        }
      } catch (bootError) {
        if (!cancelled) {
          setError(
            bootError instanceof Error
              ? bootError.message
              : "Diagnosis could not start.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [
    studentId,
    topic,
    startingPhase,
    scheduledSessionId,
    sessionContextKind,
    storageKey,
  ]);

  const currentProbe = apiState?.nextProbe || null;
  const opportunityNumber =
    apiState?.opportunityNumber || (apiState?.probeHistory.length || 0) + 1;
  const allDimensionsComplete = currentProbe
    ? currentProbe.dimensions.every((dimensionId) => !!observations[dimensionId])
    : false;

  const groupedDimensions = useMemo(() => {
    if (!currentProbe) {
      return [] as Array<{
        phase: TopicPhase;
        dimensions: DiagnosisDimensionId[];
      }>;
    }
    return PHASE_ORDER.map((phase) => ({
      phase,
      dimensions: currentProbe.dimensions.filter(
        (dimensionId) =>
          DIAGNOSIS_OBSERVATION_MATRIX[dimensionId].phase === phase,
      ),
    })).filter((group) => group.dimensions.length > 0);
  }, [currentProbe]);

  const activeLayer = groupedDimensions[activeLayerIndex] || null;
  const activeLayerComplete = activeLayer
    ? activeLayer.dimensions.every((dimensionId) => !!observations[dimensionId])
    : false;
  const recordedBehaviorCount = currentProbe
    ? currentProbe.dimensions.filter((dimensionId) => observations[dimensionId]).length
    : 0;

  const scrollRunnerTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const beginOpportunity = () => {
    setOpportunityStarted(true);
    setActiveLayerIndex(0);
    setConfirmStep(false);
    scrollRunnerTop();
  };

  const continueFromLayer = () => {
    if (!activeLayerComplete) return;
    if (activeLayerIndex < groupedDimensions.length - 1) {
      setActiveLayerIndex((current) => current + 1);
    } else {
      setConfirmStep(true);
    }
    scrollRunnerTop();
  };

  const backWithinOpportunity = () => {
    if (confirmStep) {
      setConfirmStep(false);
      setActiveLayerIndex(Math.max(0, groupedDimensions.length - 1));
    } else if (activeLayerIndex > 0) {
      setActiveLayerIndex((current) => current - 1);
    } else {
      setOpportunityStarted(false);
    }
    scrollRunnerTop();
  };

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
          behaviorId: observations[dimensionId]!,
        })),
      };

      const nextState = await postHistory(runId, [
        ...apiState.probeHistory,
        result,
      ]);
      setApiState(nextState);
      setObservations({});
      setSupportEvent("none");
      setOpportunityStarted(false);
      setActiveLayerIndex(0);
      setConfirmStep(false);

      if (nextState.finalized) {
        window.sessionStorage.removeItem(storageKey);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Evidence could not be recorded.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-8">
          <p className="text-sm text-muted-foreground">
            Opening response diagnosis...
          </p>
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
          <button
            className="rounded-lg border px-4 py-2 text-sm"
            onClick={() => navigate(-1)}
          >
            Go back
          </button>
        </div>
      </main>
    );
  }

  const decision = apiState?.decision;
  const complete = Boolean(apiState?.finalized && decision?.complete);
  const blocked = Boolean(
    decision && !decision.complete && !decision.nextProbeId,
  );
  const placementPhaseState =
    decision?.phaseStates.find((state) => state.phase === decision.placementPhase) ||
    null;
  const placementPhaseIndex = decision?.placementPhase
    ? PHASE_ORDER.indexOf(decision.placementPhase)
    : -1;
  const earlierSupportEvidence =
    placementPhaseIndex > 0 && decision
      ? decision.phaseStates
          .slice(0, placementPhaseIndex)
          .filter((state) => state.status === "supported")
          .map(getDiagnosisPhaseSupportEvidence)
      : [];
  const placementSupportEvidence = placementPhaseState
    ? getDiagnosisPhaseSupportEvidence(placementPhaseState)
    : null;
  const allResponseLayersSupported = Boolean(
    decision?.phaseStates.length &&
      decision.phaseStates.every((state) => state.status === "supported"),
  );
  const nextAction =
    decision?.placementPhase && decision?.stability
      ? NEXT_ACTION_ENGINE[decision.placementPhase][decision.stability]
      : null;
  const stabilityExplanation =
    decision?.stability === "Low"
      ? "The decisive clean behavior showed a phase-defining breakdown. That maps to Low because the capability was substantially absent or broke at meaningful exposure."
      : decision?.stability === "Medium"
        ? "The decisive clean behavior was conditional or materially unstable. That maps to Medium because the capability exists, but does not yet hold reliably."
        : decision?.stability === "High" && allResponseLayersSupported
          ? "All four response layers were cleanly supported, including the required repeated timed evidence. Diagnosis still returns High because High Maintenance is training-earned and cannot be minted by diagnosis."
          : decision?.stability === "High"
            ? "The decisive clean behavior was near-stable: the capability was substantially present and usable, but not fully clean. That is stronger than conditional or breakdown evidence, so the starting stability is High rather than Medium or Low."
            : null;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-2xl border bg-card p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Evidence-native response diagnosis
              </p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
                {topic}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {startingSignalPhase
                  ? `Starting signal: ${startingSignalPhase}. The signal chooses the first question only; observed behavior decides placement.`
                  : "No starting signal. The system is using a neutral independent baseline rather than assuming Clarity."}
              </p>
            </div>
            <div className="rounded-xl border px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Evidence opportunities
              </div>
              <div className="mt-1 text-xl font-semibold">
                {apiState?.probeHistory.length || 0}
              </div>
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
              <ResultCell
                label="Entry phase"
                value={decision.placementPhase || "Unknown"}
              />
              <ResultCell
                label="Starting stability"
                value={decision.stability || "Unknown"}
              />
              <ResultCell
                label="Evidence confidence"
                value={decision.confidence}
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Why {decision.placementPhase || "this phase"}
                </p>
                <p className="mt-2 text-sm leading-6">{decision.reason}</p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Why {decision.stability || "this stability"}
                </p>
                <p className="mt-2 text-sm leading-6">
                  {stabilityExplanation ||
                    "Starting stability was derived categorically from the decisive clean behavior."}
                </p>
                {decision.stability && (
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {DIAGNOSIS_STABILITY_MEANINGS[decision.stability]}
                  </p>
                )}
              </div>
            </div>

            {earlierSupportEvidence.length > 0 && (
              <div className="mt-4 rounded-xl border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Evidence that earlier layers cleared
                </p>
                <div className="mt-3 space-y-4">
                  {earlierSupportEvidence.map((phaseEvidence) => (
                    <div
                      key={phaseEvidence.phase}
                      className="rounded-lg bg-muted/30 p-3"
                    >
                      <p className="text-sm font-semibold">
                        {phaseEvidence.phase} — cleared
                      </p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {phaseEvidence.dimensions.map((dimension) => (
                          <div
                            key={dimension.dimensionId}
                            className="rounded-lg border bg-background px-3 py-2"
                          >
                            <p className="text-sm font-medium">
                              {dimension.dimensionLabel}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {dimension.supportedCount} /{" "}
                              {dimension.requiredSupportedObservations} clean
                              supporting observation
                              {dimension.requiredSupportedObservations === 1
                                ? ""
                                : "s"}
                            </p>
                            <div className="mt-2 space-y-1">
                              {dimension.supportingBehaviors.map(
                                (behaviorLabel, index) => (
                                  <p
                                    key={`${dimension.dimensionId}:support:${index}`}
                                    className="text-xs text-muted-foreground"
                                  >
                                    • {behaviorLabel}
                                  </p>
                                ),
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {placementSupportEvidence &&
              placementSupportEvidence.dimensions.length > 0 && (
                <div className="mt-4 rounded-xl border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Clean evidence inside {decision.placementPhase}
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {placementSupportEvidence.dimensions.map((dimension) => (
                      <div
                        key={dimension.dimensionId}
                        className="rounded-lg bg-muted/30 px-3 py-2"
                      >
                        <p className="text-sm font-medium">
                          {dimension.dimensionLabel}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {dimension.supportedCount} /{" "}
                          {dimension.requiredSupportedObservations} clean
                          supporting observation
                          {dimension.requiredSupportedObservations === 1
                            ? ""
                            : "s"}
                        </p>
                        <div className="mt-2 space-y-1">
                          {dimension.supportingBehaviors.map(
                            (behaviorLabel, index) => (
                              <p
                                key={`${dimension.dimensionId}:entry-support:${index}`}
                                className="text-xs text-muted-foreground"
                              >
                                • {behaviorLabel}
                              </p>
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {decision.placementEvidence.length > 0 && (
              <div className="mt-4 rounded-xl border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Behavior that determined the entry state
                </p>
                <div className="mt-3 space-y-2">
                  {decision.placementEvidence.map((item, index) => (
                    <div
                      key={`${item.dimensionId}:${item.behaviorId}:${index}`}
                      className="rounded-lg bg-muted/40 px-3 py-2"
                    >
                      <p className="text-sm font-medium">
                        {item.dimensionLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.behaviorLabel}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nextAction && (
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Next move
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {nextAction.primaryAction}
                </p>
                {decision.stability === "High" && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Diagnosis cannot mint High Maintenance. This training move
                    must first establish High Maintenance; once earned, a later
                    qualifying confirmation is still required before phase
                    progression.
                  </p>
                )}
              </div>
            )}

            <p className="mt-4 text-sm text-muted-foreground">
              The system resolved phase and starting stability from the recorded
              response behavior and preserved evidence path.
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
            <h2 className="text-xl font-semibold">
              Evidence review required
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {decision.reason}
            </p>
            <p className="mt-4 text-sm font-medium">
              Do not guess a placement or choose another probe manually.
            </p>
          </section>
        ) : currentProbe ? (
          !opportunityStarted ? (
            <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                  Ready
                </span>
                <span>Observe</span>
                <span className="text-primary/30">→</span>
                <span>Confirm</span>
              </div>

              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Opportunity {opportunityNumber}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {currentProbe.label}
                  </h2>
                </div>
                <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                  System-selected
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {currentProbe.evidenceQuestion}
              </p>

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  DO THIS NOW
                </p>
                <p className="mt-1 text-base font-semibold leading-6">
                  {currentProbe.specialistInstruction}
                </p>
              </div>

              <div className="mt-4 rounded-xl border p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Why this opportunity exists
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {apiState?.opportunityPurpose ||
                    "Resolve the next unanswered evidence question."}
                </p>
              </div>

              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Use one problem for this opportunity. Observe the whole response.
                The runner will capture one evidence layer at a time so you can
                stay focused on the student rather than a long form.
              </p>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  onClick={beginOpportunity}
                >
                  Begin Opportunity {opportunityNumber}
                </button>
              </div>
            </section>
          ) : confirmStep ? (
            <section className="rounded-2xl border bg-card p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="rounded-full border border-primary/15 px-2 py-1">
                  Ready ✓
                </span>
                <span className="rounded-full border border-primary/15 px-2 py-1">
                  Observe ✓
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                  Confirm
                </span>
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Opportunity {opportunityNumber}
              </p>
              <h2 className="mt-1 text-2xl font-semibold">
                Confirm what happened
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {recordedBehaviorCount} / {currentProbe.dimensions.length} behaviors recorded.
                Record any intervention separately before committing this opportunity.
              </p>

              <div className="mt-5">
                <h3 className="text-lg font-semibold">Did you intervene?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Teaching or first-step assistance cannot silently remain
                  baseline diagnosis evidence.
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {SUPPORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSupportEvent(option.value)}
                      className={[
                        "rounded-xl border p-4 text-left",
                        supportEvent === option.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "",
                        option.contaminated ? "border-amber-500/30" : "",
                      ].join(" ")}
                    >
                      <span className="block text-sm font-medium">
                        {option.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {option.detail}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/50"
                  onClick={backWithinOpportunity}
                  disabled={submitting}
                >
                  Back to observations
                </button>
                <button
                  type="button"
                  disabled={!allDimensionsComplete || submitting}
                  onClick={submitProbe}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "Recording evidence..."
                    : "Confirm Opportunity " + opportunityNumber}
                </button>
              </div>
            </section>
          ) : activeLayer ? (
            <section className="rounded-2xl border bg-card p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="rounded-full border border-primary/15 px-2 py-1">
                  Ready ✓
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                  Observe
                </span>
                <span className="text-primary/30">→</span>
                <span>Confirm</span>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Opportunity {opportunityNumber} · Evidence layer {activeLayerIndex + 1} of {groupedDimensions.length}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    {activeLayer.phase}
                  </h2>
                </div>
                <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                  {recordedBehaviorCount} / {currentProbe.dimensions.length} recorded
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Keep observing this same opportunity
                </p>
                <p className="mt-1 text-sm font-medium leading-6">
                  {currentProbe.specialistInstruction}
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <p className="text-sm font-semibold">Record behavior, not a judgment</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Select only what actually happened. Do not translate the response
                  into Low, Medium, High, weak, partial, or clear.
                </p>
              </div>

              <div className="mt-5 space-y-5">
                {activeLayer.dimensions.map((dimensionId) => {
                  const definition = DIAGNOSIS_OBSERVATION_MATRIX[dimensionId];
                  return (
                    <div key={dimensionId} className="rounded-xl border p-4">
                      <p className="font-medium">{definition.label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {definition.observationQuestion}
                      </p>
                      <div className="mt-4 grid gap-2 lg:grid-cols-2">
                        {definition.options.map((option) => (
                          <BehaviorOption
                            key={option.id}
                            option={option}
                            selected={observations[dimensionId] === option.id}
                            onSelect={() =>
                              setObservations((current) => ({
                                ...current,
                                [dimensionId]: option.id,
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/50"
                  onClick={backWithinOpportunity}
                >
                  {activeLayerIndex === 0 ? "Back to ready" : "Previous layer"}
                </button>
                <button
                  type="button"
                  disabled={!activeLayerComplete}
                  onClick={continueFromLayer}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {activeLayerIndex === groupedDimensions.length - 1
                    ? "Review Opportunity"
                    : "Next Evidence Layer"}
                </button>
              </div>
            </section>
          ) : null
        ) : null}
      </div>
    </main>
  );
}

function BehaviorOption({
  option,
  selected,
  onSelect,
}: {
  option: DiagnosisObservationOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "rounded-lg border p-3 text-left transition",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "hover:bg-muted/50",
      ].join(" ")}
    >
      <span className="block text-sm font-medium">{option.label}</span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
        {option.detail}
      </span>
    </button>
  );
}

function ResultCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
