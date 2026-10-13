import assert from "node:assert/strict";
import pg from "pg";
import { assertCapabilityOptionParity } from "../shared/capabilityOptionParity.ts";
import { assertNoSupersededEvidenceScenario } from "../shared/evidenceExceptionAuthoringGuard.ts";
import { validateCapabilityAssessmentAgainstBlueprint } from "../shared/capabilityBankCoverage.ts";
import { buildCapabilityCriticalBoundaryRequirements } from "../shared/capabilityCriticalCoverage.ts";

const proofUrl=[
  process.env.RI_PROOF_DATABASE_URL,
  process.env.RI_PROOF_DB_URL,
  process.env.PROOF_DATABASE_URL,
  process.env.SUPABASE_PROOF_DATABASE_URL,
].map(value=>String(value||"").trim()).find(value=>value.includes("jftlxeacphvbnhbsbpxc"))||"";
assert.ok(proofUrl.includes("jftlxeacphvbnhbsbpxc"),"Only Capability Proof is permitted.");
const targets=[
  "handover_verification_mastery_v1",
  "how_the_system_resolves_uncertainty_mastery_v1",
  "how_to_diagnose_mastery_v1",
  "how_to_interpret_prompts_mastery_v1",
  "intro_session_structure_mastery_v1",
  "logging_system_mastery_v1",
  "operating_system_retrieval_v2",
  "operating_system_transfer_v2",
  "what_not_to_do_mastery_v1",
];
const client=new pg.Client({connectionString:proofUrl,ssl:{rejectUnauthorized:true}});
try {
  await client.connect();
  const audit=[];
  let totalChanged=0;
  for(const assessmentKey of targets){
    const configRows=await client.query(
      "SELECT * FROM private.specialist_capability_assessment_configs WHERE assessment_key=$1 ORDER BY bank_version DESC",
      [assessmentKey],
    );
    assert.ok(configRows.rows.length>=2,assessmentKey+" has no staged version");
    const staged=configRows.rows[0];
    const live=configRows.rows.find(row=>row.active===true);
    assert.ok(live && staged.bank_version>live.bank_version);
    assert.equal(staged.active,false,assessmentKey+" was prematurely activated");
    assert.equal(staged.review_mode,false,assessmentKey+" review authority changed");
    const read=async version=>(await client.query(
      "SELECT * FROM private.specialist_capability_assessment_items WHERE assessment_key=$1 AND bank_version=$2 ORDER BY item_key",
      [assessmentKey,version],
    )).rows;
    const original=await read(live.bank_version);
    const revised=await read(staged.bank_version);
    assert.equal(revised.length,original.length,"Staged bank pool size changed");
    const prior=new Map(original.map(x=>[x.item_key,x]));
    const itemShapes=[];
    let bankChanged=0;
    for(const item of revised){
      const prev=prior.get(item.item_key);
      assert.ok(prev,item.item_key+" newly invented or source missing");
      for(const unaltered of ["competency_key","deep_dive_key","question_kind","correct_option_keys","critical_fail_option_keys","critical_boundary_keys","active"]){
        assert.deepEqual(item[unaltered],prev[unaltered],item.item_key+" changed authority field "+unaltered);
      }
      assert.ok(item.active);
      if (
        item.prompt!==prev.prompt ||
        JSON.stringify(item.options)!==JSON.stringify(prev.options) ||
        item.explanation!==prev.explanation ||
        JSON.stringify(item.option_feedback)!==JSON.stringify(prev.option_feedback)
      )bankChanged++;
      const form={key:item.item_key,prompt:item.prompt,kind:item.question_kind,options:item.options,correctOptionKeys:item.correct_option_keys};
      const wrong=item.options.filter(x=>!new Set(item.correct_option_keys).has(x.key));
      if(item.question_kind==="single_choice"){
        assert.equal(item.options.length,5,item.item_key+" invalid option count");
        assert.ok(item.correct_option_keys.length===1||item.correct_option_keys.length===2);
        assert.ok(wrong.every(x=>String(item.option_feedback?.[x.key]||"").trim()),
          item.item_key+" missing specific wrong feedback");
      }
      if(item.question_kind==="multi_select"){
        assert.ok(item.options.length>=5&&item.correct_option_keys.length>=2);
      }
      if(item.question_kind==="sequence")assert.ok(item.options.length>=4);
      const copy=[item.prompt,item.explanation,...item.options.map(x=>x.label),...Object.values(item.option_feedback||{})].join(" ");
      assertNoSupersededEvidenceScenario({
        assessmentKey,itemKey:item.item_key,competencyKey:item.competency_key,text:copy
      });
      itemShapes.push(form);
    }
    assertCapabilityOptionParity(assessmentKey,itemShapes);
    const blueprint=validateCapabilityAssessmentAgainstBlueprint({
      assessmentKey,
      assessmentDeepDiveKey:staged.assessment_deep_dive_key,
      evidenceKind:staged.evidence_kind,
      formSize:staged.form_size,
      passThresholdPercent:Number(staged.pass_threshold_percent),
      enforceMvpPlan:true,
      competencyBlueprint:staged.competency_blueprint,
      items:revised.map(x=>({
        competencyKey:x.competency_key,
        deepDiveKey:x.deep_dive_key,
        prompt:x.prompt,
        kind:x.question_kind,
        correctOptionKeys:x.correct_option_keys,
        criticalFailOptionKeys:x.critical_fail_option_keys,
        criticalBoundaryKeys:x.critical_boundary_keys,
      }))
    });
    assert.ok(blueprint);
    const boundary=buildCapabilityCriticalBoundaryRequirements(assessmentKey);
    assert.ok(boundary.length>=0);
    const attempts=await client.query(
      "SELECT count(*)::int n FROM public.specialist_capability_assessment_attempts WHERE assessment_key=$1 AND bank_version=$2",
      [assessmentKey,staged.bank_version]
    );
    assert.equal(attempts.rows[0].n,0,"Staged bank has live assessment attempts");
    totalChanged+=bankChanged;
    audit.push({key:assessmentKey,from:live.bank_version,to:staged.bank_version,items:revised.length,changed:bankChanged});
    console.log("EVIDENCE_BANK_QUALITY_PASS="+JSON.stringify(audit.at(-1)));
  }
  assert.equal(audit.length,9);
  assert.equal(totalChanged,35);
  console.log("OS_WIDE_EXCEPTION_BANK_QUALITY=PASS "+JSON.stringify({project:"Capability Proof",totalChanged,banks:audit}));
}finally{await client.end();}
