import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "client/src/components/layout/account-menu.tsx"),
  "utf8",
);

test("TD account menu exposes the shared RI Appearance control", () => {
  assert.match(source, /isTD/);
  assert.match(source, /showAppearance = isTutor\(user\) \|\| isTD\(user\)/);
  assert.match(source, /Appearance/);
  assert.match(source, /Warm Dark/);
  assert.match(source, /value="dark"/);
});
