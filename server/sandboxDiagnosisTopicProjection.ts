/** Read current Sandbox routing and completed placement without rewriting student snapshots. */
export async function overlaySandboxDiagnosisTopicPlacement(input: {
  tutorId: string; studentId: string; topics: Record<string, any>;
}, db: { query: (sql: string, values: any[]) => Promise<{ rows: any[] }> }): Promise<Record<string, any>> {
  // Legacy mirrors can still describe ordinary Training after the owned
  // trajectory has required re-diagnosis. Routing must not depend on which
  // deployment last wrote the display snapshot.
  const routing = await db.query(`SELECT t.active_topic_key, t.specialist_route,
      t.specialist_targeted_rediagnosis_phase, t.specialist_phase, t.specialist_stability
    FROM public.specialist_sandbox_trajectories t
    JOIN public.students s ON s.id::text=t.student_id::text AND s.tutor_id::text=t.tutor_id::text
    JOIN public.parent_enrollments pe ON pe.id=s.parent_enrollment_id AND pe.is_sandbox_account=true
    WHERE t.tutor_id::text=$1 AND t.student_id::text=$2 AND t.status='active'
      AND t.divergence_active=false
    ORDER BY t.updated_at DESC LIMIT 1`, [input.tutorId,input.studentId]);
  const route = routing.rows[0];
  if (route?.specialist_route === "targeted_rediagnosis") {
    const key = Object.keys(input.topics).find(k =>
      k.trim().toLowerCase() === String(route.active_topic_key || "").trim().toLowerCase());
    if (key) return { ...input.topics, [key]: { ...input.topics[key],
      requiresTargetedRediagnosis: true,
      targetedRediagnosisStartPhase: route.specialist_targeted_rediagnosis_phase,
    } };
  }
  if (route?.specialist_route === "normal_training") {
    const key = Object.keys(input.topics).find(k =>
      k.trim().toLowerCase() === String(route.active_topic_key || "").trim().toLowerCase());
    if (key && input.topics[key]?.requiresTargetedRediagnosis) {
      return { ...input.topics, [key]: { ...input.topics[key],
        phase: route.specialist_phase,
        stability: route.specialist_stability,
        requiresTargetedRediagnosis: false,
        targetedRediagnosisStartPhase: null,
      } };
    }
  }
  const result = await db.query(`SELECT t.active_topic_key, t.specialist_phase, t.specialist_stability,
      r.id AS source_id, r.completed_at, r.specialist_decision->>'reason' AS reason
    FROM public.specialist_sandbox_trajectories t
    JOIN public.students s ON s.id::text=t.student_id::text AND s.tutor_id::text=t.tutor_id::text
    JOIN public.parent_enrollments pe ON pe.id=s.parent_enrollment_id AND pe.is_sandbox_account=true
    JOIN public.specialist_sandbox_rediagnosis_runs r ON r.trajectory_id=t.id
      AND r.student_id::text=t.student_id::text AND r.tutor_id::text=t.tutor_id::text
      AND r.tutor_assignment_id=t.tutor_assignment_id AND r.started_session_number=t.session_number
      AND r.status='completed' AND r.specialist_decision->>'complete'='true'
      AND r.specialist_decision->>'placementPhase'=t.specialist_phase
      AND r.specialist_decision->>'stability'=t.specialist_stability
    WHERE t.tutor_id::text=$1 AND t.student_id::text=$2 AND t.status='active'
      AND t.specialist_route='normal_training'
    ORDER BY r.completed_at DESC LIMIT 1`, [input.tutorId,input.studentId]);
  const row=result.rows[0];
  if (!row) return input.topics;
  const key=Object.keys(input.topics).find(k=>k.trim().toLowerCase()===String(row.active_topic_key||"").trim().toLowerCase());
  if (!key) return input.topics;
  const existing=input.topics[key];
  const observedAt=new Date(row.completed_at).toISOString();
  const history=Array.isArray(existing.history)?existing.history:[];
  const latest=Math.max(Date.parse(existing.lastUpdated||"")||0,...history.map((e:any)=>Date.parse(e.date||"")||0));
  if (Date.parse(observedAt)<=latest) return input.topics;
  return {...input.topics,[key]:{...existing,phase:row.specialist_phase,stability:row.specialist_stability,
    progressionAuthority:"building",lastUpdated:observedAt,requiresTargetedRediagnosis:false,targetedRediagnosisStartPhase:null,
    nextAction:row.reason,history:[...history,{phase:row.specialist_phase,stability:row.specialist_stability,
      date:observedAt,drillId:row.source_id,structuredObservation:{drillType:"targeted_rediagnosis",evidenceScope:"sandbox",studentStateAuthoritative:false}}]}};
}
