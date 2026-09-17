import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

const FORBIDDEN = [
  /(^|\/)private-sandbox-simulation-bank[^/]*\.json$/i,
  /(^|\/)ri_private_sandbox_simulation_bank[^/]*\.json$/i,
  /(^|\/)\.capability-simulation-bank\//i,
];

test("private Sandbox simulation bank payloads are never tracked in the public repository", () => {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  const leaked = tracked.filter((path) => FORBIDDEN.some((pattern) => pattern.test(path)));
  assert.deepEqual(
    leaked,
    [],
    `Private Sandbox simulation evaluator content must stay outside the public repository: ${leaked.join(", ")}`,
  );
});
