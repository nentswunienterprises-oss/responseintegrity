import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";

// Execute the registered production handler without starting the full server.
// This catches fields omitted from the HTTP projection, not just helper behavior.
async function readMap(student: any, tutorId = "specialist") {
  const source = readFileSync("server/routes.ts", "utf8");
  const start = source.indexOf('app.get("/api/tutor/topic-conditioning/:studentId"');
  const end = source.indexOf("// Get parent reports", start);
  assert.ok(start >= 0 && end > start);
  let handler: any;
  const code = transformSync(source.slice(start, end), { loader: "ts", format: "cjs" }).code;
  runInNewContext(code, {
    app: { get: (...args: any[]) => { handler = args.at(-1); } },
    isAuthenticated: () => {}, requireRole: () => () => {},
    storage: { getStudent: async () => student },
    pool: {}, isHeuristicSandboxStudent: () => false,
    overlaySandboxDiagnosisTopicPlacement: async ({topics}:any) => topics,
    tryParsePhase: (value: string) => value || null,
    normalizeStability: (value: string) => value,
    parseStoredTopicReference: () => null,
    loadLatestTpsTimerContract: async () => null,
    TPS_TIMER_BASELINE_INCOMPLETE: "baseline_incomplete",
    console,
  });
  let status = 200;
  let body: any;
  const response: any = {
    status: (value: number) => { status = value; return response; },
    json: (value: any) => { body = JSON.parse(JSON.stringify(value)); return response; },
  };
  await handler({ dbUser: { id: tutorId }, params: { studentId: "controlled-student" } }, response);
  return { status, body };
}

test("Sessions Map retains completed diagnosis history and phase-exit authority without a Pod snapshot", async () => {
  const history = [{ phase: "Structured Execution", stability: "High", date: "2026-10-17T12:21:20.000Z" }];
  const student = { tutorId: "specialist", conceptMastery: { topicConditioning: { topics: {
    Algebra: { phase: "Structured Execution", stability: "High", progressionAuthority: "building", history },
  } } } };
  const before = JSON.stringify(student);
  const { status, body } = await readMap(student);
  assert.equal(status, 200);
  assert.equal(body.topics[0].phase, "Structured Execution");
  assert.equal(body.topics[0].stability, "High");
  assert.deepEqual(body.topics[0].history, history);
  assert.equal(body.topics[0].progressionAuthority, "building");
  assert.equal(JSON.stringify(student), before, "reading must not rewrite the stored evidence");
});

test("a seeded topic does not acquire observation history from its fallback timestamp", async () => {
  const { body } = await readMap({ tutorId: "specialist", conceptMastery: { topicConditioning: { topics: {
    Algebra: { phase: "Clarity", stability: "Low", lastUpdated: "2026-10-17T12:00:00.000Z" },
  } } } });
  assert.deepEqual(body.topics[0].history, []);
  assert.equal(body.topics[0].progressionAuthority, null);
});

test("another Specialist cannot read topic history", async () => {
  const result = await readMap({ tutorId: "someone-else", conceptMastery: { private: true } });
  assert.equal(result.status, 403);
  assert.equal(result.body.topics, undefined);
});
