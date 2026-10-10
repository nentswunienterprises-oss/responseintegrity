import test from "node:test";
import assert from "node:assert/strict";
import {
 CAPABILITY_PRACTICAL_PROOFS,
 deriveCapabilityPracticalReview,
 validateCapabilityPracticalRubric,
 type CapabilityPracticalCriterionReviewInput,
} from "./capabilityPracticalEvidence";

test("current Practicals retain valid competency and integrity-boundary lineage",()=>{
 assert.deepEqual(CAPABILITY_PRACTICAL_PROOFS.map(p=>p.key),["prepare","execute","evidence"]);
 for(const proof of CAPABILITY_PRACTICAL_PROOFS) {
  assert.ok(validateCapabilityPracticalRubric(proof.reviewRubric));
  assert.ok(proof.reviewRubric.criteria.length>=5);
 }
 const execute=CAPABILITY_PRACTICAL_PROOFS[1];
 assert.equal(execute.version,2);
 assert.equal(execute.reviewRubric.version,2);
 assert.ok(execute.mustShow.some(x=>x.includes("system")||x.includes("turn")));
 assert.ok(execute.reviewRubric.criteria.some(c=>c.key==="adaptive_turn_integrity"));
 assert.ok(execute.reviewRubric.criteria.some(c=>c.key==="observability_interruptions"&&c.criticalOnFail));
});

test("human judges all criteria, system derives outcome; ordinary weaknesses require repeat",()=>{
 const proof=CAPABILITY_PRACTICAL_PROOFS[1];
 const clear:CapabilityPracticalCriterionReviewInput[]=proof.reviewRubric.criteria.map(c=>({criterionKey:c.key,judgment:"clear"}));
 assert.equal(deriveCapabilityPracticalReview(proof.reviewRubric,clear).outcome,"approved");
 const ordinary=proof.reviewRubric.criteria.find(c=>!c.criticalOnFail)!;
 const weakness=clear.map(c=>c.criterionKey===ordinary.key
  ? {...c,judgment:"partial" as const,evidenceNote:"The recorded action did not fully preserve the specified condition."}
  : c);
 const review=deriveCapabilityPracticalReview(proof.reviewRubric,weakness);
 assert.equal(review.outcome,"repeat_required");
 assert.equal(review.partialCount,1);
 assert.equal(review.criticalFailCount,0);
});

test("a critical failure cannot be averaged into an ordinary repeat or approval",()=>{
 const proof=CAPABILITY_PRACTICAL_PROOFS[1];
 const critical=proof.reviewRubric.criteria.find(c=>c.criticalOnFail)!;
 const judgments:CapabilityPracticalCriterionReviewInput[]=proof.reviewRubric.criteria.map(c=>({
  criterionKey:c.key,judgment:c.key===critical.key?"fail":"clear",
  ...(c.key===critical.key?{evidenceNote:"The recorded evidence contradicted a critical RI integrity boundary."}:{}),
 }));
 const outcome=deriveCapabilityPracticalReview(proof.reviewRubric,judgments);
 assert.equal(outcome.outcome,"integrity_review");
 assert.equal(outcome.criticalFailCount,1);
 assert.deepEqual(outcome.criticalFailCriterionKeys,[critical.key]);
});

test("missing, duplicate or unsupported judgments fail closed",()=>{
 const proof=CAPABILITY_PRACTICAL_PROOFS[1];
 const clear:CapabilityPracticalCriterionReviewInput[]=proof.reviewRubric.criteria.map(c=>({criterionKey:c.key,judgment:"clear"}));
 assert.throws(()=>deriveCapabilityPracticalReview(proof.reviewRubric,clear.slice(1)),/Expected/);
 assert.throws(()=>deriveCapabilityPracticalReview(proof.reviewRubric,[...clear.slice(0,-1),clear[0]]),/Duplicate/);
 const first=proof.reviewRubric.criteria[0].key;
 assert.throws(()=>deriveCapabilityPracticalReview(proof.reviewRubric,
   clear.map(c=>c.criterionKey===first?{...c,judgment:"fail",evidenceNote:"short"}:c)),/20/);
});
