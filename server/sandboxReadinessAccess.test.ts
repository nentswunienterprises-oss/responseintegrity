import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./sandboxReadiness.ts", import.meta.url), "utf8");

test("Sandbox TD-readiness uses the server PostgreSQL pool, not a public-key Supabase client", () => {
  assert.match(source, /import \{ pool \} from "\.\/db"/);
  assert.doesNotMatch(source, /from "\.\/storage"/);
  assert.doesNotMatch(source, /\.from\("tutor_sandbox_mock_assessments"\)/);
  assert.match(source, /FROM public\.tutor_sandbox_mock_assessments/);
  assert.match(source, /INSERT INTO public\.tutor_sandbox_mock_assessments/);
  assert.match(source, /WHERE tutor_assignment_id = \$1/);
  assert.match(source, /checklist->>'assessment_version' = '2'/);
  assert.match(source, /checklist->>'assessment_owner' = 'td'/);
  assert.match(source, /ORDER BY assessed_at DESC, id DESC/);
  assert.match(source, /JSON\.stringify\(checklist\)/);
});

test("Sandbox TD-readiness preserves assignment ownership, validation, and nonautomatic Practicals entry", () => {
  assert.match(source, /TD readiness evidence note is required/);
  assert.match(source, /practicalsReady !== true/);
  assert.match(source, /input\.tutorAssignmentId,/);
  assert.match(source, /input\.assessedByUserId,/);
  assert.match(source, /next_stage: "practicals"/);
  assert.match(source, /return getLatestSandboxReadinessAssessment\(input\.tutorAssignmentId\)/);
  assert.match(source, /isMissingSandboxMockTable\(error\)/);
});
