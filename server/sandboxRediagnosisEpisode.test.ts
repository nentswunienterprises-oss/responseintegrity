import test from "node:test";
import assert from "node:assert/strict";
import { resolveSandboxRediagnosisEpisodeRun } from "./sandboxRediagnosisEpisode";

const run = (id: string, status: string, session = 2, minute = 0) => ({
  id, status, started_session_number: session,
  created_at: `2026-10-18T12:${String(minute).padStart(2,"0")}:00Z`,
});

test("blocked re-diagnosis survives refresh and a newer empty active run", () => {
  const blocked = run("blocked", "blocked");
  for (const rows of [[blocked], [run("new", "active", 2, 1), blocked]]) {
    assert.equal(resolveSandboxRediagnosisEpisodeRun(rows, 2), blocked);
  }
});
test("active runs resume, completed history cannot restart the same run", () => {
  const active = run("active", "active");
  assert.equal(resolveSandboxRediagnosisEpisodeRun([run("past","completed"),active],2),active);
  assert.equal(resolveSandboxRediagnosisEpisodeRun([run("past","completed")],2),null);
});
test("previous session blocks remain historical without replacing the current episode", () => {
  const current = run("current","active",3);
  assert.equal(resolveSandboxRediagnosisEpisodeRun([run("past","blocked",2),current],3),current);
  assert.equal(resolveSandboxRediagnosisEpisodeRun([],3),null);
});
