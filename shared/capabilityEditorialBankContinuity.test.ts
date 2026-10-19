import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CAPABILITY_EDITORIAL_PASS_CONTINUITY, countsAsEditoriallyEquivalentPass } from "./capabilityEditorialBankContinuity";

test("all reviewed rollovers preserve earned passes only from their exact approved predecessor", () => {
  const inventory=JSON.parse(fs.readFileSync("docs/qualification-content/20261013_evidence_exception_reviewed_inventory.json","utf8"));
  const banks=new Map<string,any>(inventory.changedItems.map((item:any)=>[item.assessmentKey,item]));
  assert.equal(banks.size,9);
  for(const [assessmentKey,item] of banks){
    const lineage=CAPABILITY_EDITORIAL_PASS_CONTINUITY[assessmentKey as keyof typeof CAPABILITY_EDITORIAL_PASS_CONTINUITY];
    assert.deepEqual(lineage,{previous:item.sourceVersion,current:item.stagedVersion});
    const input={assessmentKey,previousBankVersion:item.sourceVersion,currentBankVersion:item.stagedVersion,passed:true};
    assert.equal(countsAsEditoriallyEquivalentPass(input),true,assessmentKey);
    assert.equal(countsAsEditoriallyEquivalentPass({...input,passed:false}),false);
    assert.equal(countsAsEditoriallyEquivalentPass({...input,previousBankVersion:item.sourceVersion-1}),false);
    assert.equal(countsAsEditoriallyEquivalentPass({...input,currentBankVersion:item.stagedVersion+1}),false);
    assert.equal(countsAsEditoriallyEquivalentPass({...input,assessmentKey:"unrelated_mastery_v1"}),false);
  }
});
