import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_PRACTICAL_PROOFS } from "./capabilityPracticalEvidence";

test("V1 defines exactly the three approved practical proofs", () => {
  assert.deepEqual(
    CAPABILITY_PRACTICAL_PROOFS.map((proof) => proof.key),
    ["prepare", "execute", "evidence"],
  );
});

test("every practical proof is versioned, sandbox-only and carries observable requirements", () => {
  for (const proof of CAPABILITY_PRACTICAL_PROOFS) {
    assert.equal(proof.version, 1);
    assert.equal(proof.realStudentDataAllowed, false);
    assert.ok(proof.mustShow.length >= 5);
    assert.ok(proof.declarationPrompts.length >= 3);
    assert.ok(proof.competencyLinks.length >= 3);
    assert.ok(proof.declarationPrompts.every((prompt) => prompt.minLength >= 30));
  }
});

test("Prepare and Evidence require a screen-based artifact rather than talking-head video alone", () => {
  const prepare = CAPABILITY_PRACTICAL_PROOFS.find((proof) => proof.key === "prepare");
  const evidence = CAPABILITY_PRACTICAL_PROOFS.find((proof) => proof.key === "evidence");
  assert.ok(prepare);
  assert.ok(evidence);
  assert.equal(prepare.requiredArtifactTypes.includes("video"), false);
  assert.equal(evidence.requiredArtifactTypes.includes("video"), false);
  assert.ok(prepare.requiredArtifactTypes.includes("screen_voice"));
  assert.ok(evidence.requiredArtifactTypes.includes("screen_voice"));
});

test("Execute requires visible demonstration and does not accept audio-over-screen alone", () => {
  const execute = CAPABILITY_PRACTICAL_PROOFS.find((proof) => proof.key === "execute");
  assert.ok(execute);
  assert.equal(execute.requiredArtifactTypes.includes("screen_voice"), false);
  assert.ok(execute.requiredArtifactTypes.includes("screen_video"));
  assert.ok(execute.requiredArtifactTypes.includes("video"));
});
