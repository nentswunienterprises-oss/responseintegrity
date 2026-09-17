import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { createDemandDatabase, serveDemandDatabase } from './testing/demandDatabase';

test('real HTTP signup → Gateway → qualification → handover → assignment → proposal → service journeys', async (t) => {
  const { db } = await createDemandDatabase();
  const transport = await serveDemandDatabase(db);
  // Every external service endpoint is synthetic or disabled. No production credentials are read.
  Object.assign(process.env, {
    SUPABASE_URL:transport.url, SUPABASE_ANON_KEY:'isolated-test', SUPABASE_SERVICE_ROLE_KEY:'isolated-test',
    DATABASE_URL:'postgresql://test:test@127.0.0.1:1/test', SESSION_SECRET:'isolated-proof-session',
    EMERGENCY_DB_MODE:'false', PAYFAST_MERCHANT_ID:'sandbox-test', PAYFAST_MERCHANT_KEY:'sandbox-test',
    PAYFAST_SANDBOX_MERCHANT_ID:'sandbox-test', PAYFAST_SANDBOX_MERCHANT_KEY:'sandbox-test',
    PAYFAST_PASSPHRASE:'', PAYFAST_SANDBOX_PASSPHRASE:'', VAPID_PUBLIC_KEY:'', VAPID_PRIVATE_KEY:'',
  });
  const { registerRoutes } = await import('./routes.ts');
  const { setupAuth } = await import('./supabaseAuth.ts');
  const { pool } = await import('./db.ts');
  const app = express();
  app.use(express.json());
  // Only the session transport is substituted; real isAuthenticated and requireRole run for every API.
  app.use((req:any,_res,next) => { req.session={userId:req.headers['x-proof-user'],touch(){},save(done:any){done();}}; next(); });
  const use = app.use;
  app.use = (() => app) as any; // Do not connect session storage to an external database.
  await setupAuth(app);
  app.use = use;
  await registerRoutes(app);
  const server=createServer(app);
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${(server.address() as any).port}`;
  t.after(async () => { await new Promise<void>(resolve=>server.close(()=>resolve())); await transport.close(); await pool.end(); await db.close(); });
  const request=async (method:string,path:string,user?:string,body?:any) => {
    const response=await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(user?{'x-proof-user':user}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,body:await response.json()};
  };
  const ok=async (method:string,path:string,user?:string,body?:any) => {
    const response=await request(method,path,user,body); assert.equal(response.status,200,JSON.stringify(response.body)); return response.body;
  };
  const rows=async (table:string) => (await db.query(`SELECT * FROM ${table}`)).rows;
  const enrollment=async (user:string) => (await db.query('SELECT * FROM parent_enrollments WHERE user_id=$1',[user])).rows[0];
  const evidence:any[]=[];
  const snapshot=async (user:string,station:string) => {
    const account=(await db.query('SELECT production_link_code FROM users WHERE id=$1',[user])).rows[0];
    const lead=(await db.query('SELECT production_link_code FROM leads WHERE user_id=$1',[user])).rows[0];
    const e=await enrollment(user);
    const parent=(await db.query('SELECT onboarding_type,affiliate_code FROM parents WHERE user_id=$1',[user])).rows[0];
    assert.equal(account.production_link_code,'DEMAND01'); assert.equal(lead.production_link_code,'DEMAND01'); assert.equal(parent.affiliate_code,'DEMAND01');
    evidence.push({journey:user,station,code:account.production_link_code,leadCode:lead.production_link_code,parentCode:parent.affiliate_code,
      qualification:e?.qualification_status||null,entryType:parent.onboarding_type,handoverRecipient:e?.handover_to_user_id||null,
      handoverAt:e?.handover_completed_at||null,status:e?.status||null,assignmentLane:e?.assignment_lane||null});
  };
  await t.test('Capacity link rejected for parents; unauthorized staff mutations rejected',async()=>{
    const rejected=await request('POST','/api/auth/signup',undefined,{email:'wrong@example.test',password:'test-only-password',role:'parent',production_link_code:'CAPACITY01',production_pipeline:'capacity'});
    assert.equal(rejected.status,400);
    assert.equal((await request('PATCH','/api/hr/enrollments/none/demand',undefined,{action:'entry',entryType:'pilot'})).status,401);
  });
  await t.test('organic signup stays undecided and Gateway review remains simple',async()=>{
    await ok('POST','/api/auth/signup',undefined,{email:'organic@example.test',password:'test-only-password',role:'parent',first_name:'Organic'});
    const parent=(await db.query("SELECT * FROM parents WHERE user_id='organic'")).rows[0];
    assert.equal(parent.onboarding_type,'pending'); assert.equal(parent.affiliate_code,null);
    assert.equal((await db.query("SELECT production_link_code FROM leads WHERE user_id='organic'")).rows[0].production_link_code,null);
  });
  for (const entry of ['commercial','pilot']) await t.test(`${entry} journey retains first-touch through verified service entry`,async()=>{
    const user=entry;
    await ok('POST','/api/auth/signup',undefined,{email:`${user}@example.test`,password:'test-only-password',role:'parent',first_name:'Proof',last_name:entry,production_link_code:'DEMAND01',production_pipeline:'demand',tracking_source:'community',tracking_campaign:'September'});
    await snapshot(user,'signup');
    const application={parentFullName:`Proof ${entry}`,parentPhone:'0000000000',parentEmail:`${user}@example.test`,parentCity:'Test',studentFullName:`Learner ${entry}`,studentGrade:'10',studentGender:'Other',schoolName:'Test school',previousTutoring:'no',internetAccess:'yes',agreedToTerms:true,topicResponseSymptoms:{Algebra:['question_confusion']},onboardingType:'pilot'};
    await ok('POST','/api/parent/enroll',user,application);
    let e=await enrollment(user); assert.equal(e.qualification_status,'pending');
    await snapshot(user,'Gateway submitted');
    const review=await ok('GET','/api/parent/enrollment-status',user);
    assert.equal(review.status,'awaiting_assignment'); assert.equal(review.onboardingType,'pending'); assert.equal(review.paymentStatus,null);
    const steal=await request('POST','/api/auth/oauth-profile',undefined,{user_id:user,email:`${user}@example.test`,role:'parent',production_link_code:'DEMAND02',production_pipeline:'demand'});
    assert.ok(steal.status>=400); await snapshot(user,'later link rejected');
    assert.equal((await request('PATCH',`/api/hr/enrollments/${e.id}/demand`,user,{action:'entry',entryType:entry})).status,403);
    assert.equal((await request('POST',`/api/hr/enrollments/${e.id}/assign-tutor`,'coo',{tutorId:'specialist',podId:'pod'})).status,409);
    await ok('PATCH',`/api/hr/enrollments/${e.id}/demand`,'coo',{action:'qualification',status:'contacted',ownerId:'coo',note:'Parent contacted'});
    await snapshot(user,'contacted');
    await ok('PATCH',`/api/hr/enrollments/${e.id}/demand`,'coo',{action:'qualification',status:'qualified',ownerId:'coo',note:'Fit and arrangement confirmed'});
    await snapshot(user,'qualified');
    await ok('PATCH',`/api/hr/enrollments/${e.id}/demand`,'coo',{action:'entry',entryType:entry});
    await snapshot(user,'entry deliberately selected');
    await ok('PATCH',`/api/hr/enrollments/${e.id}/demand`,'coo',{action:'handover',ownerId:'recipient',note:'Recipient accepted; arrange specialist assignment'});
    await snapshot(user,'handover completed');
    await ok('POST',`/api/hr/enrollments/${e.id}/assign-tutor`,'coo',{tutorId:'specialist',podId:'pod'});
    e=await enrollment(user); assert.ok(e.assigned_student_id); assert.equal(e.assignment_lane,'commercial');
    await snapshot(user,'assigned to Certified Live lane');
    // Fixture supplies the existing Specialist intro evidence; no conditioning engine changes are under test.
    await db.query('UPDATE students SET personal_profile=$1 WHERE id=$2',[JSON.stringify({workflow:{assignmentAcceptedAt:new Date().toISOString()}}),e.assigned_student_id]);
    const session=(await db.query("INSERT INTO scheduled_sessions(parent_id,student_id,tutor_id,type,status) VALUES ($1,$2,'specialist','intro','confirmed') RETURNING id",[user,e.assigned_student_id])).rows[0];
    await db.query("INSERT INTO intro_session_drills(student_id,tutor_id,scheduled_session_id,drill) VALUES ($1,'specialist',$2,$3)",[e.assigned_student_id,session.id,JSON.stringify({drillType:'diagnosis',sessionContextKind:'intro',introTopic:'Algebra',summary:{phase:'Clarity',stability:'Low'}})]);
    await ok('POST','/api/tutor/proposal','specialist',{studentId:e.assigned_student_id,enrollmentId:e.id,recommendedPlan:'Monthly package',justification:'Evidence-based entry',packageKey:'monthly_8'});
    await snapshot(user,'proposal sent');
    const accepted=await ok('POST','/api/parent/proposal/accept',user,{});
    if(entry==='commercial') {
      assert.equal(accepted.paymentStatus,'UNPAID'); assert.equal(accepted.amount,1600); assert.equal(accepted.tutorShare,1040); assert.equal(accepted.platformShare,560);
      // Use the existing explicit sandbox confirmation route against this isolated payment row.
      await db.query("UPDATE payment_transactions SET raw_payload=raw_payload || '{\"payfast_mode\":\"sandbox\"}'::jsonb WHERE parent_id=$1",[user]);
      const confirmed=await ok('POST','/api/parent/payments/payfast/sandbox-confirm',user,{merchantReference:accepted.merchantReference});
      assert.equal(confirmed.paymentStatus,'PAID');
    } else { assert.equal(accepted.paymentStatus,'FREE_ACCESS'); assert.equal((await rows('payment_transactions')).filter((p:any)=>p.parent_id===user).length,0); }
    await snapshot(user,'service unlocked');
    const economy=await ok('GET','/api/coo/production-economy','coo');
    const lineage=economy.demandLineages.find((l:any)=>l.parentId===user);
    assert.equal(lineage.evidence.verifiedServiceEntry,true); assert.equal(lineage.evidence.verifiedConversions,entry==='commercial');
    assert.equal(lineage.enrollment.assignment_lane,'commercial');
  });
  if(process.env.RI_DEMAND_PROOF_OUTPUT) await writeFile(process.env.RI_DEMAND_PROOF_OUTPUT,JSON.stringify(evidence,null,2)+'\n');
});
