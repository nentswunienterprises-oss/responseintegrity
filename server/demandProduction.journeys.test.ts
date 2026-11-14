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
    EMERGENCY_DB_MODE:'false', PAYFAST_MERCHANT_ID:'12345678', PAYFAST_MERCHANT_KEY:'abc123def4567',
    PAYFAST_SANDBOX_MERCHANT_ID:'sandbox-test', PAYFAST_SANDBOX_MERCHANT_KEY:'sandbox-test',
    PAYFAST_PASSPHRASE:'', PAYFAST_SANDBOX_PASSPHRASE:'', VAPID_PUBLIC_KEY:'', VAPID_PRIVATE_KEY:'',
  });
  const { registerRoutes } = await import('./routes.ts');
  const { setupAuth } = await import('./supabaseAuth.ts');
  const { pool } = await import('./db.ts');
  // Keep every server-side SQL path inside the isolated proof database.
  // The real route now uses the application pool for authoritative enrollment transitions.
  const originalPoolQuery = pool.query.bind(pool);
  (pool as any).query = ((text: string, params?: any[]) => db.query(text, params)) as any;
  const app = express();
  app.use(express.json());
  // Session transport is synthetic; real isAuthenticated and requireRole still run for every API.
  app.use((req:any,_res,next) => { req.session={userId:req.headers['x-proof-user'],touch(){},save(done:any){done();}}; next(); });
  const use = app.use;
  app.use = (() => app) as any; // Do not connect session storage to an external database.
  await setupAuth(app);
  app.use = use;
  await registerRoutes(app);
  const server=createServer(app);
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${(server.address() as any).port}`;
  t.after(async () => {
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    await transport.close();
    (pool as any).query = originalPoolQuery as any;
    await pool.end();
    await db.close();
  });
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
    await ok('PATCH',`/api/hr/enrollments/${e.id}/demand`,'coo',{action:'assessment',assessment:{
      parentExperience:{parentAccount:'8 individual parent experience responses recorded.',responses:Object.fromEntries(Array.from({length:8},(_,index)=>[`experience_${index+1}`,`Parent experience response ${index+1}`]))},
      supportPreferences:{parentAccount:'11 individual support preference responses recorded.',responses:Object.fromEntries(Array.from({length:11},(_,index)=>[`support_${index+1}`,`Support preference response ${index+1}`]))},
      riExplanation:{parentAccount:'RI explanation presented and parent response recorded.',scriptPresented:true,responses:{ri_parent_response:'Parent understands the distinction between understanding and independent execution.'}},
      commercialReadiness:{
        parentAccount:'Commercial readiness interview responses recorded.',
        responses:{
          existing_expenditure:'no',
          no_expenditure_reason:'Had not found an option that felt worthwhile.',
          commercial_priorities:JSON.stringify(['Individual attention','Evidence of improvement']),
          decision_authority:'Both parents decide together.',
          budget_considered:'yes',
          comfortable_monthly_range:'R1600-R2400',
          price_response:'The eight-session option is manageable.',
          continuing_commitment:'Yes, a further three months would be realistic.',
        },
        pricePresentationDelivered:true,
        meetingClosureDelivered:true,
      },
    }});
    await snapshot(user,'four-part assessment saved');
    await ok('PATCH',`/api/hr/enrollments/${e.id}/demand`,'coo',{action:'qualification',status:'qualified',ownerId:'coo',note:'Four-part assessment reviewed; fit and arrangement confirmed'});
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
    const introDrill=(await db.query("INSERT INTO intro_session_drills(student_id,tutor_id,scheduled_session_id,drill) VALUES ($1,'specialist',$2,$3) RETURNING id",[e.assigned_student_id,session.id,JSON.stringify({drillType:'diagnosis',sessionContextKind:'intro',introTopic:'Algebra',summary:{phase:'Clarity',stability:'Low'}})])).rows[0];
    await db.query(
      "INSERT INTO response_integrity_diagnosis_runs(id,student_id,tutor_id,topic,starting_phase,scheduled_session_id,session_context,status,probe_history,decision,source_drill_id,completed_at) VALUES ($1,$2,'specialist','Algebra','Clarity',$3,'intro','completed','[]'::jsonb,'{}'::jsonb,$4,now())",
      [introDrill.id,e.assigned_student_id,session.id,String(introDrill.id)],
    );
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

  await t.test('ordinary pending family remains blocked from proposal acceptance',async()=>{
    await db.query("UPDATE parents SET onboarding_type='pending' WHERE user_id='legacy'");
    const studentId='legacy-pending-student';
    await db.query("INSERT INTO students(id,parent_id,tutor_id,full_name) VALUES ($1,'legacy','specialist','Pending Learner')",[studentId]);
    const proposal=(await db.query(
      "INSERT INTO onboarding_proposals(student_id,tutor_id,parent_id,package_key) VALUES ($1,'specialist','legacy','monthly_8') RETURNING id",
      [studentId],
    )).rows[0];
    await db.query(
      "UPDATE parent_enrollments SET status='proposal_sent',current_step='proposal_sent',assigned_tutor_id='specialist',assigned_student_id=$1,proposal_id=$2 WHERE user_id='legacy'",
      [studentId,proposal.id],
    );
    const blocked=await request('POST','/api/parent/proposal/accept','legacy',{});
    assert.equal(blocked.status,409);
    assert.equal(blocked.body.message,'Application review and entry selection must be completed before proposal acceptance.');
  });

  await t.test('Sandbox proposal acceptance bypasses Demand review without fabricating qualification or entry evidence',async()=>{
    await db.query("INSERT INTO users(id,role,name,email) VALUES ('sandbox-parent','parent','Sandbox Parent','sandbox-parent@example.test')");
    await db.query("INSERT INTO parents(user_id,onboarding_type) VALUES ('sandbox-parent','pending')");
    const studentId='legacy-sandbox-student';
    await db.query("INSERT INTO students(id,parent_id,tutor_id,full_name) VALUES ($1,'sandbox-parent','specialist','Sandbox Learner')",[studentId]);
    const enrollment=(await db.query(
      "INSERT INTO parent_enrollments(user_id,parent_full_name,status,current_step,is_sandbox_account,assigned_tutor_id,assigned_student_id) VALUES ('sandbox-parent','Sandbox Parent','proposal_sent','proposal_sent',true,'specialist',$1) RETURNING id",
      [studentId],
    )).rows[0];
    const proposal=(await db.query(
      "INSERT INTO onboarding_proposals(enrollment_id,student_id,tutor_id,parent_id,package_key,package_sessions,planned_sessions_per_week,package_amount,topic_conditioning_topic,topic_conditioning_entry_phase,topic_conditioning_stability) VALUES ($1,$2,'specialist','sandbox-parent','monthly_8',8,2,1600,'Algebra','Clarity','Low') RETURNING id",
      [enrollment.id,studentId],
    )).rows[0];
    await db.query("UPDATE parent_enrollments SET proposal_id=$1 WHERE id=$2",[proposal.id,enrollment.id]);

    const prepared=await ok('POST','/api/parent/proposal/accept','sandbox-parent',{});
    assert.equal(prepared.sandbox,true);
    assert.equal(prepared.sandboxCheckout,true);
    assert.equal(prepared.paymentStatus,'UNPAID');

    const confirmed=await ok('POST','/api/parent/proposal/accept','sandbox-parent',{completeSandboxPayment:true});
    assert.equal(confirmed.paymentStatus,'PAID');
    assert.equal(confirmed.sandbox,true);

    const sandboxEnrollment=(await db.query("SELECT * FROM parent_enrollments WHERE id=$1",[enrollment.id])).rows[0];
    assert.equal(sandboxEnrollment.status,'session_booked');
    assert.equal(sandboxEnrollment.is_sandbox_account,true);
    assert.equal(sandboxEnrollment.qualification_status,'pending');
    assert.equal(sandboxEnrollment.qualification_completed_at,null);
    assert.equal(sandboxEnrollment.qualification_decided_by,null);
    assert.equal(sandboxEnrollment.entry_selected_at,null);
    assert.equal(sandboxEnrollment.entry_selected_by,null);
    assert.equal(sandboxEnrollment.handover_completed_at,null);
  });

  if(process.env.RI_DEMAND_PROOF_OUTPUT) await writeFile(process.env.RI_DEMAND_PROOF_OUTPUT,JSON.stringify(evidence,null,2)+'\n');
});
