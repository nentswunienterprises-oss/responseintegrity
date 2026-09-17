from pathlib import Path

path = Path("shared/responseSnapshot.test.ts")
text = path.read_text()
old = '''test("inherited verification snapshots use verification evidence while targeted re-diagnosis uses diagnosis evidence", () => {
  const verificationSet = buildSubmittedSetByPattern({
    mode: "verification",
    phase: "Structured Execution",
    setName: "Cold Start",
    pattern: "PPP",
  });
  const verificationSnapshot = buildResponseSnapshotV1({
    sourceDrillId: "inherited-verification",
    topic: "Linear Equations",
    mode: "inherited_verification",
    phase: "Structured Execution",
    sets: [verificationSet],
    drillScore: 55,
    setScores: [55],
  });
  assert.equal(verificationSnapshot.source.mode, "inherited_verification");
  assert.equal(verificationSnapshot.sets[0].setName, "Cold Start");

  const diagnosisSet = buildSubmittedSetByPattern({
    mode: "diagnosis",
    phase: "Structured Execution",
    setName: "Cold Start",
    pattern: "SSS",
  }) as SubmittedEvidenceSet & { phase: TopicPhase };
'''
new = '''test("inherited verification snapshots use verification evidence while targeted re-diagnosis uses diagnosis evidence", () => {
  const verificationSetName = getDrillSchemaDefinition("verification", "Structured Execution").sets[0].setName;
  const verificationSet = buildSubmittedSetByPattern({
    mode: "verification",
    phase: "Structured Execution",
    setName: verificationSetName,
    pattern: "PPP",
  });
  const verificationSnapshot = buildResponseSnapshotV1({
    sourceDrillId: "inherited-verification",
    topic: "Linear Equations",
    mode: "inherited_verification",
    phase: "Structured Execution",
    sets: [verificationSet],
    drillScore: 55,
    setScores: [55],
  });
  assert.equal(verificationSnapshot.source.mode, "inherited_verification");
  assert.equal(verificationSnapshot.sets[0].setName, verificationSetName);

  const diagnosisSetName = getDrillSchemaDefinition("diagnosis", "Structured Execution").sets[0].setName;
  const diagnosisSet = buildSubmittedSetByPattern({
    mode: "diagnosis",
    phase: "Structured Execution",
    setName: diagnosisSetName,
    pattern: "SSS",
  }) as SubmittedEvidenceSet & { phase: TopicPhase };
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f"expected one generated snapshot test block, found {count}")
path.write_text(text.replace(old, new, 1))
print("Stage 2 snapshot test fixture fixed")
