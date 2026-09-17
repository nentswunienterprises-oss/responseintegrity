from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly 1 match, found {count}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


def append_once(path: str, marker: str, addition: str) -> None:
    p = Path(path)
    text = p.read_text()
    if addition.strip() in text:
        raise SystemExit(f"{path}: addition already present")
    if marker not in text:
        raise SystemExit(f"{path}: append marker missing")
    p.write_text(text + addition)


# ---------------------------------------------------------------------------
# Response Snapshot: inherited verification is a first-class deterministic mode.
# Also correct targeted handover re-diagnosis to use diagnosis registry evidence.
# ---------------------------------------------------------------------------
replace_once(
    "shared/responseSnapshot.ts",
    '''    mode: "training" | "diagnosis" | "handover_verification" | "handover_rediagnosis";''',
    '''    mode: "training" | "diagnosis" | "handover_verification" | "handover_rediagnosis" | "inherited_verification" | "inherited_rediagnosis";''',
)
replace_once(
    "shared/responseSnapshot.ts",
    '''  mode: EvidenceDrillMode | "handover_verification" | "handover_rediagnosis";''',
    '''  mode: EvidenceDrillMode | "handover_verification" | "handover_rediagnosis" | "inherited_verification" | "inherited_rediagnosis";''',
)
replace_once(
    "shared/responseSnapshot.ts",
    '''const drillModeForRegistry = (mode: BuildResponseSnapshotInput["mode"]): EvidenceDrillMode =>
  mode === "handover_verification" || mode === "handover_rediagnosis" ? "verification" : mode;''',
    '''const drillModeForRegistry = (mode: BuildResponseSnapshotInput["mode"]): EvidenceDrillMode => {
  if (mode === "handover_verification" || mode === "inherited_verification") return "verification";
  if (mode === "handover_rediagnosis" || mode === "inherited_rediagnosis") return "diagnosis";
  return mode;
};''',
)

append_once(
    "shared/responseSnapshot.test.ts",
    'test("persisted rep wording is rendered verbatim after generation"',
    '''

test("inherited verification snapshots use verification evidence while targeted re-diagnosis uses diagnosis evidence", () => {
  const verificationSet = buildSubmittedSetByPattern({
    mode: "verification",
    phase: "Structured Execution",
    setName: "Cold Start",
    pattern: "PPP",
  });
  const verificationSnapshot = buildResponseSnapshotV1({
    sourceDrillId: "inherited-verification",
    topic: "Linear Equations",
    mode: "inherited_verification",
    phase: "Structured Execution",
    sets: [verificationSet],
    drillScore: 55,
    setScores: [55],
  });
  assert.equal(verificationSnapshot.source.mode, "inherited_verification");
  assert.equal(verificationSnapshot.sets[0].setName, "Cold Start");

  const diagnosisSet = buildSubmittedSetByPattern({
    mode: "diagnosis",
    phase: "Structured Execution",
    setName: "Cold Start",
    pattern: "SSS",
  }) as SubmittedEvidenceSet & { phase: TopicPhase };
  diagnosisSet.phase = "Structured Execution";
  const diagnosisSnapshot = buildResponseSnapshotV1({
    sourceDrillId: "inherited-rediagnosis",
    topic: "Linear Equations",
    mode: "inherited_rediagnosis",
    phase: "Structured Execution",
    sets: [diagnosisSet],
    drillScore: 90,
    setScores: [90],
  });
  assert.equal(diagnosisSnapshot.source.mode, "inherited_rediagnosis");
  assert.equal(diagnosisSnapshot.sets[0].setName, "Cold Start");
});
''',
)

# ---------------------------------------------------------------------------
# Evidence ledger backfill: preserve inherited-verification lineage.
# ---------------------------------------------------------------------------
ledger_anchor = '''  if (normalizedDrillType === "handover_verification") {'''
ledger_branch = '''  if (normalizedDrillType === "inherited_verification") {
    const verificationMode = cleanString(parsed.inheritedVerificationMode).toLowerCase();
    const isTargetedRediagnosis = verificationMode === "targeted_re_diagnosis";
    const observedPhase = tryParsePhase(
      parsed.targetPhase || parsed.summary?.targetPhase || parsed.startingPhase || parsed.phase,
    );
    const statePhaseBefore = tryParsePhase(
      parsed.resumePhase || parsed.summary?.resumePhase || parsed.statePhaseBefore || parsed.phase,
    );
    const statePhaseAfter = tryParsePhase(
      parsed.summary?.resultingPhase || parsed.summary?.phase || statePhaseBefore,
    );
    if (!observedPhase || !statePhaseBefore || !statePhaseAfter) {
      return {
        ok: false,
        issue: { code: "missing_identity", message: "Inherited verification drill is missing a valid phase" },
      };
    }
    return {
      ok: true,
      input: {
        sourceDrillId,
        studentId,
        tutorId,
        topic: cleanString(parsed.trainingTopic || parsed.inheritedTopic || parsed.introTopic),
        scheduledSessionId,
        trainingSessionRunId,
        sessionGroupId: cleanString(scheduledSessionId || trainingSessionRunId || sourceDrillId),
        sessionContext: "active_training",
        drillType: isTargetedRediagnosis ? "diagnosis" : "verification",
        observedPhase,
        statePhaseBefore,
        stabilityBefore: normalizeStability(
          parsed.resumeStability || parsed.summary?.resumeStability || parsed.previousStability || "Low",
        ),
        statePhaseAfter,
        stabilityAfter: normalizeStability(
          parsed.summary?.resultingStability || parsed.summary?.stability || "Low",
        ),
        transitionReason: cleanString(
          parsed.summary?.verificationOutcome || parsed.summary?.transitionReason,
        ) || null,
        observedAt,
        sets,
      },
    };
  }

'''
replace_once(
    "server/responseIntegrityEvidenceLedger.ts",
    ledger_anchor,
    ledger_branch + ledger_anchor,
)

append_once(
    "server/responseIntegrityEvidenceLedger.test.ts",
    'test("stored handover verification rows build projection input as verification evidence"',
    '''

test("stored inherited verification rows build active-training verification lineage", () => {
  const input = buildProjectionInput();
  const row = {
    id: input.sourceDrillId,
    student_id: input.studentId,
    tutor_id: input.tutorId,
    scheduled_session_id: input.scheduledSessionId,
    training_session_run_id: "66666666-6666-4666-8666-666666666666",
    submitted_at: input.observedAt,
    drill: {
      trainingTopic: input.topic,
      targetPhase: "Clarity",
      resumePhase: "Controlled Discomfort",
      resumeStability: "High Maintenance",
      drillType: "inherited_verification",
      inheritedVerificationMode: "verification",
      sets: input.sets,
      summary: {
        targetPhase: "Clarity",
        resumePhase: "Controlled Discomfort",
        resumeStability: "High Maintenance",
        resultingPhase: "Controlled Discomfort",
        resultingStability: "High Maintenance",
        verificationOutcome: "verification_cleared",
      },
    },
  };

  const result = buildEvidenceLedgerProjectionInputFromStoredDrillRow(row);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.input.sessionContext, "active_training");
  assert.equal(result.input.drillType, "verification");
  assert.equal(result.input.observedPhase, "Clarity");
  assert.equal(result.input.statePhaseBefore, "Controlled Discomfort");
  assert.equal(result.input.stabilityBefore, "High Maintenance");
  assert.equal(result.input.trainingSessionRunId, "66666666-6666-4666-8666-666666666666");
});

test("stored inherited targeted re-diagnosis rows project as diagnosis evidence", () => {
  const input = buildProjectionInput();
  const row = {
    id: input.sourceDrillId,
    student_id: input.studentId,
    tutor_id: input.tutorId,
    scheduled_session_id: input.scheduledSessionId,
    training_session_run_id: "77777777-7777-4777-8777-777777777777",
    submitted_at: input.observedAt,
    drill: {
      trainingTopic: input.topic,
      targetPhase: "Structured Execution",
      resumePhase: "Time Pressure Stability",
      resumeStability: "High",
      drillType: "inherited_verification",
      inheritedVerificationMode: "targeted_re_diagnosis",
      sets: input.sets,
      summary: {
        targetPhase: "Structured Execution",
        resultingPhase: "Controlled Discomfort",
        resultingStability: "Low",
        verificationOutcome: "targeted_re_diagnosis_completed",
      },
    },
  };

  const result = buildEvidenceLedgerProjectionInputFromStoredDrillRow(row);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.input.sessionContext, "active_training");
  assert.equal(result.input.drillType, "diagnosis");
  assert.equal(result.input.observedPhase, "Structured Execution");
  assert.equal(result.input.statePhaseAfter, "Controlled Discomfort");
});
''',
)

# ---------------------------------------------------------------------------
# Server route: dedicated inherited-layer verification flow using the existing
# scheduled training lesson, evidence registry, immutable drill store, ledger,
# and deterministic reporting pipeline.
# ---------------------------------------------------------------------------
replace_once(
    "server/routes.ts",
    '''import {
  applyInheritedVerificationGate,
} from "@shared/inheritedLayerVerification";''',
    '''import {
  applyInheritedVerificationGate,
  resolveInheritedVerification,
  type InheritedVerificationHold,
} from "@shared/inheritedLayerVerification";''',
)

route_anchor = '''          app.post("/api/tutor/training-session-drill", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {'''
route_code = r'''          app.post("/api/tutor/inherited-layer-verification-drill", isAuthenticated, requireRole(["tutor"]), async (req: Request, res: Response) => {
            let emergencyDbClient: any = null;
            try {
              const tutorId = (req as any).dbUser.id;
              const {
                studentId,
                trainingTopic,
                drill,
                adaptiveBlocks: rawAdaptiveBlocks,
                scheduledSessionId,
                rediagnosis,
              } = req.body;
              const normalizedTopic = String(trainingTopic || "").trim();

              if (!studentId || !normalizedTopic) {
                return res.status(400).json({ message: "Student and inherited-verification topic are required." });
              }

              const student = await storage.getStudent(studentId);
              if (!student || String(student.tutorId || "") !== String(tutorId)) {
                return res.status(403).json({ message: "Unauthorized: Student does not belong to this tutor" });
              }

              const assignmentAccepted = await isTutorAssignmentAcceptedForStudent(student, tutorId);
              if (!assignmentAccepted) {
                return res.status(403).json({ message: "Accept this assignment before running inherited-layer verification." });
              }

              const conceptMastery: any =
                student.conceptMastery && typeof student.conceptMastery === "object"
                  ? { ...(student.conceptMastery as any) }
                  : {};
              const topicConditioningStore: any =
                conceptMastery.topicConditioning && typeof conceptMastery.topicConditioning === "object"
                  ? { ...conceptMastery.topicConditioning }
                  : {};
              const topicsStore: Record<string, any> =
                topicConditioningStore.topics && typeof topicConditioningStore.topics === "object"
                  ? { ...topicConditioningStore.topics }
                  : {};
              const topicKey = Object.keys(topicsStore).find(
                (candidate) => candidate.trim().toLowerCase() === normalizedTopic.toLowerCase(),
              );
              const existingTopic = topicKey && topicsStore[topicKey] && typeof topicsStore[topicKey] === "object"
                ? topicsStore[topicKey]
                : null;
              const hold = existingTopic?.inheritedVerificationHold as InheritedVerificationHold | null | undefined;

              if (!existingTopic || hold?.kind !== "inherited_verification_required") {
                return res.status(400).json({ message: "This topic does not currently require inherited-layer verification." });
              }

              const targetPhase = parseAuthoritativePhase(hold.targetPhase);
              const resumePhase = parseAuthoritativePhase(hold.resumePhase || existingTopic.phase);
              const resumeStability = normalizeStability(hold.resumeStability || existingTopic.stability || "Low");
              if (!targetPhase || !resumePhase) {
                return res.status(400).json({ message: "Inherited verification hold is missing an authoritative phase." });
              }

              const isTargetedRediagnosis = !!rediagnosis;
              if (hold.status === "verification_required" && isTargetedRediagnosis) {
                return res.status(400).json({ message: "Run the inherited-layer verification block before targeted re-diagnosis." });
              }
              if (hold.status === "targeted_re_diagnosis_required" && !isTargetedRediagnosis) {
                return res.status(400).json({ message: "This hold now requires targeted adaptive re-diagnosis from the earlier layer." });
              }

              const operationalMode = await getTutorOperationalMode(tutorId);
              const { session: scheduledSession, error: scheduledSessionError } = await resolveTutorScheduledSession(
                tutorId,
                studentId,
                "training",
                typeof scheduledSessionId === "string" ? scheduledSessionId : null,
              );
              if (scheduledSessionError) {
                return res.status(500).json({ message: "Failed to validate inherited-verification lesson context." });
              }
              if (!scheduledSession) {
                return res.status(400).json({ message: "A Response Integrity training lesson must be attached before inherited-layer verification." });
              }

              if (operationalMode === "training" || operationalMode === "sandbox") {
                const status = String(scheduledSession.status || "").trim();
                const hasConfirmedSchedule =
                  ["confirmed", "ready", "live"].includes(status) &&
                  !!scheduledSession.parent_confirmed &&
                  !!scheduledSession.tutor_confirmed;
                if (!hasConfirmedSchedule) {
                  return res.status(400).json({ message: "Inherited-layer verification must run inside a tutor-confirmed Response Integrity training lesson." });
                }
              } else if (isLiveSchedulingMode(operationalMode)) {
                const launch = getSessionLaunchState(scheduledSession, "training");
                if (!launch.canLaunch) {
                  return res.status(400).json({ message: "Inherited-layer verification must run inside an active or imminently scheduled training lesson." });
                }
              }

              const verificationBlocks = isTargetedRediagnosis
                ? normalizeAdaptiveDiagnosisBlocks(rawAdaptiveBlocks)
                : normalizeAdaptiveDiagnosisBlocks(
                    Array.isArray(drill)
                      ? drill.map((set: any) => ({ ...set, phase: targetPhase }))
                      : [],
                  );

              if (verificationBlocks.length === 0) {
                return res.status(400).json({ message: "Inherited-layer verification evidence is required." });
              }
              if (!isTargetedRediagnosis && verificationBlocks.length !== 1) {
                return res.status(400).json({ message: "Inherited-layer verification must submit exactly one verification block." });
              }

              const validationError = isTargetedRediagnosis
                ? validateAdaptiveDiagnosisBlocks(verificationBlocks, "diagnosis")
                : validateAdaptiveDiagnosisBlocks(verificationBlocks, "verification");
              if (validationError) {
                return res.status(400).json({ message: validationError });
              }

              let verificationSummary: any;
              let scoring: any[];
              let resultingHold: InheritedVerificationHold | null = null;

              if (isTargetedRediagnosis) {
                const diagnosisSummary = computeAdaptiveDiagnosisSummary(targetPhase, verificationBlocks);
                const adaptivePathError = validateAdaptiveDiagnosisPath(targetPhase, diagnosisSummary);
                if (adaptivePathError) {
                  return res.status(400).json({ message: adaptivePathError });
                }
                const resultingStability = normalizeStability(diagnosisSummary.stability || "Low");
                verificationSummary = {
                  targetPhase,
                  resumePhase,
                  resumeStability,
                  verificationScore: Number(diagnosisSummary.diagnosisScore || 0),
                  verificationOutcome: "targeted_re_diagnosis_completed",
                  verificationOutcomeLabel: "Targeted re-diagnosis completed",
                  resultingPhase: diagnosisSummary.phase,
                  resultingStability,
                  reDiagnosisRequired: false,
                  freshCurrentPhaseEvidenceRequired: false,
                  nextAction: diagnosisSummary.nextAction || null,
                  constraint: diagnosisSummary.constraint || null,
                  startingPhase: diagnosisSummary.startingPhase,
                  pathLength: diagnosisSummary.pathLength,
                  phaseChecks: diagnosisSummary.phaseChecks,
                  finalBand: diagnosisSummary.finalBand,
                  finalBandLabel: diagnosisSummary.finalBandLabel,
                  repRows: diagnosisSummary.phaseChecks.flatMap((check: any) => check.repRows),
                };
                scoring = diagnosisSummary.phaseChecks.flatMap((check: any) =>
                  check.repRows.map((row: any) => ({
                    set: check.setName,
                    rep: row.rep,
                    score: row.repScore,
                    setScore: check.phaseScore,
                    setPoints: check.phaseScore,
                    setMaxPoints: 100,
                    sessionScore: diagnosisSummary.diagnosisScore,
                    phase: check.phase,
                    stability: resultingStability,
                    verificationOutcome: "targeted_re_diagnosis_completed",
                    nextAction: diagnosisSummary.nextAction || null,
                    constraint: diagnosisSummary.constraint || null,
                  })),
                );
              } else {
                const phaseSummary = computeAdaptiveDiagnosisPhaseSummary(
                  targetPhase,
                  verificationBlocks[0].observations,
                );
                const resolution = resolveInheritedVerification(hold, phaseSummary.phaseScore);
                if (!resolution.holdCleared) {
                  resultingHold = {
                    ...hold,
                    status: "targeted_re_diagnosis_required",
                    freshCurrentPhaseEvidenceRequired: false,
                  };
                }
                const outcomeLabel =
                  resolution.outcome === "verification_cleared"
                    ? "Earlier layer verified"
                    : resolution.outcome === "regress_to_earlier_phase"
                      ? "Earlier-layer regression confirmed"
                      : "Targeted re-diagnosis required";
                const nextAction =
                  resolution.outcome === "verification_cleared"
                    ? `Return to ${resolution.resultingPhase} at ${resolution.resultingStability} and collect fresh current-phase evidence before any upward movement.`
                    : resolution.outcome === "regress_to_earlier_phase"
                      ? `Resume training in ${resolution.resultingPhase} at High.`
                      : `Run targeted adaptive re-diagnosis from ${hold.targetPhase} before normal training resumes.`;
                const constraint =
                  resolution.outcome === "verification_cleared"
                    ? "The earlier layer is cleared, but the previously withheld positive movement is not restored retroactively."
                    : resolution.outcome === "regress_to_earlier_phase"
                      ? `The material ${hold.targetPhase} break is confirmed; continue from that earlier layer.`
                      : `Normal training remains blocked until targeted re-diagnosis resolves placement from ${hold.targetPhase}.`;
                verificationSummary = {
                  targetPhase,
                  resumePhase,
                  resumeStability,
                  verificationScore: resolution.verificationScore,
                  verificationOutcome: resolution.outcome,
                  verificationOutcomeLabel: outcomeLabel,
                  resultingPhase: resolution.resultingPhase,
                  resultingStability: resolution.resultingStability,
                  reDiagnosisRequired: resolution.outcome === "targeted_re_diagnosis_required",
                  freshCurrentPhaseEvidenceRequired: resolution.freshCurrentPhaseEvidenceRequired,
                  targetedRediagnosisStartingPhase: resolution.targetedRediagnosisStartingPhase,
                  nextAction,
                  constraint,
                  repRows: phaseSummary.repRows,
                  phaseChecks: [{
                    phase: targetPhase,
                    setName: verificationBlocks[0].setName,
                    phaseScore: phaseSummary.phaseScore,
                    repRows: phaseSummary.repRows,
                  }],
                };
                scoring = phaseSummary.repRows.map((row: any) => ({
                  set: verificationBlocks[0].setName,
                  rep: row.rep,
                  score: row.repScore,
                  setScore: phaseSummary.phaseScore,
                  setPoints: phaseSummary.phaseScore,
                  setMaxPoints: 100,
                  sessionScore: phaseSummary.phaseScore,
                  phase: targetPhase,
                  stability: resolution.resultingStability,
                  verificationOutcome: resolution.outcome,
                  verificationOutcomeLabel: outcomeLabel,
                  reDiagnosisRequired: resolution.outcome === "targeted_re_diagnosis_required",
                  nextAction,
                  constraint,
                }));
              }

              const verificationRunId = uuidv4();
              const drillId = uuidv4();
              const submittedAt = new Date().toISOString();
              const scheduledSessionRecordId = scheduledSession.id || null;
              const responseSnapshot = buildResponseSnapshotV1({
                sourceDrillId: drillId,
                topic: normalizedTopic,
                mode: isTargetedRediagnosis ? "inherited_rediagnosis" : "inherited_verification",
                phase: targetPhase,
                sets: verificationBlocks as any,
                drillScore: Number(verificationSummary.verificationScore || 0),
                setScores: isTargetedRediagnosis
                  ? (verificationSummary.phaseChecks || []).map((check: any) => Number(check.phaseScore || 0))
                  : [Number(verificationSummary.verificationScore || 0)],
                engineOutcomeRef: {
                  phaseBefore: resumePhase,
                  stabilityBefore: resumeStability,
                  phaseAfter: verificationSummary.resultingPhase,
                  stabilityAfter: verificationSummary.resultingStability,
                  transitionReason: verificationSummary.verificationOutcome,
                },
              });
              const drillPayload = {
                trainingTopic: normalizedTopic,
                targetPhase,
                resumePhase,
                resumeStability,
                drillType: "inherited_verification",
                inheritedVerificationMode: isTargetedRediagnosis ? "targeted_re_diagnosis" : "verification",
                scheduledSessionId: scheduledSessionRecordId,
                sessionId: verificationRunId,
                sets: verificationBlocks,
                summary: verificationSummary,
                responseSnapshot,
              };

              emergencyDbClient = isEmergencyDbMode() ? await pool.connect() : null;
              if (emergencyDbClient) await emergencyDbClient.query("BEGIN");

              const trainingRun = isEmergencyDbMode()
                ? (await emergencyDbClient!.query(
                    `INSERT INTO public.training_session_runs
                      (id, scheduled_session_id, student_id, tutor_id, topic_count, started_at, status, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, 1, $5, 'in_progress', $5, $5)
                     RETURNING *`,
                    [verificationRunId, scheduledSessionRecordId, studentId, tutorId, submittedAt],
                  )).rows[0]
                : (await supabase
                    .from("training_session_runs")
                    .insert({
                      id: verificationRunId,
                      scheduled_session_id: scheduledSessionRecordId,
                      student_id: studentId,
                      tutor_id: tutorId,
                      topic_count: 1,
                      started_at: submittedAt,
                      status: "in_progress",
                      created_at: submittedAt,
                      updated_at: submittedAt,
                    })
                    .select()
                    .single()).data;

              if (!trainingRun) {
                throw new Error("Failed to create inherited-verification training run.");
              }

              const inserted = isEmergencyDbMode()
                ? (await emergencyDbClient!.query(
                    `INSERT INTO public.intro_session_drills
                      (id, student_id, tutor_id, drill, scheduled_session_id, training_session_run_id, submitted_at)
                     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
                     RETURNING *`,
                    [drillId, studentId, tutorId, JSON.stringify(drillPayload), scheduledSessionRecordId, verificationRunId, submittedAt],
                  )).rows[0]
                : (await supabase
                    .from("intro_session_drills")
                    .insert({
                      id: drillId,
                      student_id: studentId,
                      tutor_id: tutorId,
                      drill: JSON.stringify(drillPayload),
                      scheduled_session_id: scheduledSessionRecordId,
                      training_session_run_id: verificationRunId,
                      submitted_at: submittedAt,
                    })
                    .select()
                    .single()).data;
              if (!inserted) {
                throw new Error("Failed to store inherited-layer verification evidence.");
              }

              const ledgerInput: EvidenceLedgerProjectionInput = {
                sourceDrillId: String(inserted.id || drillId),
                studentId: String(studentId),
                tutorId: String(tutorId),
                topic: normalizedTopic,
                scheduledSessionId: String(scheduledSessionRecordId || "") || null,
                trainingSessionRunId: verificationRunId,
                sessionGroupId: String(scheduledSessionRecordId || verificationRunId),
                sessionContext: "active_training",
                drillType: isTargetedRediagnosis ? "diagnosis" : "verification",
                observedPhase: targetPhase,
                statePhaseBefore: resumePhase,
                stabilityBefore: resumeStability,
                statePhaseAfter: verificationSummary.resultingPhase,
                stabilityAfter: verificationSummary.resultingStability,
                transitionReason: verificationSummary.verificationOutcome,
                observedAt: String(inserted.submitted_at || submittedAt),
                sets: verificationBlocks as any,
              };

              const existingHistory = Array.isArray(existingTopic.history) ? [...existingTopic.history] : [];
              const updatedEntry = {
                ...existingTopic,
                topic: normalizedTopic,
                phase: verificationSummary.resultingPhase,
                stability: verificationSummary.resultingStability,
                inheritedVerificationHold: resultingHold,
                freshCurrentPhaseEvidenceRequired: !!verificationSummary.freshCurrentPhaseEvidenceRequired,
                lastUpdated: submittedAt,
                nextAction: verificationSummary.nextAction,
                observationNotes: [
                  `Inherited Verification Score: ${verificationSummary.verificationScore}`,
                  `Outcome: ${verificationSummary.verificationOutcomeLabel}`,
                  verificationSummary.constraint ? `Constraint: ${verificationSummary.constraint}` : null,
                ].filter(Boolean).join(" | "),
                history: [
                  ...existingHistory,
                  {
                    date: submittedAt,
                    phase: verificationSummary.resultingPhase,
                    stability: verificationSummary.resultingStability,
                    nextAction: verificationSummary.nextAction,
                    observationNotes: `Inherited-layer verification update. Score ${verificationSummary.verificationScore}.`,
                    structuredObservation: {
                      drillType: "inherited_verification",
                      inheritedVerificationMode: isTargetedRediagnosis ? "targeted_re_diagnosis" : "verification",
                      targetPhase,
                      resumePhase,
                      resumeStability,
                      verificationScore: verificationSummary.verificationScore,
                      verificationOutcome: verificationSummary.verificationOutcome,
                      verificationOutcomeLabel: verificationSummary.verificationOutcomeLabel,
                      resultingPhase: verificationSummary.resultingPhase,
                      resultingStability: verificationSummary.resultingStability,
                      reDiagnosisRequired: verificationSummary.reDiagnosisRequired,
                      freshCurrentPhaseEvidenceRequired: verificationSummary.freshCurrentPhaseEvidenceRequired,
                      nextAction: verificationSummary.nextAction,
                      constraint: verificationSummary.constraint,
                    },
                    drillId: inserted.id,
                    sessionId: verificationRunId,
                  },
                ].slice(-60),
              };
              topicsStore[topicKey || normalizedTopic] = updatedEntry;
              topicConditioningStore.topics = topicsStore;
              topicConditioningStore.lastUpdatedAt = submittedAt;
              conceptMastery.topicConditioning = topicConditioningStore;

              if (isEmergencyDbMode()) {
                await emergencyDbClient!.query(
                  `UPDATE public.students
                      SET concept_mastery = $1
                    WHERE id = $2 AND tutor_id = $3`,
                  [JSON.stringify(conceptMastery), studentId, tutorId],
                );
                await emergencyDbClient!.query(
                  `UPDATE public.scheduled_sessions
                      SET status = 'completed', attendance_status = 'both_joined',
                          recording_status = 'manual_not_tracked', transcript_status = 'manual_not_tracked', updated_at = NOW()
                    WHERE id = $1 AND tutor_id = $2 AND student_id = $3`,
                  [scheduledSessionRecordId, tutorId, studentId],
                );
                await emergencyDbClient!.query(
                  `UPDATE public.training_session_runs
                      SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
                    WHERE id = $1 AND student_id = $2 AND tutor_id = $3`,
                  [verificationRunId, studentId, tutorId],
                );
                await emergencyDbClient!.query("COMMIT");
                emergencyDbClient.release();
                emergencyDbClient = null;
                const projection = await persistEvidenceLedgerShadow(ledgerInput);
                if (projection.status === "persistence_failed" || projection.status === "projection_invalid") {
                  console.warn("[RI_EVIDENCE_LEDGER_SHADOW_DEGRADED]", {
                    sourceDrillId: ledgerInput.sourceDrillId,
                    sessionGroupId: ledgerInput.sessionGroupId,
                    status: projection.status,
                  });
                }
              } else {
                await persistEvidenceLedgerShadow(ledgerInput);
                await storage.updateStudent(studentId, { conceptMastery });
                await supabase
                  .from("scheduled_sessions")
                  .update({
                    status: "completed",
                    attendance_status: "both_joined",
                    recording_status: "manual_not_tracked",
                    transcript_status: "manual_not_tracked",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", scheduledSessionRecordId);
                await supabase
                  .from("training_session_runs")
                  .update({
                    status: "submitted",
                    submitted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", verificationRunId);
                try {
                  await maybeAutoSendDeterministicReports(studentId, tutorId);
                } catch (autoReportError) {
                  console.error("Auto report generation failed after inherited-layer verification:", autoReportError);
                }
              }

              res.json({
                success: true,
                id: inserted.id,
                trainingTopic: normalizedTopic,
                summary: verificationSummary,
                scoring,
                responseSnapshot,
              });
            } catch (err) {
              if (emergencyDbClient) {
                try {
                  await emergencyDbClient.query("ROLLBACK");
                } finally {
                  emergencyDbClient.release();
                  emergencyDbClient = null;
                }
              }
              console.error("Exception in inherited-layer verification submission:", err);
              res.status(500).json({ message: "Internal server error" });
            }
          });

'''
replace_once("server/routes.ts", route_anchor, route_code + route_anchor)

# ---------------------------------------------------------------------------
# Runner: first-class inherited verification mode and endpoint.
# ---------------------------------------------------------------------------
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''type DrillMode = "diagnosis" | "training" | "session" | "handover";''',
    '''type DrillMode = "diagnosis" | "training" | "session" | "handover" | "inherited-verification";''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''function buildDrillStructure(mode: DrillMode, phase: PhaseLabel) {
  if (mode === "training") {
    return TRAINING_SETS_BY_PHASE[phase];
  }
  if (mode === "handover") {
    return [ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE[phase]];
  }
  return DIAGNOSIS_SETS_BY_PHASE[phase];
}''',
    '''function buildDrillStructure(mode: DrillMode, phase: PhaseLabel) {
  if (mode === "training") {
    return TRAINING_SETS_BY_PHASE[phase];
  }
  if (mode === "handover" || mode === "inherited-verification") {
    return [ADAPTIVE_DIAGNOSIS_BLOCK_BY_PHASE[phase]];
  }
  return DIAGNOSIS_SETS_BY_PHASE[phase];
}''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''  mode: "diagnosis" | "handover" | "handover_rediagnosis"
): VerificationPrepSpec {''',
    '''  mode: "diagnosis" | "handover" | "handover_rediagnosis" | "inherited_verification" | "inherited_rediagnosis"
): VerificationPrepSpec {''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''  if (mode === "handover") {
    return {
      title: "Handover Prep",
      objective: `Verify whether the inherited ${phase} topic-state is still trustworthy. ${phasePurpose}`,
      problemPlan: `Prepare exactly ${diagnosisBlock.reps} clean verification problems at the inherited ${phase} level. Keep the same phase target, but do not open the full training drill.`,
      tutorRules: [
        ...verificationRules,
        ...phaseRules,
        "Do not reteach from scratch.",
        "Do not progress the student during verification.",
      ],
      derivedFrom: `Derived from the ${phase} training lane and reduced to the ${diagnosisBlock.setName} continuity-check block. Training reference: ${trainingReference}.`,
      checklist: [
        `I reviewed the inherited ${phase} / ${phase === "Clarity" ? "concept-entry" : "response-state"} before starting.`,
        `I prepared exactly ${diagnosisBlock.reps} clean ${phase} verification problems.`,
        "I will verify continuity only and will not restart or train forward.",
      ],
    };
  }''',
    '''  if (mode === "handover" || mode === "inherited_verification") {
    const inheritedLayer = mode === "inherited_verification";
    return {
      title: inheritedLayer ? "Earlier-Layer Verification Prep" : "Handover Prep",
      objective: inheritedLayer
        ? `Verify whether the earlier ${phase} layer still holds before positive movement can resume. ${phasePurpose}`
        : `Verify whether the inherited ${phase} topic-state is still trustworthy. ${phasePurpose}`,
      problemPlan: `Prepare exactly ${diagnosisBlock.reps} clean verification problems at the ${phase} level. Keep the same phase target, but do not open the full training drill.`,
      tutorRules: [
        ...verificationRules,
        ...phaseRules,
        inheritedLayer ? "Verify the flagged earlier layer only; the system owns the resulting topic state." : "Do not reteach from scratch.",
        "Do not progress the student manually during verification.",
      ],
      derivedFrom: `Derived from the ${phase} training lane and reduced to the ${diagnosisBlock.setName} verification block. Training reference: ${trainingReference}.`,
      checklist: [
        inheritedLayer
          ? `I prepared exactly ${diagnosisBlock.reps} clean ${phase} earlier-layer verification problems.`
          : `I reviewed the inherited ${phase} / ${phase === "Clarity" ? "concept-entry" : "response-state"} before starting.`,
        `I prepared exactly ${diagnosisBlock.reps} clean ${phase} verification problems.`,
        inheritedLayer
          ? "I will record what happens and let RI-OS decide clear, regression, or targeted re-diagnosis."
          : "I will verify continuity only and will not restart or train forward.",
      ],
    };
  }''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''  const requestedContext = searchParams.get("context");
  const handoverReDiagnosisMode = requestedMode === "handover" && searchParams.get("rediagnosis") === "1";
  const drillMode: DrillMode =
    requestedMode === "training"
      ? "training"
      : requestedMode === "session"
        ? "session"
        : requestedMode === "handover"
          ? "handover"
          : "diagnosis";''',
    '''  const requestedContext = searchParams.get("context");
  const handoverReDiagnosisMode = requestedMode === "handover" && searchParams.get("rediagnosis") === "1";
  const inheritedReDiagnosisMode = requestedMode === "inherited-verification" && searchParams.get("rediagnosis") === "1";
  const drillMode: DrillMode =
    requestedMode === "training"
      ? "training"
      : requestedMode === "session"
        ? "session"
        : requestedMode === "handover"
          ? "handover"
          : requestedMode === "inherited-verification"
            ? "inherited-verification"
            : "diagnosis";''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''    enabled: (drillMode === "training" || isSessionMode) && !!studentId,''',
    '''    enabled: (drillMode === "training" || drillMode === "inherited-verification" || isSessionMode) && !!studentId,''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''  }, [drillMode, handoverReDiagnosisMode, currentTopicName, activeDiagnosisPhase, studentId]);''',
    '''  }, [drillMode, handoverReDiagnosisMode, inheritedReDiagnosisMode, currentTopicName, activeDiagnosisPhase, studentId]);''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''  const isAdaptiveDiagnosisMode = modeToUse === "diagnosis";
  const isHandoverMode = modeToUse === "handover";
  const isAdaptiveVerificationFlow = isAdaptiveDiagnosisMode || (isHandoverMode && handoverReDiagnosisMode);
  const evidenceModeForSubmission: EvidenceDrillMode =
    isHandoverMode && !handoverReDiagnosisMode
      ? "verification"
      : modeToUse === "training"
        ? "training"
        : "diagnosis";''',
    '''  const isAdaptiveDiagnosisMode = modeToUse === "diagnosis";
  const isHandoverMode = modeToUse === "handover";
  const isInheritedVerificationMode = modeToUse === "inherited-verification";
  const isAdaptiveVerificationFlow =
    isAdaptiveDiagnosisMode ||
    (isHandoverMode && handoverReDiagnosisMode) ||
    (isInheritedVerificationMode && inheritedReDiagnosisMode);
  const evidenceModeForSubmission: EvidenceDrillMode =
    (isHandoverMode && !handoverReDiagnosisMode) ||
    (isInheritedVerificationMode && !inheritedReDiagnosisMode)
      ? "verification"
      : modeToUse === "training"
        ? "training"
        : "diagnosis";''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''        isAdaptiveDiagnosisMode
          ? "diagnosis"
          : handoverReDiagnosisMode
            ? "handover_rediagnosis"
            : "handover"
      ),
    [displayPhase, isAdaptiveDiagnosisMode, handoverReDiagnosisMode]
  );''',
    '''        isAdaptiveDiagnosisMode
          ? "diagnosis"
          : isInheritedVerificationMode
            ? inheritedReDiagnosisMode
              ? "inherited_rediagnosis"
              : "inherited_verification"
            : handoverReDiagnosisMode
              ? "handover_rediagnosis"
              : "handover"
      ),
    [displayPhase, isAdaptiveDiagnosisMode, isInheritedVerificationMode, inheritedReDiagnosisMode, handoverReDiagnosisMode]
  );''',
)

# Adaptive final submit: diagnosis, handover re-diagnosis, or inherited-layer re-diagnosis.
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''        const payload = isHandoverMode
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
            };''',
    '''        const payload = isHandoverMode
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
          : isInheritedVerificationMode
            ? {
                studentId,
                trainingTopic: introTopic,
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
              };''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''        const adaptiveEndpoint = isHandoverMode ? "/api/tutor/handover-verification-drill" : "/api/tutor/intro-session-drill";''',
    '''        const adaptiveEndpoint = isHandoverMode
          ? "/api/tutor/handover-verification-drill"
          : isInheritedVerificationMode
            ? "/api/tutor/inherited-layer-verification-drill"
            : "/api/tutor/intro-session-drill";''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''        setAdaptiveDiagnosisMessage(
          isHandoverMode
            ? `${phaseSummary.phaseScore}/100 in ${activeDiagnosisPhase}. Targeted re-diagnosis resolved to ${res.data?.summary?.resultingPhase || activeDiagnosisPhase}.`
            : `${phaseSummary.phaseScore}/100 in ${activeDiagnosisPhase}. Diagnosis locked at ${res.data?.summary?.phase || activeDiagnosisPhase}.`
        );''',
    '''        setAdaptiveDiagnosisMessage(
          isHandoverMode
            ? `${phaseSummary.phaseScore}/100 in ${activeDiagnosisPhase}. Targeted re-diagnosis resolved to ${res.data?.summary?.resultingPhase || activeDiagnosisPhase}.`
            : isInheritedVerificationMode
              ? `${phaseSummary.phaseScore}/100 in ${activeDiagnosisPhase}. Earlier-layer re-diagnosis resolved to ${res.data?.summary?.resultingPhase || activeDiagnosisPhase}.`
              : `${phaseSummary.phaseScore}/100 in ${activeDiagnosisPhase}. Diagnosis locked at ${res.data?.summary?.phase || activeDiagnosisPhase}.`
        );''',
)

# Non-adaptive final submit: dedicated inherited verification endpoint.
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''        const endpoint = isHandoverMode
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
            };''',
    '''        const endpoint = isHandoverMode
          ? "/api/tutor/handover-verification-drill"
          : isInheritedVerificationMode
            ? "/api/tutor/inherited-layer-verification-drill"
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
          : isInheritedVerificationMode
            ? {
                studentId,
                drill: currentDrill.drill,
                trainingTopic: currentDrill.trainingTopic,
                scheduledSessionId,
                rediagnosis: false,
              }
            : {
                studentId,
                sessionDrills: allDrills,
                scheduledSessionId,
              };''',
)

# Training-assignment UI gates also apply to inherited-layer verification.
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''      {(drillMode === "training" || isSessionMode) && workflowLoading && (''',
    '''      {(drillMode === "training" || drillMode === "inherited-verification" || isSessionMode) && workflowLoading && (''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''      {(drillMode === "training" || isSessionMode) && !workflowLoading && !assignmentAccepted && (''',
    '''      {(drillMode === "training" || drillMode === "inherited-verification" || isSessionMode) && !workflowLoading && !assignmentAccepted && (''',
)
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    '''      {!drillSessionAccessLoading && canUseScheduledSession && !((drillMode === "training" || isSessionMode) && !workflowLoading && !assignmentAccepted) && (''',
    '''      {!drillSessionAccessLoading && canUseScheduledSession && !((drillMode === "training" || drillMode === "inherited-verification" || isSessionMode) && !workflowLoading && !assignmentAccepted) && (''',
)

# Dedicated instructions make the system-owned consequence explicit.
instruction_anchor = '''      {/* Phase-level context bar -shown only on set 1 */}'''
inherited_instructions = '''      {drillMode === "inherited-verification" && showModeInstructions && (
        <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="font-semibold">Earlier-Layer Verification</p>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowModeInstructions(false)}
            >
              Dismiss
            </button>
          </div>
          <ul className="list-disc pl-5 text-sm text-foreground/90 space-y-1">
            <li>{inheritedReDiagnosisMode ? "This is targeted adaptive re-diagnosis from the flagged earlier layer." : "This is verification of a material earlier-layer break observed during later-phase work."}</li>
            <li>Run the system-provided block exactly as shown. Do not turn this into normal training.</li>
            <li>The Specialist records evidence only; RI-OS decides whether the hold clears, the topic regresses, or deeper re-diagnosis is required.</li>
            <li>A cleared hold never restores a previously withheld upward transition. Fresh current-phase evidence is required.</li>
          </ul>
        </div>
      )}

'''
replace_once(
    "client/src/components/tutor/IntroSessionDrillRunner.tsx",
    instruction_anchor,
    inherited_instructions + instruction_anchor,
)

print("Inherited verification stage 2 patch applied")
