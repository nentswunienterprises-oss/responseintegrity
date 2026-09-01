import test from "node:test";
import assert from "node:assert/strict";
import {
  BATTLE_TEST_VARIANT_KEYS,
  TUTOR_BATTLE_TEST_PHASES,
  computeBattleTestOutcome,
  getBattleTestScoringGuide,
  materializeBattleTestPhaseVariant,
  validateBattleTestResponses,
  type BattleTestResponseInput,
} from "@shared/battleTesting";
import {
  TUTOR_BATTLE_TEST_PHASES_EXACT,
  TUTOR_BATTLE_TEST_PHASES_SAFE,
  getTutorBattleTestPhaseDefinitionsExact,
} from "./battleTestingBanks";

const CANONICAL_TUTOR_KEYS = [
  "clarity",
  "structured_execution",
  "controlled_discomfort",
  "time_pressure_stability",
  "topic_conditioning",
  "intro_session_structure",
  "logging_system",
  "session_flow_control",
  "drill_library",
  "handover_verification",
  "tools_required",
];

function getExactPhase(phaseKey: string) {
  const phase = TUTOR_BATTLE_TEST_PHASES_EXACT.find((entry) => entry.key === phaseKey);
  assert.ok(phase, `expected exact phase ${phaseKey} to exist`);
  return phase;
}

function textFor(phaseKey: string, questionNumber: number) {
  const phase = getExactPhase(phaseKey);
  const question = phase.questions[questionNumber - 1];
  assert.ok(question, `expected ${phaseKey} question ${questionNumber} to exist`);
  return `${question.prompt} ${question.expectedAnswer} ${question.failIndicators.join(" ")}`.toLowerCase();
}

test("tutor battle-test safe bank preserves the full canonical phase list", () => {
  assert.equal(TUTOR_BATTLE_TEST_PHASES_SAFE.length, TUTOR_BATTLE_TEST_PHASES.length);
  assert.deepEqual(
    TUTOR_BATTLE_TEST_PHASES_SAFE.map((phase) => phase.key),
    TUTOR_BATTLE_TEST_PHASES.map((phase) => phase.key)
  );
});

test("each canonical tutor deep-dive bank loads its own 15-question audit", () => {
  assert.deepEqual(
    TUTOR_BATTLE_TEST_PHASES_EXACT.map((phase) => phase.key),
    CANONICAL_TUTOR_KEYS
  );

  for (const phase of TUTOR_BATTLE_TEST_PHASES_EXACT) {
    assert.equal(phase.questions.length, 15, `expected ${phase.key} to expose its own 15-question audit`);
    assert.equal(
      TUTOR_BATTLE_TEST_PHASES_SAFE.find((entry) => entry.key === phase.key)?.questions.length,
      15,
      `expected safe bank to use exact 15-question audit for ${phase.key}`
    );
  }
});

test("parsed tutor banks include complete scoring anchors and no mojibake", () => {
  const mojibakePattern = /ΓÇ|≡ƒ|â€|ðŸ/;

  for (const phase of TUTOR_BATTLE_TEST_PHASES_EXACT) {
    const seenKeys = new Set<string>();
    const seenPrompts = new Set<string>();

    for (const question of phase.questions) {
      assert.ok(question.key, `${phase.key} question key should be present`);
      assert.ok(!seenKeys.has(question.key), `${phase.key} question key should be unique: ${question.key}`);
      assert.ok(!seenPrompts.has(question.prompt), `${phase.key} prompts should be unique`);
      seenKeys.add(question.key);
      seenPrompts.add(question.prompt);

      assert.ok(question.prompt.trim(), `${phase.key}:${question.key} prompt should not be blank`);
      assert.ok(question.expectedAnswer.trim(), `${phase.key}:${question.key} expected answer should not be blank`);
      assert.ok(question.failIndicators.length > 0, `${phase.key}:${question.key} needs fail indicators`);

      const joinedText = `${question.prompt} ${question.expectedAnswer} ${question.failIndicators.join(" ")}`;
      assert.equal(mojibakePattern.test(joinedText), false, `${phase.key}:${question.key} contains mojibake`);

      const scoringGuide = getBattleTestScoringGuide(question);
      assert.ok(scoringGuide.clear.trim(), `${phase.key}:${question.key} needs CLEAR anchor`);
      assert.ok(scoringGuide.partial.trim(), `${phase.key}:${question.key} needs PARTIAL anchor`);
      assert.ok(scoringGuide.fail.trim(), `${phase.key}:${question.key} needs FAIL anchor`);
    }
  }
});

test("every tutor bank has explicit critical-fail boundaries", () => {
  for (const phase of TUTOR_BATTLE_TEST_PHASES_EXACT) {
    const criticalQuestions = phase.questions.filter((question) => question.autoCriticalOnFail);
    assert.ok(criticalQuestions.length >= 1, `${phase.key} should have at least one critical boundary`);
    for (const question of criticalQuestions) {
      assert.ok(
        question.criticalFailReason?.trim(),
        `${phase.key}:${question.key} should name the exact critical-fail reason`
      );
    }
  }
});

test("forms A, B, and C preserve question keys while changing prompts", () => {
  for (const phase of TUTOR_BATTLE_TEST_PHASES_EXACT) {
    const forms = BATTLE_TEST_VARIANT_KEYS.map((variantKey) =>
      materializeBattleTestPhaseVariant(phase, variantKey)
    );

    for (const form of forms) {
      assert.equal(form.questions.length, 15, `${phase.key} ${form.variantKey} should have its own 15 questions`);
      assert.deepEqual(
        form.questions.map((question) => question.key),
        phase.questions.map((question) => question.key),
        `${phase.key} ${form.variantKey} should preserve question keys`
      );
    }

    const promptsByForm = forms.map((form) => form.questions.map((question) => question.prompt).join("\n"));
    assert.notEqual(promptsByForm[0], promptsByForm[1], `${phase.key} Form B should vary at least one prompt`);
    assert.notEqual(promptsByForm[0], promptsByForm[2], `${phase.key} Form C should vary at least one prompt`);
  }
});

test("exact phase lookup materializes assigned form variants", () => {
  const [phase] = getTutorBattleTestPhaseDefinitionsExact(["clarity"], { clarity: "form_b" });

  assert.equal(phase.variantKey, "form_b");
  assert.equal(phase.questions.length, 15);
  assert.equal(phase.questions[0].key, getExactPhase("clarity").questions[0].key);
  assert.notEqual(phase.questions.map((question) => question.prompt).join("\n"), getExactPhase("clarity").questions.map((question) => question.prompt).join("\n"));
});

test("single deep-dive battle-test lookup materializes exactly 15 questions", () => {
  const phases = getTutorBattleTestPhaseDefinitionsExact(["clarity"]);

  assert.equal(phases.length, 1);
  assert.equal(phases[0].questions.length, 15);
  assert.equal(
    phases.reduce((total, phase) => total + phase.questions.length, 0),
    15,
    "one Battle Test should produce exactly one 15-question deep dive audit"
  );
});

test("phase banks preserve live drill constraints and evidence doctrine", () => {
  assert.match(textFor("clarity", 3), /modeling/);
  assert.match(textFor("clarity", 3), /not scored|unscored|instruction/);
  assert.match(textFor("clarity", 4), /no support|no tutor support|without support|without tutor support/);
  assert.match(textFor("clarity", 5), /minimal support/);

  assert.match(textFor("structured_execution", 3), /minimal support/);
  assert.match(textFor("structured_execution", 4), /no support|no tutor support|without support|without tutor support/);
  assert.match(textFor("structured_execution", 5), /no support|no tutor support|without support|without tutor support/);

  assert.match(textFor("controlled_discomfort", 4), /minimal support/);
  assert.match(textFor("controlled_discomfort", 5), /first-step only|first step only|only first-step support/);
  assert.match(textFor("controlled_discomfort", 6), /no support|no tutor support|without support|without tutor support/);

  assert.match(textFor("time_pressure_stability", 4), /light timer|timer/);
  assert.match(textFor("time_pressure_stability", 5), /repeated timed|repeated/);
  assert.match(textFor("time_pressure_stability", 6), /full constraint|tight timer|tight/);

  assert.match(textFor("handover_verification", 1), /tutor replacement|replacement tutor|continuity/);
  assert.match(textFor("tools_required", 1), /smartphone/);
  assert.match(textFor("tools_required", 1), /ring light/);
  assert.match(textFor("tools_required", 1), /earphones/);
  assert.match(textFor("logging_system", 2), /observation/);
  assert.match(textFor("logging_system", 2), /inference|interpretation/);
});

test("battle-test scoring keeps locked, watchlist, fail, and critical-fail states deterministic", () => {
  const phase = getExactPhase("clarity");

  const allClear = phase.questions.map((question) => ({
    phaseKey: phase.key,
    questionKey: question.key,
    score: "clear",
    answerEvidence: "Specialist gave a complete operating answer.",
  })) satisfies BattleTestResponseInput[];
  assert.equal(computeBattleTestOutcome("tutor", [phase], allClear).state, "locked");

  const watchlist = allClear.map((response, index) =>
    index === 0 ? { ...response, score: "fail" as const, note: "Missed a non-critical boundary." } : response
  );
  const watchlistOutcome = computeBattleTestOutcome("tutor", [phase], watchlist);
  assert.equal(watchlistOutcome.alignmentPercent, 93.33);
  assert.equal(watchlistOutcome.state, "watchlist");

  const fail = allClear.map((response, index) =>
    index < 2 ? { ...response, score: "fail" as const, note: "Missed required operating boundary." } : response
  );
  assert.equal(computeBattleTestOutcome("tutor", [phase], fail).state, "fail");

  const criticalQuestionIndex = phase.questions.findIndex((question) => question.autoCriticalOnFail);
  assert.notEqual(criticalQuestionIndex, -1);
  const critical = allClear.map((response, index) =>
    index === criticalQuestionIndex
      ? { ...response, score: "fail" as const, note: "Breached a critical boundary." }
      : response
  );
  const criticalOutcome = computeBattleTestOutcome("tutor", [phase], critical);
  assert.equal(criticalOutcome.state, "fail");
  assert.equal(criticalOutcome.hasCriticalFail, true);
  assert.ok(criticalOutcome.criticalFailReasons[0].includes(phase.title));
});

test("battle-test response validation requires answer evidence and notes for drift", () => {
  const phase = getExactPhase("clarity");
  const question = phase.questions[0];

  assert.throws(
    () =>
      validateBattleTestResponses("tutor", [phase], [
        {
          phaseKey: phase.key,
          questionKey: question.key,
          score: "clear",
          answerEvidence: "",
        },
      ]),
    /answer evidence/
  );

  assert.throws(
    () =>
      validateBattleTestResponses("tutor", [phase], [
        {
          phaseKey: phase.key,
          questionKey: question.key,
          score: "partial",
          answerEvidence: "Specialist answer captured.",
        },
      ]),
    /Partial and fail scores require a note/
  );

  const responseMap = validateBattleTestResponses("tutor", [phase], [
    {
      phaseKey: phase.key,
      questionKey: question.key,
      score: "partial",
      answerEvidence: "Specialist answer captured.",
      note: "Missed evidence integrity boundary.",
    },
  ]);
  assert.equal(responseMap.size, 1);
});
