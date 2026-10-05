import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';

// Only this dedicated Proof Specialist receives test evidence. Production is read-only.
const expected = {
  topic_conditioning_mastery_v1: [17, 'e7805d71901b413f50b790c187a9d1b4'],
  clarity_mastery_v1: [15, '5d50acce433b28a2c26ab09308b94552'],
  structured_execution_mastery_v1: [14, '065802ec37537d8bedad8dbbae752f19'],
  controlled_discomfort_mastery_v1: [14, '1c94c4d1b5977812c0664d0bde1a2806'],
  time_pressure_stability_mastery_v1: [14, 'f54800ed2540c51cd8ae88e66a76141c'],
  transformation_phases_retrieval_v1: [10, 'c0903ab8ff3021efa38b58a8b45bfa88'],
  transformation_state_transfer_v1: [11, 'deb8a266131f44e2eb4d23c45d83be8a'],
  intro_session_structure_mastery_v1: [15, 'af5b0fd53021e3e5a97ce006d94ebcd1'],
  logging_system_mastery_v1: [14, '012cff8049a67a303a0de637b73e29e3'],
  session_flow_control_mastery_v1: [14, '9a976b6464e3784bf6df11dc8e0b1195'],
  drill_library_mastery_v1: [9, 'a73ab327219589907e03a159f55d3351'],
  handover_verification_mastery_v1: [10, '389bd5799ed96ce1e4d5c4efba624b10'],
  tools_required_mastery_v1: [10, '2bab6216926114ae5a99fcf343faea72'],
};
const base = 'https://tt-confidence-hub-git-fix-prev-504b23-relief-works-technologies.vercel.app';
const assignment = '836a839f-2f29-45c7-b8c2-aa501c95e1b0';
const tutor = '77977298-7ac9-41f9-a726-9d5fd634540f';
const email = process.env.RI_PROOF_SPECIALIST_EMAIL;
const password = process.env.RI_PROOF_SPECIALIST_PASSWORD;
assert.ok(email && password, 'Encrypted Proof Specialist credentials are required');
const url = new URL(process.env.RI_PRODUCTION_DATABASE_URL);
assert.match(decodeURIComponent(url.username), /yzcnavucvwgmulcxgxvw|postgres/);
assert.ok(url.hostname.includes('yzcnavucvwgmulcxgxvw') || decodeURIComponent(url.username).includes('yzcnavucvwgmulcxgxvw'), 'The Hub source required');
url.searchParams.delete('sslmode');
const client = new pg.Client({ connectionString: url.href, ssl: { rejectUnauthorized: true } });
const banks = new Map();
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  for (const [key, [version, hash]] of Object.entries(expected)) {
    const { rows } = await client.query(`SELECT c.active,c.review_mode,
      (SELECT md5(jsonb_agg(to_jsonb(i)-'created_at'-'bank_version' ORDER BY item_key)::text)
       FROM private.specialist_capability_assessment_items i WHERE i.assessment_key=$1 AND i.bank_version=$2) hash
      FROM private.specialist_capability_assessment_configs c WHERE c.assessment_key=$1 AND c.bank_version=$2`, [key, version]);
    assert.equal(rows.length, 1); assert.equal(rows[0].hash, hash);
    assert.equal(rows[0].active, true); assert.equal(rows[0].review_mode, false);
    const items = await client.query('SELECT item_key,correct_option_keys FROM private.specialist_capability_assessment_items WHERE assessment_key=$1 AND bank_version=$2', [key, version]);
    assert.ok(key.endsWith("_mastery_v1") ? items.rows.length===45 : items.rows.length>=25);
    banks.set(key, new Map(items.rows.map(row => [row.item_key, row.correct_option_keys])));
  }
  await client.query('ROLLBACK');
} finally { await client.end(); }

const cookies = new Map();
const headers = { 'content-type': 'application/json' };
if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
async function request(path, body) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...headers, cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; ') }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
  for (const raw of response.headers.getSetCookie()) { const pair = raw.split(';')[0]; const index = pair.indexOf('='); cookies.set(pair.slice(0,index), pair.slice(index+1)); }
  const data = await response.json();
  return { status: response.status, data };
}
// These commits differ from the green approved app only in proof scripts/workflow/docs.
const approvedAppShas = [process.env.GITHUB_SHA, process.env.RELEASE_APP_SHA,
  'c6684e33b1a168f6afeb5f9c374865174868c191',
  '80eb358de21542df1cfacb5871b2b198e61e7a9e',
  'd2a48086c941edc2438d54cd916063ffa9049f23'];
let environment;
for (let count=0; count<40; count++) {
  try {
    const response = await request('/api/proof-environment');
    if (response.status===200 && approvedAppShas.includes(response.data.commitSha)) { environment=response.data; break; }
  } catch { /* Await the deployment without printing responses or credentials. */ }
  await new Promise(resolve => setTimeout(resolve, 10000));
}
assert.ok(environment, 'Expected approved Proof deployment unavailable');
assert.equal(environment.vercelEnv, 'preview');
assert.equal(environment.supabaseProjectRef, 'jftlxeacphvbnhbsbpxc');
const login = await request('/api/auth/signin', { email, password, expectedRole: 'tutor' });
assert.equal(login.status, 200, 'Proof Specialist login failed');
assert.equal(login.data.dbUser.id, tutor); assert.equal(login.data.dbUser.role, 'tutor');
const planPath = '/api/tutor/capability-plan?tutorAssignmentId=' + assignment;
const plan = await request(planPath); assert.equal(plan.status, 200);
// Current-version prerequisites are exercised through the same real API; no timestamps are backdated.
const report = [];
for (const [key, [version, hash]] of Object.entries(expected)) {
  const currentPlan=await request(planPath); assert.equal(currentPlan.status, 200);
  const availability = currentPlan.data.assessments.find(a=>a.assessmentKey===key);
  assert.equal(availability.bankVersion, version); assert.notEqual(availability.reviewMode, true);
  if (availability.status==='locked') {
    const blocked={ status: 'BLOCKED', assessmentKey: key, reason: availability.reason, unlockAt: availability.unlockAt, prerequisiteAttempts: report, appSha: environment.commitSha };
    fs.mkdirSync('artifacts', { recursive: true });
    fs.writeFileSync('artifacts/session-infrastructure-live-proof.json', JSON.stringify(blocked,null,2));
    console.log('SESSION_INFRASTRUCTURE_LIVE_PROOF_BLOCKED '+JSON.stringify(blocked));
    throw new Error('Real prerequisite remains locked: '+key+' '+availability.reason+' '+availability.unlockAt);
  }
  assert.ok(['available','complete'].includes(availability.status));
  const path = '/api/tutor/capability-assessments/' + key;
  if (availability.status==='complete') { report.push({ key, version, hash, alreadyComplete: true }); continue; }
  const response = await request(path+'?tutorAssignmentId='+assignment);
  assert.equal(response.status, 200); const form=response.data;
  const formSize=key.endsWith('_mastery_v1') ? 15 : 25;
  assert.equal(form.bankVersion, version); assert.equal(form.questions.length, formSize);
  assert.doesNotMatch(JSON.stringify(form.questions), /"(?:correctOptionKeys|criticalFailOptionKeys|explanation)"\s*:/);
  const repeat = await request(path+'?tutorAssignmentId='+assignment);
  assert.equal(repeat.data.formId, form.formId);
  assert.deepEqual(repeat.data.questions, form.questions);
  const receipts=[];
  for (const question of form.questions) {
    const selectedOptionKeys=banks.get(key).get(question.key); assert.ok(selectedOptionKeys, 'Approved item mapping missing');
    const confirmation=await request(path+'/question-confirmation', { interactionToken: form.interactionToken, priorReceipts: receipts, questionKey: question.key, selectedOptionKeys });
    assert.equal(confirmation.status, 201, 'Confirmation failed for '+key+': '+String(confirmation.data.message || 'no server message')); assert.equal(confirmation.data.confirmation.correct, true);
    receipts.push(confirmation.data.receipt);
  }
  const payload={ tutorAssignmentId: assignment, interactionToken: form.interactionToken, receipts };
  const attempt=await request(path+'/attempt', payload);
  assert.equal(attempt.status, 201); assert.equal(attempt.data.passed, true);
  assert.equal(attempt.data.hasCriticalFail, false); assert.equal(attempt.data.correctQuestions, formSize);
  const replay=await request(path+'/attempt', payload); assert.equal(replay.status, 409, 'Completed gate must reject replay');
  const reset=await request(path+'/review-reset', { tutorAssignmentId: assignment });
  assert.equal(reset.status, 200); assert.equal(reset.data.reviewMode, false); assert.equal(reset.data.reset, false);
  report.push({ key, version, hash, attemptId: attempt.data.attemptId, correctQuestions: formSize, replayRejected: true, reviewResetDisabled: true });
}
const finalPlan=await request(planPath); assert.equal(finalPlan.status, 200);
const ledger=await request('/api/tutor/capability-ledger?tutorAssignmentId='+assignment); assert.equal(ledger.status, 200);
for (const key of Object.keys(expected)) {
  assert.equal(finalPlan.data.assessments.find(a=>a.assessmentKey===key)?.status, 'complete');
  if (!key.endsWith('_mastery_v1')) continue;
  const entry=(ledger.data.ledger?.deepDives || ledger.data.deepDives || []).find(d=>d.deepDiveKey===key.replace('_mastery_v1',''));
  assert.ok(entry?.evidence?.mastery?.passedAttempts>=1, 'Non-review pass missing from ledger');
}
const summary={ scope: 'six Session Infrastructure Mastery gates only', fixture: 'dedicated Proof Specialist', appSha: environment.commitSha, productionReadOnly: true, reviewMode: false, modules: report, nonReviewLedgerVerified: true };
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/session-infrastructure-live-proof.json', JSON.stringify(summary,null,2));
console.log('SESSION_INFRASTRUCTURE_LIVE_PROOF_PASS '+JSON.stringify(summary));
