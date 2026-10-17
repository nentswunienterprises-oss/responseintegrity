import assert from "node:assert/strict";
import { test } from "node:test";
import { sandboxQualificationEvidenceFingerprint as fingerprint } from "./sandboxQualificationFingerprint";
import type { SandboxQualificationEvidence } from "../shared/sandboxQualificationPolicy";

const event: SandboxQualificationEvidence = {
 id:"event-1",occurredAt:"2026-10-16T00:00:00.000Z",kind:"opportunity",mode:"training",
 studentId:"student-1",trajectoryId:"trajectory-1",phase:"Clarity",profile:"quietly_strong",
 situationTags:["independent_execution","profile_signature"],opportunityKey:"rep-1",observed:true,
 complete:true,canonicalPresent:true,conditionKept:true,observationExact:true,evidenceExact:true,
 authorityAligned:true,stateAligned:true,materialError:false,technicallyValid:true,
 sourceId:"source-1",sourceType:"training_rep",bankVersion:1,outcomeVersion:1,
};
const hash = (events: SandboxQualificationEvidence[]) => fingerprint("policy",1,events);

test("every qualification input invalidates a prior evidence fingerprint", () => {
 const original=hash([event]);
 for(const key of Object.keys(event) as (keyof SandboxQualificationEvidence)[]){
   const value=event[key];
   const changed=Array.isArray(value)?[...value,"routing"]:
     typeof value==="boolean"?!value:typeof value==="number"?value+1:String(value)+"-changed";
   assert.notEqual(hash([{...event,[key]:changed}]),original,key);
 }
 assert.notEqual(fingerprint("other-policy",1,[event]),original);
 assert.notEqual(fingerprint("policy",2,[event]),original);
 assert.notEqual(hash([event,{...event,id:"event-2"}]),original);
});

test("query order, object key order and tag order preserve the fingerprint", () => {
 const other={...event,id:"event-2"};
 const reordered=Object.fromEntries(Object.entries(event).reverse()) as SandboxQualificationEvidence;
 reordered.situationTags=[...event.situationTags].reverse();
 assert.equal(hash([event,other]),hash([other,reordered]));
 assert.match(hash([event]),/^[a-f0-9]{64}$/);
});
