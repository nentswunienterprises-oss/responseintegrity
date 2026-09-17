import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemandDatabase } from './testing/demandDatabase';
import { demandAssignmentBlock, handoverSla } from '../shared/demandProduction';
import { buildProductionEconomy } from './productionEconomy';

test('Demand migration, compatibility and database integrity boundaries', async (t) => {
  const { db, migration } = await createDemandDatabase();
  t.after(() => db.close());
  const row = async (user: string) => (await db.query('SELECT * FROM parent_enrollments WHERE user_id=$1',[user])).rows[0];
  const command = (id: string, action: string, status: string | null = null, owner: string | null = null, entry: string | null = null, note: string | null = null, actor = 'coo') =>
    db.query('SELECT update_demand_production($1,$2,$3,$4,$5,$6,$7)', [id,actor,action,status,owner,entry,note]);
  await t.test('migration is repeatable; legacy evidence stays unknown and live Pilot remains usable', async () => {
    await db.exec(migration);
    const legacy = await row('legacy');
    assert.equal(legacy.demand_flow_version,0); assert.equal(legacy.qualification_status,null);
    assert.equal(legacy.qualification_completed_at,null); assert.equal(legacy.handover_completed_at,null);
    assert.equal(demandAssignmentBlock(legacy),null);
    assert.equal((await db.query("SELECT onboarding_type FROM parents WHERE user_id='legacy'")).rows[0].onboarding_type,'pilot');
    await db.exec("UPDATE parent_enrollments SET status='session_booked' WHERE user_id='legacy'");
    await assert.rejects(command(legacy.id,'qualification','qualified','coo',null,'Invented history'),/Historical/);
  });
  await db.exec("INSERT INTO users(id,role) VALUES ('new','parent'),('rejected','parent'); INSERT INTO parents(user_id) VALUES ('new'),('rejected'); INSERT INTO parent_enrollments(user_id) VALUES ('new'),('rejected');");
  const fresh = await row('new');
  await t.test('new application starts pending, undecided and cannot skip the qualified gate', async () => {
    assert.equal(fresh.qualification_status,'pending'); assert.equal(fresh.demand_flow_version,1);
    assert.equal((await db.query("SELECT onboarding_type FROM parents WHERE user_id='new'")).rows[0].onboarding_type,'pending');
    for (const entry of ['pilot','commercial']) await assert.rejects(command(fresh.id,'entry',null,null,entry),/Qualify/);
    await assert.rejects(db.exec("UPDATE parent_enrollments SET assigned_tutor_id='specialist' WHERE user_id='new'"),/required before assignment/);
    await assert.rejects(db.exec("UPDATE parent_enrollments SET demand_flow_version=0 WHERE user_id='new'"),/cannot be changed/);
    await assert.rejects(db.exec("UPDATE parent_enrollments SET is_sandbox_account=true WHERE user_id='new'"),/Sandbox exemption/);
  });
  await t.test('qualification state, owner, contact and decision evidence persist with actor validation', async () => {
    await command(fresh.id,'qualification','contact_required','coo',null,'Call requested');
    await command(fresh.id,'qualification','contacted','coo',null,'Phone assessment');
    const contacted = await row('new'); assert.ok(contacted.qualification_contacted_at);
    await command(fresh.id,'qualification','follow_up','coo',null,'Confirm availability');
    assert.equal((await row('new')).qualification_contacted_at.getTime(),contacted.qualification_contacted_at.getTime());
    await assert.rejects(command(fresh.id,'qualification','qualified','coo',null,null),/requires owner/);
    await assert.rejects(command(fresh.id,'qualification','qualified','coo',null,'Fit confirmed','new'),/authorized staff/);
    await command(fresh.id,'qualification','qualified','coo',null,'Fit and availability confirmed');
    const qualified = await row('new'); assert.equal(qualified.qualification_decided_by,'coo'); assert.ok(qualified.qualification_completed_at);
    await assert.rejects(command(fresh.id,'qualification','pending'),/already completed/);
  });
  await t.test('entry and handover require distinct recipient and next-action evidence; assignment then opens', async () => {
    await assert.rejects(command(fresh.id,'handover',null,'recipient',null,'Assign'),/entry must be selected/);
    await command(fresh.id,'entry',null,null,'commercial');
    await assert.rejects(command(fresh.id,'handover',null,'coo',null,'Assign'),/distinct receiving/);
    await assert.rejects(command(fresh.id,'handover',null,'new',null,'Assign'),/existing staff/);
    await assert.rejects(command(fresh.id,'handover',null,'recipient'),/next action/);
    await command(fresh.id,'handover',null,'recipient',null,'Recipient accepted; assign next available specialist');
    const handed = await row('new'); assert.equal(handed.handover_to_user_id,'recipient'); assert.equal(handed.handover_from_user_id,'coo');
    assert.ok(handed.handover_completed_at); assert.equal(handed.current_step,'awaiting-assignment'); assert.equal(demandAssignmentBlock(handed),null);
    assert.equal(handoverSla(handed).status,'within_standard');
    await db.exec("UPDATE parent_enrollments SET assigned_tutor_id='specialist',status='awaiting_tutor_acceptance' WHERE user_id='new'");
    await assert.rejects(db.exec("UPDATE parents SET onboarding_type='pilot' WHERE user_id='new'"),/already been decided/);
  });
  await t.test('not qualified is terminal and cannot be assigned or handed over', async () => {
    const rejected = await row('rejected');
    await command(rejected.id,'qualification','not_qualified','coo',null,'Outside supported intake');
    await assert.rejects(command(rejected.id,'entry',null,null,'pilot'),/Qualify/);
    await assert.rejects(command(rejected.id,'handover',null,'recipient',null,'Assign'),/entry must be selected/);
    await assert.rejects(db.exec("UPDATE parent_enrollments SET status='confirmed' WHERE user_id='rejected'"),/required before assignment/);
  });
  await t.test('24-hour SLA uses persisted qualification and transfer timestamps, including pending breaches', () => {
    const e = { qualification_status:'qualified',qualification_completed_at:'2026-09-01T10:00:00Z' };
    assert.equal(handoverSla(e,new Date('2026-09-02T10:00:00Z')).status,'pending');
    assert.equal(handoverSla(e,new Date('2026-09-02T10:00:01Z')).status,'breached');
    assert.equal(handoverSla({...e,handover_completed_at:'2026-09-02T11:00:00Z'}).hours,25);
    assert.equal(handoverSla({}).status,'not_measurable');
  });
  await t.test('first code, original source and campaign cannot be overwritten', async () => {
    await db.exec("UPDATE users SET production_link_code='DEMAND01',tracking_source='community',tracking_campaign='September' WHERE id='new'");
    for (const update of ["production_link_code='DEMAND02'","production_link_code=NULL","tracking_source='stolen'","tracking_campaign='October'"]) {
      await assert.rejects(db.exec(`UPDATE users SET ${update} WHERE id='new'`),/cannot be reassigned/);
    }
  });
  await t.test('client roles cannot invoke the internal decision RPC or write station evidence', async () => {
    await db.exec('GRANT SELECT,UPDATE ON parent_enrollments TO authenticated; SET ROLE authenticated;');
    try {
      await assert.rejects(command(fresh.id,'entry',null,null,'pilot'),/permission denied/);
      await assert.rejects(db.exec("UPDATE parent_enrollments SET qualification_note='spoof' WHERE user_id='new'"),/require the server/);
    } finally { await db.exec('RESET ROLE'); }
  });
});

test('metrics require payment plus accepted/unlocked service and keep free Pilot separate', () => {
  const base:any = { links:[], applications:[],users:[],assignments:[],trialCases:[],trialPlacements:[],closes:[],
    leads:[{id:'l',user_id:'p',production_link_code:'DEMAND01'}],
    enrollments:[{id:'e',user_id:'p',proposal_id:'q',demand_flow_version:0,status:'confirmed'}],
    parents:[{user_id:'p',onboarding_type:'pilot'}],
    proposals:[{id:'q',enrollment_id:'e',accepted_at:'2026-09-01',student_id:'s',tutor_id:'t'}], payments:[] };
  const metrics=(data:any) => buildProductionEconomy(data).summary.demand;
  assert.equal(metrics(base).pilotEntry,1); assert.equal(metrics(base).verifiedConversions,0);
  const commercial={...base,parents:[{user_id:'p',onboarding_type:'commercial'}]};
  assert.equal(metrics(commercial).commercialEntry,0);
  const paid={...commercial,payments:[{enrollment_id:'e',parent_id:'p',proposal_id:'q',provider:'payfast',payment_status:'paid',paid_at:'2026-09-01',amount:1600}]};
  assert.equal(metrics(paid).verifiedConversions,1);
  assert.equal(metrics({...paid,proposals:[]}).verifiedConversions,0);
  assert.equal(metrics({...paid,enrollments:[{...base.enrollments[0],status:'proposal_sent'}]}).verifiedConversions,0);
  assert.equal(metrics({...paid,payments:undefined}).verifiedConversions,null);
  assert.equal(metrics({...paid,leads:[...base.leads,{...base.leads[0],id:'duplicate'}]}).captured,1);
});
