from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly 1 match, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


def replace_count(path: str, old: str, new: str, expected: int) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new))


# Server: trust V2 inherited evidence and gate positive movement.
replace_once(
    "server/routes.ts",
    '} from "@shared/topicConditioningEngine";\nimport { normalizeObservationLevelValue } from "@shared/observationScoring";',
    '} from "@shared/topicConditioningEngine";\nimport {\n  applyInheritedVerificationGate,\n} from "@shared/inheritedLayerVerification";\nimport { normalizeObservationLevelValue } from "@shared/observationScoring";',
)

old_summary = '''            return {
              observedPhase,
              previousStability,
              phase: transition.next_phase,
              stability: transition.next_stability,
              transitionReason: normalizeTransitionReason(transition.transition_reason),
              phaseDecision: transition.transition_reason === "phase progress" ? "advance" :
                           transition.transition_reason === "stability regress" ? "regress" : "remain",
              sessionScore,
              nextAction: nextActionConfig?.primaryAction || null,
              constraint: nextActionConfig?.rules?.[0] || null,
              repRows,
              setScores,
              highGuardPasses,
              lowStreakAfterSession: 0, // No longer used in new transition engine
            };'''
new_summary = '''            const baseSummary = {
              observedPhase,
              previousStability,
              phase: transition.next_phase,
              stability: transition.next_stability,
              transitionReason: normalizeTransitionReason(transition.transition_reason),
              phaseDecision: (
                transition.transition_reason === "phase progress" ? "advance" :
                transition.transition_reason === "stability regress" ? "regress" : "remain"
              ) as "advance" | "regress" | "remain",
              sessionScore,
              nextAction: nextActionConfig?.primaryAction || null,
              constraint: nextActionConfig?.rules?.[0] || null,
              repRows,
              setScores,
              highGuardPasses,
              lowStreakAfterSession: 0, // No longer used in new transition engine
            };

            return applyInheritedVerificationGate(baseSummary, sets);'''
replace_once("server/routes.ts", old_summary, new_summary)

old_existing = '''                const existing = topicsStore[normalizedTopic] && typeof topicsStore[normalizedTopic] === "object"
                  ? topicsStore[normalizedTopic]
                  : {};

                const previousStability = normalizeStability('''
new_existing = '''                const existing = topicsStore[normalizedTopic] && typeof topicsStore[normalizedTopic] === "object"
                  ? topicsStore[normalizedTopic]
                  : {};
                const activeInheritedVerificationHold = existing?.inheritedVerificationHold;
                if (
                  activeInheritedVerificationHold?.kind === "inherited_verification_required" &&
                  ["verification_required", "targeted_re_diagnosis_required"].includes(String(activeInheritedVerificationHold?.status || ""))
                ) {
                  throw new Error(
                    `Inherited-layer verification must be resolved for ${normalizedTopic} before normal training resumes.`
                  );
                }

                const previousStability = normalizeStability('''
replace_once("server/routes.ts", old_existing, new_existing)

replace_once(
    "server/routes.ts",
    '''                  phase: trainingSummary.phase,
                  stability: trainingSummary.stability,
                  lastUpdated: nowIso,
                  nextAction: trainingSummary.nextAction,''',
    '''                  phase: trainingSummary.phase,
                  stability: trainingSummary.stability,
                  inheritedVerificationHold: trainingSummary.inheritedVerificationHold || null,
                  freshCurrentPhaseEvidenceRequired: false,
                  lastUpdated: nowIso,
                  nextAction: trainingSummary.nextAction,''',
)

replace_once(
    "server/routes.ts",
    '''                    trainingSummary.constraint ? `Constraint: ${trainingSummary.constraint}` : null,
                  ]''',
    '''                    trainingSummary.constraint ? `Constraint: ${trainingSummary.constraint}` : null,
                    trainingSummary.inheritedVerificationHold
                      ? `Inherited verification required: ${trainingSummary.inheritedVerificationHold.targetPhase}`
                      : null,
                  ]''',
)

replace_once(
    "server/routes.ts",
    '''                        nextAction: trainingSummary.nextAction,
                        constraint: trainingSummary.constraint,
                      },''',
    '''                        nextAction: trainingSummary.nextAction,
                        constraint: trainingSummary.constraint,
                        inheritedVerificationHold: trainingSummary.inheritedVerificationHold || null,
                        transitionWithheld: trainingSummary.transitionWithheld || null,
                      },''',
)

replace_once(
    "server/routes.ts",
    '''            topicReference: parseStoredTopicReference(entry?.topicReference),
          };''',
    '''            topicReference: parseStoredTopicReference(entry?.topicReference),
            inheritedVerificationHold: entry?.inheritedVerificationHold || null,
            freshCurrentPhaseEvidenceRequired: !!entry?.freshCurrentPhaseEvidenceRequired,
          };''',
)

# Runner: capture actual earlier-layer break as rep-level V2 evidence.
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''  type ActualSupportUsedV2,
  type RepOperationalEvidenceV2,
} from "@shared/responseIntegrityEvidenceContractV2";''',
    '''  type ActualSupportUsedV2,
  type InheritedEvidenceDimensionV2,
  type RepOperationalEvidenceV2,
  type SupplementalInheritedEvidenceV2,
} from "@shared/responseIntegrityEvidenceContractV2";''',
)

replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''type TpsTimedPressureLevel = Exclude<TpsPressureLevel, "none" | "difficulty">;

const EMPTY_TOPIC_REFERENCE''',
    '''type TpsTimedPressureLevel = Exclude<TpsPressureLevel, "none" | "difficulty">;
type InheritedBreakDraft = {
  dimensionId: InheritedEvidenceDimensionV2 | "";
  rawObservation: string;
};

const INHERITED_DIMENSION_OPTIONS: Record<PhaseLabel, Array<{ value: InheritedEvidenceDimensionV2; label: string }>> = {
  Clarity: [],
  "Structured Execution": [
    { value: "clarity.vocabulary", label: "Clarity - vocabulary / problem recognition" },
    { value: "clarity.method", label: "Clarity - method map" },
    { value: "clarity.reason", label: "Clarity - reason / why" },
    { value: "clarity.immediate_apply", label: "Clarity - immediate application" },
  ],
  "Controlled Discomfort": [
    { value: "clarity.vocabulary", label: "Clarity - vocabulary / problem recognition" },
    { value: "clarity.method", label: "Clarity - method map" },
    { value: "clarity.reason", label: "Clarity - reason / why" },
    { value: "clarity.immediate_apply", label: "Clarity - immediate application" },
    { value: "execution.start", label: "Structured Execution - independent start" },
    { value: "execution.step_discipline", label: "Structured Execution - step discipline" },
    { value: "execution.repeatability", label: "Structured Execution - repeatability" },
    { value: "execution.independence", label: "Structured Execution - independence" },
  ],
  "Time Pressure Stability": [
    { value: "clarity.vocabulary", label: "Clarity - vocabulary / problem recognition" },
    { value: "clarity.method", label: "Clarity - method map" },
    { value: "clarity.reason", label: "Clarity - reason / why" },
    { value: "clarity.immediate_apply", label: "Clarity - immediate application" },
    { value: "execution.start", label: "Structured Execution - independent start" },
    { value: "execution.step_discipline", label: "Structured Execution - step discipline" },
    { value: "execution.repeatability", label: "Structured Execution - repeatability" },
    { value: "execution.independence", label: "Structured Execution - independence" },
    { value: "difficulty.initial_response", label: "Controlled Discomfort - initial response" },
    { value: "difficulty.first_step_control", label: "Controlled Discomfort - first-step control" },
    { value: "difficulty.tolerance", label: "Controlled Discomfort - difficulty tolerance" },
    { value: "difficulty.rescue_dependence", label: "Controlled Discomfort - rescue dependence" },
  ],
};

const EMPTY_TOPIC_REFERENCE''',
)

replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''  const [actualSupportUsedByRep, setActualSupportUsedByRep] = useState<Record<string, ActualSupportUsedV2>>({});
  const actualSupportUsedRef = useRef<Record<string, ActualSupportUsedV2>>({});''',
    '''  const [actualSupportUsedByRep, setActualSupportUsedByRep] = useState<Record<string, ActualSupportUsedV2>>({});
  const actualSupportUsedRef = useRef<Record<string, ActualSupportUsedV2>>({});
  const [inheritedBreakByRep, setInheritedBreakByRep] = useState<Record<string, InheritedBreakDraft>>({});
  const inheritedBreakByRepRef = useRef<Record<string, InheritedBreakDraft>>({});''',
)

replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''  const currentActualSupportUsed = actualSupportUsedByRep[currentOperationalRepKey] || null;
  const isTpsTimedRep =''',
    '''  const currentActualSupportUsed = actualSupportUsedByRep[currentOperationalRepKey] || null;
  const currentInheritedBreakDraft = inheritedBreakByRep[currentOperationalRepKey] || { dimensionId: "", rawObservation: "" };
  const shouldCaptureInheritedLayerEvidence =
    modeToUse === "training" &&
    displayPhase !== "Clarity" &&
    !!set &&
    !isModelingSet;
  const topicReferenceLockedForScoredEvidence =
    modeToUse === "training" && !!set && !isModelingSet;
  const isTpsTimedRep =''',
)

replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''    actualSupportUsedRef.current = {};
    passiveRepStartRef.current = {};''',
    '''    actualSupportUsedRef.current = {};
    inheritedBreakByRepRef.current = {};
    setInheritedBreakByRep({});
    passiveRepStartRef.current = {};''',
)

replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''  useEffect(() => {
    if (!shouldCapturePassiveRepTiming) return;
    if (finalizedRepOperationalEvidenceRef.current[currentOperationalRepKey]) return;''',
    '''  useEffect(() => {
    if (topicReferenceLockedForScoredEvidence && topicReferenceOpen) {
      setTopicReferenceOpen(false);
    }
  }, [topicReferenceLockedForScoredEvidence, topicReferenceOpen]);

  useEffect(() => {
    if (!shouldCapturePassiveRepTiming) return;
    if (finalizedRepOperationalEvidenceRef.current[currentOperationalRepKey]) return;''',
)

old_support_handler = '''  const handleActualSupportUsed = (value: ActualSupportUsedV2) => {
    setSubmitError(null);
    actualSupportUsedRef.current[currentOperationalRepKey] = value;
    setActualSupportUsedByRep((current) => ({ ...current, [currentOperationalRepKey]: value }));
    const finalized = finalizedRepOperationalEvidenceRef.current[currentOperationalRepKey];
    if (finalized) {
      finalizedRepOperationalEvidenceRef.current[currentOperationalRepKey] = {
        ...finalized,
        actualSupportUsed: value,
      };
    }
  };

  const finalizePassiveTimingForCurrentRep = () => {'''
new_support_handler = '''  const handleActualSupportUsed = (value: ActualSupportUsedV2) => {
    setSubmitError(null);
    actualSupportUsedRef.current[currentOperationalRepKey] = value;
    setActualSupportUsedByRep((current) => ({ ...current, [currentOperationalRepKey]: value }));
    const finalized = finalizedRepOperationalEvidenceRef.current[currentOperationalRepKey];
    if (finalized) {
      finalizedRepOperationalEvidenceRef.current[currentOperationalRepKey] = {
        ...finalized,
        actualSupportUsed: value,
      };
    }
  };

  const inheritedEvidenceForRep = (repKey: string): SupplementalInheritedEvidenceV2[] => {
    const draft = inheritedBreakByRepRef.current[repKey];
    if (!draft?.dimensionId || !draft.rawObservation.trim()) return [];
    return [{
      dimensionId: draft.dimensionId,
      rawObservation: draft.rawObservation.trim(),
      normalizedLevel: "weak",
      materiality: "material",
    }];
  };

  const updateInheritedBreakDraft = (patch: Partial<InheritedBreakDraft>) => {
    setSubmitError(null);
    const current = inheritedBreakByRepRef.current[currentOperationalRepKey] || {
      dimensionId: "",
      rawObservation: "",
    };
    const next = { ...current, ...patch };
    if (!next.dimensionId) next.rawObservation = "";
    inheritedBreakByRepRef.current[currentOperationalRepKey] = next;
    setInheritedBreakByRep((all) => ({ ...all, [currentOperationalRepKey]: next }));
    const finalized = finalizedRepOperationalEvidenceRef.current[currentOperationalRepKey];
    if (finalized) {
      finalizedRepOperationalEvidenceRef.current[currentOperationalRepKey] = {
        ...finalized,
        inheritedEvidence: inheritedEvidenceForRep(currentOperationalRepKey),
      };
    }
  };

  const finalizePassiveTimingForCurrentRep = () => {'''
replace_once("client/src/components/tutor/IntroSessionDrillRunner.tsx", old_support_handler, new_support_handler)

replace_count(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''      inheritedEvidence: [],''',
    '''      inheritedEvidence: inheritedEvidenceForRep(currentOperationalRepKey),''',
    2,
)

replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''    if (shouldCapturePassiveRepTiming && !actualSupportUsedRef.current[currentOperationalRepKey]) {
      setSubmitError("Record the support actually used on this rep before continuing.");''',
    '''    if (
      shouldCaptureInheritedLayerEvidence &&
      currentInheritedBreakDraft.dimensionId &&
      !currentInheritedBreakDraft.rawObservation.trim()
    ) {
      setSubmitError("Describe the observable earlier-layer break before continuing, or clear the inherited-layer selection.");
      return;
    }

    if (shouldCapturePassiveRepTiming && !actualSupportUsedRef.current[currentOperationalRepKey]) {
      setSubmitError("Record the support actually used on this rep before continuing.");''',
)

# Topic Reference is closed and unavailable during scored evidence.
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''            onClick={() => setTopicReferenceOpen((open) => !open)}
            aria-expanded={topicReferenceOpen}
          >''',
    '''            onClick={() => {
              if (!topicReferenceLockedForScoredEvidence) setTopicReferenceOpen((open) => !open);
            }}
            aria-expanded={topicReferenceOpen && !topicReferenceLockedForScoredEvidence}
            disabled={topicReferenceLockedForScoredEvidence}
          >''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''              <span className="block text-xs text-muted-foreground">{currentTopicName}</span>
            </span>
            <span className="text-xs font-semibold text-primary">{topicReferenceOpen ? "Close" : "Open"}</span>''',
    '''              <span className="block text-xs text-muted-foreground">{currentTopicName}</span>
              {topicReferenceLockedForScoredEvidence && (
                <span className="block text-xs text-muted-foreground">Available between reps - unavailable during scored evidence.</span>
              )}
            </span>
            <span className="text-xs font-semibold text-primary">
              {topicReferenceLockedForScoredEvidence ? "Locked" : topicReferenceOpen ? "Close" : "Open"}
            </span>''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''          {topicReferenceOpen && (
            <div className="space-y-3 border-t border-primary/15 px-4 py-4">''',
    '''          {topicReferenceOpen && !topicReferenceLockedForScoredEvidence && (
            <div className="space-y-3 border-t border-primary/15 px-4 py-4">''',
)

# Synchronize loose support wording with the approved global minimal ceiling.
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''      purpose: "Test clarity under active solving. Minimal guidance only. Observe whether clarity holds when they execute.",
      repInstruction: "Ask student to solve. Minimal guidance. Observe clarity under execution.",
      activeRules: ["Minimal guidance only", "No step-by-step help", "Observe independent start and execution"],''',
    '''      purpose: "Test clarity under active solving. Minimal support means response-control cueing only; no mathematical help.",
      repInstruction: "Ask student to solve. If needed, use only a response-control cue such as pause, don't rush, or show me what you would do next.",
      activeRules: ["Response-control cue only if needed", "No mathematical hints, steps, corrections, or correctness confirmation", "Observe independent start and execution"],''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''    constraints: ["No full rescue", "Hold discomfort window", "One-step confirmation max"],''',
    '''    constraints: ["Support level is a ceiling, not a script", "Minimal = response-control cue only", "No mathematical hint or correctness confirmation"],''',
)

inherited_ui = '''      {shouldCaptureInheritedLayerEvidence && (
        <div className="rounded-xl border border-primary/20 bg-background p-3 space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Earlier-layer integrity</p>
            <p className="text-xs text-muted-foreground">
              Optional: record a material earlier-layer break only when it is visibly present on this rep. This does not change the current-phase score; RI-OS uses it to gate progression and route verification.
            </p>
          </div>
          <select
            className="w-full rounded-md border border-primary/20 bg-background px-3 py-2 text-sm text-foreground"
            value={currentInheritedBreakDraft.dimensionId}
            onChange={(event) => updateInheritedBreakDraft({ dimensionId: event.target.value as InheritedEvidenceDimensionV2 | "" })}
          >
            <option value="">No material earlier-layer break recorded</option>
            {INHERITED_DIMENSION_OPTIONS[displayPhase].map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {currentInheritedBreakDraft.dimensionId && (
            <textarea
              className="min-h-20 w-full rounded-md border border-primary/20 bg-background px-3 py-2 text-sm text-foreground"
              value={currentInheritedBreakDraft.rawObservation}
              onChange={(event) => updateInheritedBreakDraft({ rawObservation: event.target.value })}
              placeholder="Describe only what was visibly observed, e.g. the known step order disappeared under the active condition."
              maxLength={1000}
            />
          )}
        </div>
      )}
'''
marker = '      {(shouldCapturePassiveRepTiming || isTpsTimedRep) && (\n'
p = Path("client/src/components/tutor/IntroSessionDrillRunner.tsx")
text = p.read_text()
if text.count(marker) != 1:
    raise SystemExit(f"runner inherited UI marker count={text.count(marker)}")
p.write_text(text.replace(marker, inherited_ui + marker, 1))

# Topic map: a hold cannot be bypassed by normal or mixed-topic training.
replace_once(
    "client/src/components/tutor/StudentTopicConditioningDialog.tsx",
    '''      observationNotes?: string | null;
      history?: Array<{''',
    '''      observationNotes?: string | null;
      inheritedVerificationHold?: {
        kind?: string | null;
        targetPhase?: string | null;
        triggeredFromPhase?: string | null;
        resumePhase?: string | null;
        resumeStability?: string | null;
        status?: "verification_required" | "targeted_re_diagnosis_required" | string | null;
      } | null;
      freshCurrentPhaseEvidenceRequired?: boolean | null;
      history?: Array<{''',
)

old_launch = '''  const launchTrainingSession = (sessionId?: string | null) => {
    const selectedTopics = Array.from(selectedSessionTopics);
    if (selectedTopics.length === 0) return;

    const selectedTopicStates = selectedTopics
      .map((topicName) => topics.find((topic) => topic.topic === topicName))
      .filter((topic): topic is TopicRow => !!topic);
    const unobservedTopics = selectedTopicStates.filter((topic) => !topic.hasObservedState);
'''
new_launch = '''  const launchTrainingSession = (sessionId?: string | null) => {
    const selectedTopics = Array.from(selectedSessionTopics);
    if (selectedTopics.length === 0) return;

    const inheritedHoldForTopic = (topicName: string) => {
      const normalized = normalizeTopicKey(topicName);
      const entries = persistedTopicStates && typeof persistedTopicStates === "object"
        ? Object.values(persistedTopicStates)
        : [];
      const entry = entries.find((candidate: any) => normalizeTopicKey(candidate?.topic) === normalized) as any;
      const hold = entry?.inheritedVerificationHold;
      return hold?.kind === "inherited_verification_required" ? hold : null;
    };

    const selectedTopicStates = selectedTopics
      .map((topicName) => topics.find((topic) => topic.topic === topicName))
      .filter((topic): topic is TopicRow => !!topic);
    const inheritedHeldTopics = selectedTopics
      .map((topicName) => ({ topicName, hold: inheritedHoldForTopic(topicName) }))
      .filter((entry) => !!entry.hold);
    const unobservedTopics = selectedTopicStates.filter((topic) => !topic.hasObservedState);

    if (selectedTopics.length > 1 && inheritedHeldTopics.length > 0) {
      setTrainingSessionMeetMessage(
        `${inheritedHeldTopics[0].topicName} requires earlier-layer verification before mixed-topic training can continue.`
      );
      return;
    }
'''
replace_once("client/src/components/tutor/StudentTopicConditioningDialog.tsx", old_launch, new_launch)

replace_once(
    "client/src/components/tutor/StudentTopicConditioningDialog.tsx",
    '''      setSessionTopicsModalOpen(false);
      if (!topicState.hasObservedState) {
        navigate(`/specialist/intro-session/${studentId}?topic=${topicParam}&phase=${phaseParam}&stability=${stabilityParam}&context=training${sessionParam}`);
        return;
      }
      navigate(`/specialist/intro-session/${studentId}?mode=training&topic=${topicParam}&phase=${phaseParam}&stability=${stabilityParam}${sessionParam}`);''',
    '''      setSessionTopicsModalOpen(false);
      const inheritedHold = inheritedHoldForTopic(topicState.topic);
      if (inheritedHold) {
        const verificationPhaseParam = encodeURIComponent(normalizePhase(inheritedHold.targetPhase || topicState.phase));
        const resumeStabilityParam = encodeURIComponent(normalizeStability(inheritedHold.resumeStability || topicState.stability));
        const rediagnosisParam = inheritedHold.status === "targeted_re_diagnosis_required" ? "&rediagnosis=1" : "";
        navigate(`/specialist/intro-session/${studentId}?mode=inherited-verification${rediagnosisParam}&topic=${topicParam}&phase=${verificationPhaseParam}&stability=${resumeStabilityParam}${sessionParam}`);
        return;
      }
      if (!topicState.hasObservedState) {
        navigate(`/specialist/intro-session/${studentId}?topic=${topicParam}&phase=${phaseParam}&stability=${stabilityParam}&context=training${sessionParam}`);
        return;
      }
      navigate(`/specialist/intro-session/${studentId}?mode=training&topic=${topicParam}&phase=${phaseParam}&stability=${stabilityParam}${sessionParam}`);''',
)

print("Stage 1 patch applied")
