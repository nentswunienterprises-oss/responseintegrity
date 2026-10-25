import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "client/src/components/layout/appearance-menu.tsx"),
  "utf8",
);

test("Appearance uses inline options on mobile", () => {
  assert.match(source, /useIsMobile/);
  assert.match(source, /appearance-mobile-options/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /setIsExpanded/);
});

test("Appearance keeps the desktop submenu separate", () => {
  assert.match(source, /DropdownMenuSub/);
  assert.match(source, /side="right"/);
  assert.match(source, /value="warm-dark"/);
});
