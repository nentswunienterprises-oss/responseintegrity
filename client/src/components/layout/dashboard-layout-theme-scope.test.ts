import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "client/src/components/layout/dashboard-layout.tsx"),
  "utf8",
);

test("TD dashboard surfaces receive the shared RI appearance theme scope", () => {
  assert.match(source, /const useTDTheme = !!effectiveUser && isTD\(effectiveUser\)/);
  assert.match(source, /const useRIThemeWorld = useSpecialistTheme \|\| useTDTheme/);
  assert.match(source, /const useRIThemeSurface = useSpecialistSurface \|\| useTDTheme/);
  assert.match(source, /useRIThemeWorld \? " ri-world-page ri-specialist-world"/);
  assert.match(source, /useRIThemeSurface \? " ri-specialist-surface"/);
});
