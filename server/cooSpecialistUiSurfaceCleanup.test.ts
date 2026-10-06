import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

function walkFiles(root: string): string[] {
  const absoluteRoot = path.join(process.cwd(), root);
  if (!fs.existsSync(absoluteRoot)) return [];
  const entries = fs.readdirSync(absoluteRoot, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relative = path.join(root, entry.name);
    return entry.isDirectory() ? walkFiles(relative) : [relative];
  });
}

test("COO account and dashboard surfaces use the shared RI Appearance authority", () => {
  const menu = read("client/src/components/layout/account-menu.tsx");
  const layout = read("client/src/components/layout/dashboard-layout.tsx");

  assert.match(menu, /isCOO/);
  assert.match(
    menu,
    /showAppearance = isTutor\(user\) \|\| isTD\(user\) \|\| isCOO\(user\)/,
  );
  assert.match(layout, /const useCOOTheme = !!effectiveUser && isCOO\(effectiveUser\)/);
  assert.match(
    layout,
    /const useRIThemeWorld = useSpecialistTheme \|\| useTDTheme \|\| useCOOTheme/,
  );
  assert.match(
    layout,
    /const useRIThemeSurface = useSpecialistSurface \|\| useTDTheme \|\| useCOOTheme/,
  );
});

test("COO Pod creation presents operating setup in Specialist language", () => {
  const source = read("client/src/pages/executive/coo/pods.tsx");

  assert.match(source, /Create Pod/);
  assert.match(source, /Operating model/);
  assert.match(source, /Student capacity per Specialist/);
  assert.match(source, /Initial Specialists/);
  assert.match(source, /Territory Director/);
  assert.doesNotMatch(source, /Assign Tutors/);
  assert.doesNotMatch(source, />Vehicle</);
  assert.doesNotMatch(source, /pod-eligible tutors/i);
});

test("legacy Tutor routes resolve into canonical Specialist surfaces", () => {
  const app = read("client/src/App.tsx");

  assert.match(app, /path="\/tutor\/pod".*to="\/specialist\/pod"/);
  assert.match(app, /path="\/tutor\/growth".*to="\/specialist\/growth"/);
  assert.match(app, /path="\/tutor\/academics".*to="\/specialist\/academics"/);
  assert.match(app, /path="\/tutor\/sessions".*to="\/specialist\/sessions"/);
  assert.match(app, /path="\/tutor\/profile".*to="\/specialist\/profile"/);
  assert.match(app, /path="\/tutor\/updates".*to="\/specialist\/updates"/);
  assert.match(app, /LegacyTutorIntroSessionRedirect/);
});

test("canonical COO Pod links resolve to the guarded Pod detail surface", () => {
  const app = read("client/src/App.tsx");
  const pods = read("client/src/pages/executive/coo/pods.tsx");

  assert.ok(
    app.includes('path="/executive/coo/pods/:podId" element={<ExecutiveSeatGuard role="coo"><COOPodDetail /></ExecutiveSeatGuard>}'),
  );
  assert.match(pods, /cooPodsBasePath/);
  assert.ok(pods.includes('navigate(\`\$\{cooPodsBasePath\}/\$\{pod.id\}\`)'));
});

test("COO and Specialist source folders have no competing JSX twins", () => {
  const roots = [
    "client/src/pages/executive/coo",
    "client/src/pages/operational/tutor",
    "client/src/components/tutor",
  ];

  const twins: string[] = [];
  for (const root of roots) {
    for (const file of walkFiles(root)) {
      if (!file.endsWith(".jsx")) continue;
      const tsx = file.slice(0, -4) + ".tsx";
      if (fs.existsSync(path.join(process.cwd(), tsx))) twins.push(file);
    }
  }

  assert.deepEqual(twins, []);
});

test("COO operating surfaces avoid legacy fixed light materials", () => {
  const files = [
    "client/src/pages/executive/coo/pods.tsx",
    "client/src/pages/executive/coo/pod-detail.tsx",
    "client/src/pages/executive/coo/dashboard.tsx",
    "client/src/pages/executive/coo/broadcast.tsx",
    "client/src/pages/executive/coo/brain.tsx",
    "client/src/pages/executive/coo/applications.tsx",
    "client/src/pages/executive/coo/grade-monitoring.tsx",
    "client/src/pages/executive/coo/verification.tsx",
    "client/src/pages/executive/coo/track-leads.tsx",
    "client/src/pages/executive/coo/leadership-pilot-requests.tsx",
    "client/src/pages/executive/hr/traffic.tsx",
    "client/src/pages/executive/command-rhythm-dashboard.tsx",
  ];

  const forbidden = /bg-white|text-slate-|border-\[#|bg-\[#|text-\[#|from-\[#|to-\[#|via-\[#/;

  for (const file of files) {
    assert.doesNotMatch(read(file), forbidden, file);
  }
});

test("active Specialist and COO copy no longer exposes legacy Tutor labels", () => {
  const files = [
    "client/src/pages/executive/coo/pods.tsx",
    "client/src/pages/executive/coo/pod-detail.tsx",
    "client/src/pages/executive/coo/dashboard.tsx",
    "client/src/pages/executive/coo/broadcast.tsx",
    "client/src/pages/executive/coo/grade-monitoring.tsx",
    "client/src/pages/executive/coo/applications.tsx",
    "client/src/pages/executive/hr/traffic.tsx",
    "client/src/pages/operational/tutor/blueprint.tsx",
    "client/src/pages/operational/tutor/pod.tsx",
    "client/src/pages/operational/tutor/sessions.tsx",
    "client/src/pages/operational/tutor/academics.tsx",
    "client/src/pages/operational/tutor/dashboard.tsx",
    "client/src/pages/operational/tutor/intake.tsx",
    "client/src/components/tutor/StudentIdentitySheet.tsx",
    "client/src/components/tutor/StudentCard.tsx",
    "client/src/components/tutor/StudentReportsDialog.tsx",
    "client/src/components/tutor/StudentTopicConditioningDialog.tsx",
  ];

  const forbiddenPhrases = [
    "Tutor Mix",
    "Tutor Journey",
    "Tutor Audit",
    "Add Tutor",
    "Tutors Only",
    "Subject Declaration (Tutor)",
    "Grade Submission (Tutor)",
    "Tutor Notes",
    "Tutor Meaning:",
    "Awaiting Tutor",
    "Role: Tutor",
    "Tutor Dashboard",
    "Assign Tutor",
    "Unassign Tutor",
    "Waiting On Tutor",
  ];

  for (const file of files) {
    const source = read(file);
    for (const phrase of forbiddenPhrases) {
      assert.ok(!source.includes(phrase), `${file} still contains "${phrase}"`);
    }
  }
});
