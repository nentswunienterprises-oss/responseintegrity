from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing {label}")
    return text.replace(old, new, 1)


# Ensure report regeneration sees the full student history, while topic-state replay remains topic-scoped.
path = Path("server/routes/responseIntegrityEvidenceCorrectionRuntime.ts")
text = path.read_text()
text = replace_once(
    text,
    '''const loadTopicDrillRows = async (studentId: string, topic: string): Promise<EffectiveCorrectionDrillRow[]> => {
  const { data, error } = await supabase
    .from("intro_session_drills")
    .select("id, student_id, tutor_id, submitted_at, scheduled_session_id, training_session_run_id, drill")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: true })
    .limit(2000);
  if (error) throw new Error(`Failed to load topic lineage: ${error.message}`);
  return (data || [])
    .map((row: any) => ({ ...row, drill: parseDrill(row.drill) }))
    .filter((row: any) => row.drill && topicKey(drillTopic(row.drill)) === topicKey(topic)) as EffectiveCorrectionDrillRow[];
};''',
    '''const loadStudentDrillRows = async (studentId: string): Promise<EffectiveCorrectionDrillRow[]> => {
  const { data, error } = await supabase
    .from("intro_session_drills")
    .select("id, student_id, tutor_id, submitted_at, scheduled_session_id, training_session_run_id, drill")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: true })
    .limit(2000);
  if (error) throw new Error(`Failed to load student drill lineage: ${error.message}`);
  return (data || [])
    .map((row: any) => ({ ...row, drill: parseDrill(row.drill) }))
    .filter((row: any) => !!row.drill) as EffectiveCorrectionDrillRow[];
};''',
    "student drill loader",
)
text = replace_once(
    text,
    '''  const rows = await loadTopicDrillRows(correction.student_id, correction.topic);
  const sourceIndex = rows.findIndex((row) => row.id === correction.source_drill_id);''',
    '''  const allRows = await loadStudentDrillRows(correction.student_id);
  const rows = allRows.filter((row) => topicKey(drillTopic(row.drill)) === topicKey(correction.topic));
  const sourceIndex = rows.findIndex((row) => row.id === correction.source_drill_id);''',
    "topic replay selection",
)
text = replace_once(
    text,
    '''  return { rows, replayRows, events, sourceRow: rows[sourceIndex] };''',
    '''  return { rows: allRows, replayRows, events, sourceRow: rows[sourceIndex] };''',
    "full history return",
)
text = text.replace(
    '''  if (drillType === "inherited_verification") return "inherited_verification";''',
    '''  if (drillType === "inherited_verification" || drill.inheritedVerification === true || clean(drill.inheritedVerificationMode)) return "inherited_verification";''',
    1,
)
path.write_text(text)


# Make correction-invalidated Timer Contracts disappear from active lookup and rebuild when possible.
path = Path("server/routes/capabilityTpsTimerRuntime.ts")
text = path.read_text()
invalidation_helper = '''const isTimerContractInvalidated = async (contractId: string) => {
  if (!contractId) return false;
  if (isEmergencyDbMode()) {
    const result = await pool.query(
      `SELECT invalidation_id FROM public.capability_tps_timer_contract_invalidations WHERE contract_id = $1 LIMIT 1`,
      [contractId],
    );
    return result.rows.length > 0;
  }
  const { data, error } = await supabase
    .from("capability_tps_timer_contract_invalidations")
    .select("invalidation_id")
    .eq("contract_id", contractId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load TPS Timer Contract invalidation: ${error.message}`);
  return !!data;
};

'''
text = replace_once(
    text,
    "const loadLatestTimerContract = async (",
    invalidation_helper + "const loadLatestTimerContract = async (",
    "timer invalidation helper",
)
text = replace_once(
    text,
    '''    return result.rows?.[0] ? rowToContract(result.rows[0]) : null;''',
    '''    const contract = result.rows?.[0] ? rowToContract(result.rows[0]) : null;
    if (!contract) return null;
    return await isTimerContractInvalidated(contract.contractId) ? null : contract;''',
    "emergency active contract filter",
)
text = replace_once(
    text,
    '''  return data ? rowToContract(data as TimerContractRow) : null;
};

const insertTimerContract''',
    '''  const contract = data ? rowToContract(data as TimerContractRow) : null;
  if (!contract) return null;
  return await isTimerContractInvalidated(contract.contractId) ? null : contract;
};

const insertTimerContract''',
    "supabase active contract filter",
)
reconcile = '''export const reconcileTpsTimerContractAfterCorrection = async ({
  correctionId,
  student,
  studentId,
  tutorId,
  topic,
  sourceDrillId,
  effectiveDrillRows,
}: {
  correctionId: string;
  student: any;
  studentId: string;
  tutorId: string;
  topic: string;
  sourceDrillId: string;
  effectiveDrillRows: Array<{ id?: unknown; student_id?: unknown; tutor_id?: unknown; submitted_at?: unknown; drill?: unknown }>;
}) => {
  const conditioningEpochKey = deriveConditioningEpochKey(student, topic);
  const normalizedTopicKey = topicKeyFor(topic);
  const current = await loadLatestTimerContract(studentId, normalizedTopicKey, conditioningEpochKey);
  if (!current) return { status: "no_active_contract" as const };

  const sourcePrefix = `${sourceDrillId}::`;
  const baselineDependsOnSource = current.baselineSampleRecordIds.some((id) => clean(id).startsWith(sourcePrefix));
  if (!baselineDependsOnSource) return { status: "unaffected" as const, contract: current };

  const invalidationId = randomUUID();
  const invalidation = {
    invalidation_id: invalidationId,
    contract_id: current.contractId,
    correction_id: correctionId,
    student_id: studentId,
    topic,
    topic_key: normalizedTopicKey,
    conditioning_epoch_key: conditioningEpochKey,
    reason: "Approved evidence correction changed lineage used by the active TPS baseline.",
    invalidated_at: new Date().toISOString(),
  };
  if (isEmergencyDbMode()) {
    await pool.query(
      `INSERT INTO public.capability_tps_timer_contract_invalidations
        (invalidation_id, contract_id, correction_id, student_id, topic, topic_key, conditioning_epoch_key, reason, invalidated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (contract_id, correction_id) DO NOTHING`,
      [invalidation.invalidation_id, invalidation.contract_id, invalidation.correction_id, invalidation.student_id, invalidation.topic, invalidation.topic_key, invalidation.conditioning_epoch_key, invalidation.reason, invalidation.invalidated_at],
    );
  } else {
    const { error } = await supabase.from("capability_tps_timer_contract_invalidations").upsert(invalidation, {
      onConflict: "contract_id,correction_id",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`Failed to invalidate TPS Timer Contract after correction: ${error.message}`);
  }

  const runtime = buildTpsTimerRuntimeStatus({ rows: effectiveDrillRows, studentId, topic });
  if (!runtime.contract) {
    return {
      status: "pre_tps_calibration_required" as const,
      invalidatedContractId: current.contractId,
      conditioningEpochKey,
    };
  }

  const replacement = await insertTimerContract({
    contract: runtime.contract,
    conditioningEpochKey,
    tutorId,
    source: "historical_untimed",
    supersedesContractId: current.contractId,
  });
  return {
    status: "superseded" as const,
    invalidatedContractId: current.contractId,
    contract: replacement,
    conditioningEpochKey,
  };
};

'''
text = replace_once(
    text,
    "export function registerCapabilityTpsTimerRuntimeRoutes(app: Express) {",
    reconcile + "export function registerCapabilityTpsTimerRuntimeRoutes(app: Express) {",
    "timer correction reconciliation export",
)
path.write_text(text)


# Register correction runtime inside routes.ts so it can reuse canonical deterministic report builders.
path = Path("server/routes.ts")
text = path.read_text()
imports = '''import { registerResponseIntegrityEvidenceCorrectionRuntimeRoutes } from "./routes/responseIntegrityEvidenceCorrectionRuntime";
import { reconcileTpsTimerContractAfterCorrection } from "./routes/capabilityTpsTimerRuntime";
'''
if "registerResponseIntegrityEvidenceCorrectionRuntimeRoutes" not in text:
    text = imports + text

hook = '''  registerResponseIntegrityEvidenceCorrectionRuntimeRoutes(app, {
    reconcileTpsTimerContract: reconcileTpsTimerContractAfterCorrection,
    regenerateAffectedReports: async ({ correctionId, studentId, tutorId, sourceSubmittedAt, effectiveDrillRows }) => {
      const sourceDate = new Date(sourceSubmittedAt);
      const anchoredRows = await attachReportAnchorTimes(effectiveDrillRows as any[]);
      const { data: reports, error: reportError } = await supabase
        .from("parent_reports")
        .select("*")
        .eq("student_id", studentId)
        .eq("tutor_id", tutorId)
        .in("report_type", ["weekly", "monthly"])
        .order("sent_at", { ascending: true });
      if (reportError) throw reportError;
      const reportIds = (reports || []).map((report: any) => String(report.id));
      const { data: existingSupersessions, error: supersessionError } = reportIds.length
        ? await supabase
            .from("response_integrity_report_supersessions")
            .select("superseded_report_id")
            .in("superseded_report_id", reportIds)
        : { data: [] as any[], error: null as any };
      if (supersessionError) throw supersessionError;
      const alreadySuperseded = new Set((existingSupersessions || []).map((row: any) => String(row.superseded_report_id)));
      let regenerated = 0;

      for (const report of reports || []) {
        if (alreadySuperseded.has(String(report.id))) continue;
        const structured = parseStructuredReportSummary(report.summary) || {};
        const endDateText = report.report_type === "weekly" ? structured.weekEndDate : structured.monthEndDate;
        const endDate = endDateText ? new Date(`${endDateText}T23:59:59.999Z`) : new Date(report.sent_at);
        if (Number.isFinite(sourceDate.getTime()) && Number.isFinite(endDate.getTime()) && endDate < sourceDate) continue;
        const sourceSessionIds = new Set(
          (Array.isArray(structured.sourceSessionIds) ? structured.sourceSessionIds : [])
            .map((id: unknown) => String(id || "").trim())
            .filter(Boolean),
        );
        if (sourceSessionIds.size === 0) continue;
        const windowRows = anchoredRows.filter((row: any) => sourceSessionIds.has(resolveReportSessionGroupId(row)));
        if (windowRows.length === 0) continue;

        const replacementStructured = report.report_type === "weekly"
          ? createWeeklyStructuredDataFromDrills(windowRows)
          : createMonthlyStructuredDataFromDrills(windowRows);
        if (!replacementStructured) continue;
        replacementStructured.correctionReplay = {
          correctionId,
          supersedesReportId: String(report.id),
          regeneratedAt: new Date().toISOString(),
        };
        const baseWindowKey = report.report_window_key || buildDeterministicReportWindowKey(report.report_type, replacementStructured) || `${report.report_type}:${report.id}`;
        const replacementWindowKey = `${baseWindowKey}::correction:${correctionId}`;
        const parentId = String(report.parent_id || "");
        const replacement = report.report_type === "weekly"
          ? await insertDeterministicParentReport({
              tutor_id: tutorId,
              student_id: studentId,
              parent_id: parentId,
              report_type: "weekly",
              week_number: getIsoWeekNumber(new Date(replacementStructured.weekStartDate)),
              month_name: null,
              summary: JSON.stringify(replacementStructured),
              topics_learned: Array.isArray(replacementStructured.topicsWorkedOn) ? replacementStructured.topicsWorkedOn.join(", ") : "",
              strengths: Array.isArray(replacementStructured.whatChanged) ? replacementStructured.whatChanged.join(" | ") : "",
              areas_for_growth: Array.isArray(replacementStructured.breakdownPattern) ? replacementStructured.breakdownPattern.join(" | ") : "",
              boss_battles_completed: Number(replacementStructured.bossBattlesCompletedThisWeek || 0),
              solutions_unlocked: Number(replacementStructured.sessionsCompletedThisWeek || 0),
              confidence_growth: null,
              next_steps: Array.isArray(replacementStructured.nextMove) ? replacementStructured.nextMove.join(" | ") : "",
              sent_at: new Date().toISOString(),
            }, replacementWindowKey)
          : await insertDeterministicParentReport({
              tutor_id: tutorId,
              student_id: studentId,
              parent_id: parentId,
              report_type: "monthly",
              week_number: null,
              month_name: formatMonthName(new Date(replacementStructured.monthStartDate)),
              summary: JSON.stringify(replacementStructured),
              topics_learned: Array.isArray(replacementStructured.topicsConditioned) ? replacementStructured.topicsConditioned.join(", ") : "",
              strengths: Array.isArray(replacementStructured.whatBecameStronger) ? replacementStructured.whatBecameStronger.join(" | ") : "",
              areas_for_growth: Array.isArray(replacementStructured.breakdownPattern) ? replacementStructured.breakdownPattern.join(" | ") : "",
              boss_battles_completed: 0,
              solutions_unlocked: Number(replacementStructured.totalSessionsCompletedThisMonth || 0),
              confidence_growth: null,
              next_steps: Array.isArray(replacementStructured.nextMonthMove) ? replacementStructured.nextMonthMove.join(" | ") : "",
              sent_at: new Date().toISOString(),
            }, replacementWindowKey);

        const { error: lineageError } = await supabase.from("response_integrity_report_supersessions").insert({
          supersession_id: `${correctionId}::${report.id}`,
          correction_id: correctionId,
          superseded_report_id: report.id,
          replacement_report_id: replacement.id,
          created_at: new Date().toISOString(),
        });
        if (lineageError && lineageError.code !== "23505") throw lineageError;
        regenerated += 1;
      }
      return { regenerated };
    },
  });

'''
marker = "  registerExecutiveCommandRhythmRoutes(app, isAuthenticated);"
if "regenerateAffectedReports: async ({ correctionId" not in text:
    text = replace_once(text, marker, hook + marker, "correction runtime registration marker")

# Hide superseded parent-report versions while preserving immutable lineage.
text = text.replace(
    '''           FROM public.parent_reports pr
             LEFT JOIN public.users u ON u.id = pr.tutor_id
            WHERE pr.parent_id = $1''',
    '''           FROM public.parent_reports pr
             LEFT JOIN public.users u ON u.id = pr.tutor_id
             LEFT JOIN public.response_integrity_report_supersessions rs ON rs.superseded_report_id = pr.id
            WHERE pr.parent_id = $1 AND rs.superseded_report_id IS NULL''',
    1,
)
normal_anchor = '''      if (error) throw error;

      const tutorIds = Array.from(new Set((reports || []).map((report: any) => report.tutor_id).filter(Boolean)));'''
normal_replacement = '''      if (error) throw error;

      const parentReportIds = (reports || []).map((report: any) => String(report.id)).filter(Boolean);
      const { data: supersededRows, error: supersededError } = parentReportIds.length
        ? await supabase
            .from("response_integrity_report_supersessions")
            .select("superseded_report_id")
            .in("superseded_report_id", parentReportIds)
        : { data: [] as any[], error: null as any };
      if (supersededError) throw supersededError;
      const supersededReportIds = new Set((supersededRows || []).map((row: any) => String(row.superseded_report_id)));
      const activeReports = (reports || []).filter((report: any) => !supersededReportIds.has(String(report.id)));

      const tutorIds = Array.from(new Set(activeReports.map((report: any) => report.tutor_id).filter(Boolean)));'''
if "const supersededReportIds = new Set" not in text:
    text = replace_once(text, normal_anchor, normal_replacement, "parent report supersession filter")
    route_start = text.index('  app.get("/api/parent/reports"')
    route_end = text.index('  });', route_start) + len('  });')
    segment = text[route_start:route_end]
    segment = segment.replace(
        '(reports || []).map((report: any) => mapParentFacingReport',
        'activeReports.map((report: any) => mapParentFacingReport',
        1,
    )
    text = text[:route_start] + segment + text[route_end:]
path.write_text(text)
