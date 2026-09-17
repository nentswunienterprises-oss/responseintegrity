import fs from 'node:fs';

const replaceOnce = (text, from, to, label) => {
  if (!text.includes(from)) throw new Error(`Missing ${label}`);
  return text.replace(from, to);
};

// Ensure report regeneration sees the full student history, while topic-state replay remains topic-scoped.
{
  const path = 'server/routes/responseIntegrityEvidenceCorrectionRuntime.ts';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceOnce(
    text,
    `const loadTopicDrillRows = async (studentId: string, topic: string): Promise<EffectiveCorrectionDrillRow[]> => {\n  const { data, error } = await supabase\n    .from("intro_session_drills")\n    .select("id, student_id, tutor_id, submitted_at, scheduled_session_id, training_session_run_id, drill")\n    .eq("student_id", studentId)\n    .order("submitted_at", { ascending: true })\n    .limit(2000);\n  if (error) throw new Error(\`Failed to load topic lineage: \${error.message}\`);\n  return (data || [])\n    .map((row: any) => ({ ...row, drill: parseDrill(row.drill) }))\n    .filter((row: any) => row.drill && topicKey(drillTopic(row.drill)) === topicKey(topic)) as EffectiveCorrectionDrillRow[];\n};`,
    `const loadStudentDrillRows = async (studentId: string): Promise<EffectiveCorrectionDrillRow[]> => {\n  const { data, error } = await supabase\n    .from("intro_session_drills")\n    .select("id, student_id, tutor_id, submitted_at, scheduled_session_id, training_session_run_id, drill")\n    .eq("student_id", studentId)\n    .order("submitted_at", { ascending: true })\n    .limit(2000);\n  if (error) throw new Error(\`Failed to load student drill lineage: \${error.message}\`);\n  return (data || [])\n    .map((row: any) => ({ ...row, drill: parseDrill(row.drill) }))\n    .filter((row: any) => !!row.drill) as EffectiveCorrectionDrillRow[];\n};`,
    'student drill loader',
  );
  text = replaceOnce(
    text,
    `  const rows = await loadTopicDrillRows(correction.student_id, correction.topic);\n  const sourceIndex = rows.findIndex((row) => row.id === correction.source_drill_id);`,
    `  const allRows = await loadStudentDrillRows(correction.student_id);\n  const rows = allRows.filter((row) => topicKey(drillTopic(row.drill)) === topicKey(correction.topic));\n  const sourceIndex = rows.findIndex((row) => row.id === correction.source_drill_id);`,
    'topic replay selection',
  );
  text = replaceOnce(
    text,
    `  return { rows, replayRows, events, sourceRow: rows[sourceIndex] };`,
    `  return { rows: allRows, replayRows, events, sourceRow: rows[sourceIndex] };`,
    'full history return',
  );
  text = text.replace(
    `  if (drillType === "inherited_verification") return "inherited_verification";`,
    `  if (drillType === "inherited_verification" || drill.inheritedVerification === true || clean(drill.inheritedVerificationMode)) return "inherited_verification";`,
  );
  fs.writeFileSync(path, text);
}

// Make correction-invalidated Timer Contracts disappear from the active contract lookup and rebuild when possible.
{
  const path = 'server/routes/capabilityTpsTimerRuntime.ts';
  let text = fs.readFileSync(path, 'utf8');
  const invalidationHelper = `const isTimerContractInvalidated = async (contractId: string) => {\n  if (!contractId) return false;\n  if (isEmergencyDbMode()) {\n    const result = await pool.query(\n      \`SELECT invalidation_id FROM public.capability_tps_timer_contract_invalidations WHERE contract_id = $1 LIMIT 1\`,\n      [contractId],\n    );\n    return result.rows.length > 0;\n  }\n  const { data, error } = await supabase\n    .from("capability_tps_timer_contract_invalidations")\n    .select("invalidation_id")\n    .eq("contract_id", contractId)\n    .limit(1)\n    .maybeSingle();\n  if (error) throw new Error(\`Failed to load TPS Timer Contract invalidation: \${error.message}\`);\n  return !!data;\n};\n\n`;
  text = replaceOnce(text, 'const loadLatestTimerContract = async (', invalidationHelper + 'const loadLatestTimerContract = async (', 'timer invalidation helper');
  text = replaceOnce(
    text,
    `    return result.rows?.[0] ? rowToContract(result.rows[0]) : null;`,
    `    const contract = result.rows?.[0] ? rowToContract(result.rows[0]) : null;\n    if (!contract) return null;\n    return await isTimerContractInvalidated(contract.contractId) ? null : contract;`,
    'emergency active contract filter',
  );
  text = replaceOnce(
    text,
    `  return data ? rowToContract(data as TimerContractRow) : null;\n};\n\nconst insertTimerContract`,
    `  const contract = data ? rowToContract(data as TimerContractRow) : null;\n  if (!contract) return null;\n  return await isTimerContractInvalidated(contract.contractId) ? null : contract;\n};\n\nconst insertTimerContract`,
    'supabase active contract filter',
  );

  const reconcile = `export const reconcileTpsTimerContractAfterCorrection = async ({\n  correctionId,\n  student,\n  studentId,\n  tutorId,\n  topic,\n  sourceDrillId,\n  effectiveDrillRows,\n}: {\n  correctionId: string;\n  student: any;\n  studentId: string;\n  tutorId: string;\n  topic: string;\n  sourceDrillId: string;\n  effectiveDrillRows: Array<{ id?: unknown; student_id?: unknown; tutor_id?: unknown; submitted_at?: unknown; drill?: unknown }>;\n}) => {\n  const conditioningEpochKey = deriveConditioningEpochKey(student, topic);\n  const normalizedTopicKey = topicKeyFor(topic);\n  const current = await loadLatestTimerContract(studentId, normalizedTopicKey, conditioningEpochKey);\n  if (!current) return { status: "no_active_contract" as const };\n\n  const sourcePrefix = \`${sourceDrillId}::\`;\n  const baselineDependsOnSource = current.baselineSampleRecordIds.some((id) => clean(id).startsWith(sourcePrefix));\n  if (!baselineDependsOnSource) return { status: "unaffected" as const, contract: current };\n\n  const invalidationId = randomUUID();\n  const invalidation = {\n    invalidation_id: invalidationId,\n    contract_id: current.contractId,\n    correction_id: correctionId,\n    student_id: studentId,\n    topic,\n    topic_key: normalizedTopicKey,\n    conditioning_epoch_key: conditioningEpochKey,\n    reason: "Approved evidence correction changed lineage used by the active TPS baseline.",\n    invalidated_at: new Date().toISOString(),\n  };\n  if (isEmergencyDbMode()) {\n    await pool.query(\n      \`INSERT INTO public.capability_tps_timer_contract_invalidations\n        (invalidation_id, contract_id, correction_id, student_id, topic, topic_key, conditioning_epoch_key, reason, invalidated_at)\n       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (contract_id, correction_id) DO NOTHING\`,\n      [invalidation.invalidation_id, invalidation.contract_id, invalidation.correction_id, invalidation.student_id, invalidation.topic, invalidation.topic_key, invalidation.conditioning_epoch_key, invalidation.reason, invalidation.invalidated_at],\n    );\n  } else {\n    const { error } = await supabase.from("capability_tps_timer_contract_invalidations").upsert(invalidation, {\n      onConflict: "contract_id,correction_id",\n      ignoreDuplicates: true,\n    });\n    if (error) throw new Error(\`Failed to invalidate TPS Timer Contract after correction: \${error.message}\`);\n  }\n\n  const runtime = buildTpsTimerRuntimeStatus({ rows: effectiveDrillRows, studentId, topic });\n  if (!runtime.contract) {\n    return {\n      status: "pre_tps_calibration_required" as const,\n      invalidatedContractId: current.contractId,\n      conditioningEpochKey,\n    };\n  }\n\n  const replacement = await insertTimerContract({\n    contract: runtime.contract,\n    conditioningEpochKey,\n    tutorId,\n    source: "historical_untimed",\n    supersedesContractId: current.contractId,\n  });\n  return {\n    status: "superseded" as const,\n    invalidatedContractId: current.contractId,\n    contract: replacement,\n    conditioningEpochKey,\n  };\n};\n\n`;
  text = replaceOnce(text, 'export function registerCapabilityTpsTimerRuntimeRoutes(app: Express) {', reconcile + 'export function registerCapabilityTpsTimerRuntimeRoutes(app: Express) {', 'timer correction reconciliation export');
  fs.writeFileSync(path, text);
}

// Register correction runtime inside routes.ts so it can reuse the canonical deterministic report builders.
{
  const path = 'server/routes.ts';
  let text = fs.readFileSync(path, 'utf8');
  const imports = `import { registerResponseIntegrityEvidenceCorrectionRuntimeRoutes } from "./routes/responseIntegrityEvidenceCorrectionRuntime";\nimport { reconcileTpsTimerContractAfterCorrection } from "./routes/capabilityTpsTimerRuntime";\n`;
  if (!text.includes('registerResponseIntegrityEvidenceCorrectionRuntimeRoutes')) text = imports + text;

  const hook = `  registerResponseIntegrityEvidenceCorrectionRuntimeRoutes(app, {\n    reconcileTpsTimerContract: reconcileTpsTimerContractAfterCorrection,\n    regenerateAffectedReports: async ({ correctionId, studentId, tutorId, sourceSubmittedAt, effectiveDrillRows }) => {\n      const sourceDate = new Date(sourceSubmittedAt);\n      const anchoredRows = await attachReportAnchorTimes(effectiveDrillRows as any[]);\n      const { data: reports, error: reportError } = await supabase\n        .from("parent_reports")\n        .select("*")\n        .eq("student_id", studentId)\n        .eq("tutor_id", tutorId)\n        .in("report_type", ["weekly", "monthly"])\n        .order("sent_at", { ascending: true });\n      if (reportError) throw reportError;\n      const reportIds = (reports || []).map((report: any) => String(report.id));\n      const { data: existingSupersessions, error: supersessionError } = reportIds.length\n        ? await supabase\n            .from("response_integrity_report_supersessions")\n            .select("superseded_report_id")\n            .in("superseded_report_id", reportIds)\n        : { data: [] as any[], error: null as any };\n      if (supersessionError) throw supersessionError;\n      const alreadySuperseded = new Set((existingSupersessions || []).map((row: any) => String(row.superseded_report_id)));\n      let regenerated = 0;\n\n      for (const report of reports || []) {\n        if (alreadySuperseded.has(String(report.id))) continue;\n        const structured = parseStructuredReportSummary(report.summary) || {};\n        const endDateText = report.report_type === "weekly" ? structured.weekEndDate : structured.monthEndDate;\n        const endDate = endDateText ? new Date(\`${endDateText}T23:59:59.999Z\`) : new Date(report.sent_at);\n        if (Number.isFinite(sourceDate.getTime()) && Number.isFinite(endDate.getTime()) && endDate < sourceDate) continue;\n        const sourceSessionIds = new Set(\n          (Array.isArray(structured.sourceSessionIds) ? structured.sourceSessionIds : [])\n            .map((id: unknown) => String(id || "").trim())\n            .filter(Boolean),\n        );\n        if (sourceSessionIds.size === 0) continue;\n        const windowRows = anchoredRows.filter((row: any) => sourceSessionIds.has(resolveReportSessionGroupId(row)));\n        if (windowRows.length === 0) continue;\n\n        const replacementStructured = report.report_type === "weekly"\n          ? createWeeklyStructuredDataFromDrills(windowRows)\n          : createMonthlyStructuredDataFromDrills(windowRows);\n        if (!replacementStructured) continue;\n        replacementStructured.correctionReplay = {\n          correctionId,\n          supersedesReportId: String(report.id),\n          regeneratedAt: new Date().toISOString(),\n        };\n        const replacementWindowKey = \`${report.report_window_key || buildDeterministicReportWindowKey(report.report_type, replacementStructured) || `${report.report_type}:${report.id}`}::correction:${correctionId}\`;\n        const parentId = String(report.parent_id || "");\n        const replacement = report.report_type === "weekly"\n          ? await insertDeterministicParentReport({\n              tutor_id: tutorId,\n              student_id: studentId,\n              parent_id: parentId,\n              report_type: "weekly",\n              week_number: getIsoWeekNumber(new Date(replacementStructured.weekStartDate)),\n              month_name: null,\n              summary: JSON.stringify(replacementStructured),\n              topics_learned: Array.isArray(replacementStructured.topicsWorkedOn) ? replacementStructured.topicsWorkedOn.join(", ") : "",\n              strengths: Array.isArray(replacementStructured.whatChanged) ? replacementStructured.whatChanged.join(" | ") : "",\n              areas_for_growth: Array.isArray(replacementStructured.breakdownPattern) ? replacementStructured.breakdownPattern.join(" | ") : "",\n              boss_battles_completed: Number(replacementStructured.bossBattlesCompletedThisWeek || 0),\n              solutions_unlocked: Number(replacementStructured.sessionsCompletedThisWeek || 0),\n              confidence_growth: null,\n              next_steps: Array.isArray(replacementStructured.nextMove) ? replacementStructured.nextMove.join(" | ") : "",\n              sent_at: new Date().toISOString(),\n            }, replacementWindowKey)\n          : await insertDeterministicParentReport({\n              tutor_id: tutorId,\n              student_id: studentId,\n              parent_id: parentId,\n              report_type: "monthly",\n              week_number: null,\n              month_name: formatMonthName(new Date(replacementStructured.monthStartDate)),\n              summary: JSON.stringify(replacementStructured),\n              topics_learned: Array.isArray(replacementStructured.topicsConditioned) ? replacementStructured.topicsConditioned.join(", ") : "",\n              strengths: Array.isArray(replacementStructured.whatBecameStronger) ? replacementStructured.whatBecameStronger.join(" | ") : "",\n              areas_for_growth: Array.isArray(replacementStructured.breakdownPattern) ? replacementStructured.breakdownPattern.join(" | ") : "",\n              boss_battles_completed: 0,\n              solutions_unlocked: Number(replacementStructured.totalSessionsCompletedThisMonth || 0),\n              confidence_growth: null,\n              next_steps: Array.isArray(replacementStructured.nextMonthMove) ? replacementStructured.nextMonthMove.join(" | ") : "",\n              sent_at: new Date().toISOString(),\n            }, replacementWindowKey);\n\n        const { error: lineageError } = await supabase.from("response_integrity_report_supersessions").insert({\n          supersession_id: \`${correctionId}::${report.id}\`,\n          correction_id: correctionId,\n          superseded_report_id: report.id,\n          replacement_report_id: replacement.id,\n          created_at: new Date().toISOString(),\n        });\n        if (lineageError && lineageError.code !== "23505") throw lineageError;\n        regenerated += 1;\n      }\n      return { regenerated };\n    },\n  });\n\n`;
  const marker = '  registerExecutiveCommandRhythmRoutes(app, isAuthenticated);';
  if (!text.includes('regenerateAffectedReports: async ({ correctionId')) {
    text = replaceOnce(text, marker, hook + marker, 'correction runtime registration marker');
  }

  // Hide superseded parent-report versions while preserving them in immutable lineage.
  text = text.replace(
    `           FROM public.parent_reports pr\n             LEFT JOIN public.users u ON u.id = pr.tutor_id\n            WHERE pr.parent_id = $1`,
    `           FROM public.parent_reports pr\n             LEFT JOIN public.users u ON u.id = pr.tutor_id\n             LEFT JOIN public.response_integrity_report_supersessions rs ON rs.superseded_report_id = pr.id\n            WHERE pr.parent_id = $1 AND rs.superseded_report_id IS NULL`,
  );
  const normalAnchor = `      if (error) throw error;\n\n      const tutorIds = Array.from(new Set((reports || []).map((report: any) => report.tutor_id).filter(Boolean)));`;
  const normalReplacement = `      if (error) throw error;\n\n      const parentReportIds = (reports || []).map((report: any) => String(report.id)).filter(Boolean);\n      const { data: supersededRows, error: supersededError } = parentReportIds.length\n        ? await supabase\n            .from("response_integrity_report_supersessions")\n            .select("superseded_report_id")\n            .in("superseded_report_id", parentReportIds)\n        : { data: [] as any[], error: null as any };\n      if (supersededError) throw supersededError;\n      const supersededReportIds = new Set((supersededRows || []).map((row: any) => String(row.superseded_report_id)));\n      const activeReports = (reports || []).filter((report: any) => !supersededReportIds.has(String(report.id)));\n\n      const tutorIds = Array.from(new Set(activeReports.map((report: any) => report.tutor_id).filter(Boolean)));`;
  if (!text.includes('const supersededReportIds = new Set')) {
    text = replaceOnce(text, normalAnchor, normalReplacement, 'parent report supersession filter');
    const routeStart = text.indexOf('  app.get("/api/parent/reports"');
    const routeEnd = text.indexOf('  });', routeStart) + 5;
    let segment = text.slice(routeStart, routeEnd);
    segment = segment.replace('(reports || []).map((report: any) => mapParentFacingReport', 'activeReports.map((report: any) => mapParentFacingReport');
    text = text.slice(0, routeStart) + segment + text.slice(routeEnd);
  }
  fs.writeFileSync(path, text);
}
