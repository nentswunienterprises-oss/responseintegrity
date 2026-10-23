import test from "node:test";
import assert from "node:assert/strict";
import { resolveSandboxRediagnosisEpisodeRun, canRetireSupersededEmptySandboxEpisode, sandboxRediagnosisSelectionSeed } from "./sandboxRediagnosisEpisode";

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

test("only an empty older duplicate superseded by completed placement can retire", () => {
  const empty={status:"active",started_session_number:2,specialist_probe_count:0,
    canonical_probe_count:0,persisted_turn_count:0,completed_sibling:true,
    specialist_complete:false,canonical_complete:false};
  assert.equal(canRetireSupersededEmptySandboxEpisode(empty,4),true);
  for(const change of [
    {specialist_probe_count:1},{canonical_probe_count:1},{persisted_turn_count:1},
    {specialist_probe_count:null},{canonical_probe_count:null},{completed_sibling:false},
    {specialist_complete:true},{canonical_complete:true},{status:"blocked"},{status:"completed"},
    {started_session_number:4},{started_session_number:5},{started_session_number:0},
  ]) assert.equal(canRetireSupersededEmptySandboxEpisode({...empty,...change},4),false,JSON.stringify(change));
});


test("episode selection preserves legacy streams and separates reproducible new episodes", () => {
  const trajectorySeed = "generic-profile-fixture";
  assert.equal(sandboxRediagnosisSelectionSeed({trajectorySeed,runId:"old-a"}),trajectorySeed);
  assert.equal(sandboxRediagnosisSelectionSeed({trajectorySeed,runId:"old-b"}),trajectorySeed);
  const episode = {trajectorySeed,runId:"new-a",selectionVersion:2 as const};
  assert.equal(sandboxRediagnosisSelectionSeed(episode),sandboxRediagnosisSelectionSeed(episode));
  assert.notEqual(sandboxRediagnosisSelectionSeed(episode),sandboxRediagnosisSelectionSeed({...episode,runId:"new-b"}));
  assert.notEqual(sandboxRediagnosisSelectionSeed(episode),trajectorySeed);
  assert.throws(()=>sandboxRediagnosisSelectionSeed({...episode,runId:""}),/lineage/);
});
