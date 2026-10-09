import { randomBytes, randomUUID } from "node:crypto";
import { pool } from "./db";
import {
  EXECUTE_CHALLENGE_VERSION, EXECUTE_CHALLENGE_TURNS,
  createExecutePlan, executeCaseBrief, nextExecuteTurn,
  validateExecuteResponse, executeRiskFlags,
  type ExecutePlan, type ExecuteResponse, type ExecuteTranscriptTurn,
} from "@shared/practicalExecuteChallenge";

function fail(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

async function assertEntry(tutorAssignmentId: string, tutorId: string) {
  const { getPracticalEntryStatus } = await import("./capabilityPracticalEvidence");
  const gate = await getPracticalEntryStatus(tutorAssignmentId, tutorId);
  if (!gate.ready) throw fail(403, gate.blockers.join(" "));
}

async function nextAttempt(tutorAssignmentId: string, tutorId: string) {
  const r = await pool.query(
    `SELECT e.attempt_number, r.outcome FROM public.specialist_capability_practical_evidence e
     LEFT JOIN public.specialist_capability_practical_reviews r ON r.evidence_id = e.id
     WHERE e.tutor_assignment_id = $1 AND e.tutor_id = $2
       AND e.proof_key = 'execute' AND e.proof_version = 2
     ORDER BY e.attempt_number DESC LIMIT 1`,
    [tutorAssignmentId, tutorId],
  );
  const latest = r.rows[0];
  if (latest && latest.outcome !== "repeat_required") {
    return { allowed: false, reason: latest.outcome === "approved"
      ? "Execute is already approved."
      : latest.outcome === "integrity_review"
        ? "Execute remains under integrity review."
        : "Execute is awaiting TD review.", attemptNumber: Number(latest.attempt_number) };
  }
  return { allowed: true, reason: null, attemptNumber: Number(latest?.attempt_number || 0) + 1 };
}

async function loadChallenge(tutorAssignmentId: string, tutorId: string, attemptNumber: number) {
  const r = await pool.query(
    `SELECT c.id,c.tutor_assignment_id,c.tutor_id,c.attempt_number,c.challenge_version,c.active_turn,
            c.status,c.started_at,c.completed_at,t.plan
       FROM public.specialist_practical_execute_challenges c
       JOIN private.specialist_practical_execute_challenge_truth t ON t.challenge_id = c.id
      WHERE c.tutor_assignment_id=$1 AND c.tutor_id=$2 AND c.attempt_number=$3
        AND c.challenge_version=$4 LIMIT 1`,
    [tutorAssignmentId, tutorId, attemptNumber, EXECUTE_CHALLENGE_VERSION],
  );
  return r.rows[0] || null;
}

async function readTurns(challengeId: string): Promise<ExecuteTranscriptTurn[]> {
  const r = await pool.query(
    `SELECT turn_number,event_snapshot,specialist_response,risk_flags,recorded_at
       FROM public.specialist_practical_execute_turns
      WHERE challenge_id=$1 ORDER BY turn_number ASC`,
    [challengeId],
  );
  return r.rows.map((row) => ({
    number:Number(row.turn_number),
    situation:row.event_snapshot,
    response:row.specialist_response,
    riskFlags:row.risk_flags || [],
    recordedAt:row.recorded_at,
  }));
}

async function projection(challenge: any, includeReviewFlags = false) {
  const turns = await readTurns(String(challenge.id));
  const currentTurn = nextExecuteTurn(challenge.plan as ExecutePlan, turns);
  const complete = challenge.status === "complete"
    && turns.length === EXECUTE_CHALLENGE_TURNS && currentTurn === null;
  return {
    started: true as const,
    challengeId: String(challenge.id),
    version: EXECUTE_CHALLENGE_VERSION,
    attemptNumber: Number(challenge.attempt_number),
    brief: executeCaseBrief(),
    ...(includeReviewFlags?{privateBankLineage:(challenge.plan as ExecutePlan).privateBank
      ? {bankKey:(challenge.plan as ExecutePlan).privateBank!.bankKey,
         bankVersion:(challenge.plan as ExecutePlan).privateBank!.bankVersion}:null}:{}),
    currentTurn: complete ? null : currentTurn,
    completed: complete,
    turnCount: turns.length,
    history: turns.map((turn) => ({
      number:turn.number,
      situation:turn.situation,
      response:turn.response,
      recordedAt:turn.recordedAt || null,
      ...(includeReviewFlags ? { riskFlags:turn.riskFlags } : {}),
    })),
    startedAt:challenge.started_at,
    completedAt:challenge.completed_at,
  };
}

export async function getExecuteChallengeStatus(input: { tutorAssignmentId: string; tutorId: string }) {
  await assertEntry(input.tutorAssignmentId, input.tutorId);
  const eligibility = await nextAttempt(input.tutorAssignmentId, input.tutorId);
  if (!eligibility.allowed) return {
    started:false as const, allowed:false, reason:eligibility.reason,
    version:EXECUTE_CHALLENGE_VERSION, completed:false as const,
  };
  const challenge = await loadChallenge(input.tutorAssignmentId,input.tutorId,eligibility.attemptNumber);
  if (!challenge) return {
    started:false as const, allowed:true, reason:null, completed:false as const,
    version:EXECUTE_CHALLENGE_VERSION, attemptNumber:eligibility.attemptNumber,
  };
  return projection(challenge);
}

export async function startExecuteChallenge(input: { tutorAssignmentId: string; tutorId: string }) {
  await assertEntry(input.tutorAssignmentId, input.tutorId);
  const eligibility = await nextAttempt(input.tutorAssignmentId,input.tutorId);
  if (!eligibility.allowed) throw fail(409, eligibility.reason || "Execute attempt is not available.");
  const already = await loadChallenge(input.tutorAssignmentId,input.tutorId,eligibility.attemptNumber);
  if (already) return projection(already);

  // Draw only simulated public-facing behaviours from the active PRIVATE Sandbox
  // matrix. Canonical answer keys, intervention truth and future outcomes stay hidden.
  const privateBank = await pool.query(
    `SELECT b.bank_key,b.bank_version,
            array_agg(DISTINCT o.definition->>'studentBehavior'
              ORDER BY o.definition->>'studentBehavior') AS behaviors
       FROM private.specialist_sandbox_environment_banks b
       JOIN private.specialist_sandbox_rep_outcomes o
         ON o.bank_key=b.bank_key AND o.bank_version=b.bank_version
      WHERE b.active=true AND o.active=true AND o.phase='Controlled Discomfort'
        AND NULLIF(o.definition->>'studentBehavior','') IS NOT NULL
      GROUP BY b.bank_key,b.bank_version
      ORDER BY b.bank_version DESC LIMIT 1`,
  );
  const source=privateBank.rows[0];
  if(!source)throw fail(409,"The approved private Sandbox outcome bank is unavailable for Practicals.");
  const plan=createExecutePlan(randomBytes(32).toString("hex"),{
    bankKey:String(source.bank_key),bankVersion:Number(source.bank_version),
    behaviors:source.behaviors||[],
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO public.specialist_practical_execute_challenges
       (id,tutor_assignment_id,tutor_id,challenge_version,attempt_number,status,active_turn)
       VALUES ($1,$2,$3,$4,$5,'active',1)
       ON CONFLICT (tutor_assignment_id,challenge_version,attempt_number) DO NOTHING
       RETURNING id`,
      [randomUUID(),input.tutorAssignmentId,input.tutorId,EXECUTE_CHALLENGE_VERSION,eligibility.attemptNumber],
    );
    if (inserted.rows[0]) {
      await client.query(
        `INSERT INTO private.specialist_practical_execute_challenge_truth (challenge_id,plan)
         VALUES ($1,$2::jsonb)`,
        [inserted.rows[0].id, JSON.stringify(plan)],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const challenge = await loadChallenge(input.tutorAssignmentId,input.tutorId,eligibility.attemptNumber);
  if (!challenge) throw fail(500, "Execute challenge could not be persisted.");
  return projection(challenge);
}

export async function recordExecuteTurn(input: {
  tutorAssignmentId:string; tutorId:string; challengeId:string;
  turnNumber:number; response:ExecuteResponse;
}) {
  await assertEntry(input.tutorAssignmentId,input.tutorId);
  const response = validateExecuteResponse(input.response);
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const selected=await client.query(
      `SELECT c.id,c.attempt_number,c.challenge_version,c.active_turn,c.status,t.plan
       FROM public.specialist_practical_execute_challenges c
       JOIN private.specialist_practical_execute_challenge_truth t ON t.challenge_id=c.id
       WHERE c.id=$1 AND c.tutor_assignment_id=$2 AND c.tutor_id=$3 FOR UPDATE OF c`,
      [input.challengeId,input.tutorAssignmentId,input.tutorId],
    );
    const c=selected.rows[0];
    if (!c) throw fail(403,"This challenge does not belong to the authenticated Specialist assignment.");
    if (c.status !== "active" || Number(c.active_turn) !== input.turnNumber)
      throw fail(409,"Execute turn is stale, already recorded, or out of sequence.");
    if (c.challenge_version !== EXECUTE_CHALLENGE_VERSION)
      throw fail(409,"Execute challenge bank version changed.");

    const seen=await client.query(
      `SELECT turn_number,event_snapshot,specialist_response,risk_flags FROM public.specialist_practical_execute_turns
       WHERE challenge_id=$1 ORDER BY turn_number ASC`,[c.id],
    );
    const previous:ExecuteTranscriptTurn[]=seen.rows.map(row=>({
      number:Number(row.turn_number),situation:row.event_snapshot,
      response:row.specialist_response,riskFlags:row.risk_flags||[],
    }));
    const event=nextExecuteTurn(c.plan as ExecutePlan,previous);
    if (!event || event.number !== input.turnNumber)
      throw fail(409,"The expected Execute turn is not available.");
    const flags=executeRiskFlags(event,response);
    await client.query(
      `INSERT INTO public.specialist_practical_execute_turns
       (challenge_id,turn_number,event_snapshot,specialist_response,risk_flags)
       VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb)`,
      [c.id,event.number,JSON.stringify(event),JSON.stringify(response),JSON.stringify(flags)],
    );
    const done=event.number===EXECUTE_CHALLENGE_TURNS;
    await client.query(
      `UPDATE public.specialist_practical_execute_challenges
       SET active_turn=$2,status=$3,completed_at=CASE WHEN $3='complete' THEN now() ELSE null END
       WHERE id=$1`,[c.id,event.number+1,done?"complete":"active"],
    );
    await client.query("COMMIT");
  } catch(error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
  const status=await loadChallenge(input.tutorAssignmentId,input.tutorId,
    (await nextAttempt(input.tutorAssignmentId,input.tutorId)).attemptNumber);
  if(!status)throw fail(500,"Execute challenge readback failed.");
  return projection(status);
}

export async function assertCompletedExecuteChallenge(input: {
  tutorAssignmentId:string; tutorId:string; challengeId:string; attemptNumber:number;
}) {
  const r=await pool.query(
    `SELECT c.id,c.challenge_version,c.attempt_number,c.status,c.active_turn,
       (SELECT COUNT(*)::int FROM public.specialist_practical_execute_turns t WHERE t.challenge_id=c.id) AS turn_count,
       (SELECT COUNT(*)::int FROM public.specialist_capability_practical_evidence e WHERE e.execute_challenge_id=c.id) AS used_count
     FROM public.specialist_practical_execute_challenges c
     WHERE c.id=$1 AND c.tutor_assignment_id=$2 AND c.tutor_id=$3 LIMIT 1`,
    [input.challengeId,input.tutorAssignmentId,input.tutorId],
  );
  const c=r.rows[0];
  if(!c || c.challenge_version!==EXECUTE_CHALLENGE_VERSION ||
    Number(c.attempt_number)!==input.attemptNumber || c.status!=="complete" ||
    Number(c.active_turn)!==EXECUTE_CHALLENGE_TURNS+1 || Number(c.turn_count)!==EXECUTE_CHALLENGE_TURNS ||
    Number(c.used_count)!==0) {
    throw fail(409,"Execute requires a newly completed three-turn, server-assigned challenge for this attempt.");
  }
  return String(c.id);
}

export async function getExecuteChallengeForTd(challengeId:string, tutorAssignmentId:string,tutorId:string) {
  const r=await pool.query(
    `SELECT c.id,c.tutor_assignment_id,c.tutor_id,c.attempt_number,c.challenge_version,
       c.status,c.started_at,c.completed_at,t.plan
     FROM public.specialist_practical_execute_challenges c
     JOIN private.specialist_practical_execute_challenge_truth t ON t.challenge_id=c.id
     WHERE c.id=$1 AND c.tutor_assignment_id=$2 AND c.tutor_id=$3 LIMIT 1`,
    [challengeId,tutorAssignmentId,tutorId],
  );
  if(!r.rows[0])throw fail(404,"Linked Execute challenge was not found.");
  const projected=await projection(r.rows[0],true);
  if(!projected.completed)throw fail(409,"Linked Execute challenge was not completed.");
  return projected;
}
