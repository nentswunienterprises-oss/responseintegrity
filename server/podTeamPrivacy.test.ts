import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "client/src/pages/operational/tutor/pod.tsx"),
  "utf8",
);

test("Specialist Pod team view exposes names only", () => {
  assert.match(source, /<DialogTitle>Pod Team<\/DialogTitle>/);
  assert.match(source, /Pod team view shows names only\. Contact and profile details remain private\./);

  assert.doesNotMatch(source, /podTeamData\.territoryDirector\.email/);
  assert.doesNotMatch(source, /podTeamData\.territoryDirector\.phone/);
  assert.doesNotMatch(source, /podTeamData\.territoryDirector\.bio/);
  assert.doesNotMatch(source, /selectedTeamMember\.email/);
  assert.doesNotMatch(source, /selectedTeamMember\.phone/);
  assert.doesNotMatch(source, /selectedTeamMember\.school/);
  assert.doesNotMatch(source, /selectedTeamMember\.grade/);
  assert.doesNotMatch(source, /selectedTeamMember\.certificationStatus/);
  assert.doesNotMatch(source, /selectedTeamMember\.bio/);
});

test("Pod team cache projection keeps only roster-safe personal fields", () => {
  const teamInterfaceStart = source.indexOf("interface PodTeamMember");
  const teamInterfaceEnd = source.indexOf("interface PodTeamData");
  const teamInterface = source.slice(teamInterfaceStart, teamInterfaceEnd);

  assert.match(teamInterface, /id: string/);
  assert.match(teamInterface, /name: string/);
  assert.doesNotMatch(teamInterface, /email|phone|school|grade|bio|certification/i);

  const queryStart = source.indexOf('queryKey: ["/api/tutor/pod-team"]');
  const queryEnd = source.indexOf('queryKey: ["/api/tutor/pod-alignment-summary"]', queryStart);
  const querySource = source.slice(queryStart, queryEnd);

  assert.match(querySource, /name: String\(member\?\.name/);
  assert.doesNotMatch(querySource, /member\?\.(email|phone|school|grade|bio|certification)/);
});
