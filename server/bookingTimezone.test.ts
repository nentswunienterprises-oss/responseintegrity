import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("parent intro booking sends an explicit browser-local instant and server persists timestamptz", () => {
  const routeSource = source("server/routes.ts");
  const start = routeSource.indexOf('app.post("/api/parent/intro-session/propose"');
  const end = routeSource.indexOf("// Parent intro session confirmation status", start);
  const route = routeSource.slice(start, end);
  const parentClient = source("client/src/pages/client/parent/gateway.tsx");

  assert.ok(start >= 0 && end > start);
  assert.match(parentClient, /scheduledStart: new Date\(\x60\$\{format\(proposedDate, "yyyy-MM-dd"\)\}T\$\{proposedTime\}\x60\)\.toISOString\(\)/);
  assert.match(route, /parsedScheduledStart\.toISOString\(\)/);
  assert.match(route, /scheduled_time = \$3::timestamptz/);
  assert.match(route, /\$4::timestamptz/);
  assert.doesNotMatch(route, /scheduled_time: \x60\$\{proposedDate\}T\$\{proposedTime\}\x60/);
});

test("specialist intro adjustment sends and persists an explicit instant", () => {
  const routeSource = source("server/routes.ts");
  const start = routeSource.indexOf('app.post("/api/tutor/students/:studentId/intro-session-response"');
  const end = routeSource.indexOf('app.get(\n    "/api/tutor/students/:studentId/training-sessions"', start);
  const route = routeSource.slice(start, end);
  const specialistClient = source("client/src/components/tutor/TutorIntroSessionActions.tsx");

  assert.ok(start >= 0 && end > start);
  assert.match(specialistClient, /scheduledStart: new Date\(\x60\$\{newDate\}T\$\{newTime\}\x60\)\.toISOString\(\)/);
  assert.match(route, /const \{ action, newDate, newTime, scheduledStart, timezone \} = req\.body/);
  assert.match(route, /parsedAdjustedStart\.toISOString\(\)/);
  assert.match(route, /timezone: String\(timezone \|\| \(session as any\)\.timezone/);
  assert.doesNotMatch(route, /scheduled_time: \x60\$\{newDate\}T\$\{newTime\}\x60/);
});

test("booking displays use South African 24-hour time rather than ambiguous 12-hour labels", () => {
  const files = [
    "client/src/pages/client/parent/gateway.tsx",
    "client/src/pages/client/parent/dashboard.tsx",
    "client/src/pages/client/parent/sessions.tsx",
    "client/src/pages/client/student/sessions.tsx",
    "client/src/pages/operational/tutor/pod.tsx",
    "client/src/pages/operational/tutor/sessions.tsx",
    "client/src/components/tutor/TutorIntroSessionActions.tsx",
    "client/src/components/tutor/StudentTopicConditioningDialog.tsx",
  ];

  for (const path of files) {
    const content = source(path);
    assert.match(content, /en-ZA/, path + " should use South African locale for scheduled times");
    assert.match(content, /Africa\/Johannesburg/, path + " should format scheduled times in the RI operating timezone");
    assert.match(content, /hourCycle: "h23"/, path + " should display 24-hour time");
  }
});
