import test from "node:test";
import assert from "node:assert/strict";
import {
  instructionPromptDisplayText,
  instructionPromptLabelFor,
} from "./instructionPromptLabel";

test("Clarity identification meta-instruction is DO THIS NOW", () => {
  const instruction =
    "Show the problem. Ask student to: name the terms, identify the type, state the steps, explain why it works. No solving allowed.";

  assert.equal(instructionPromptLabelFor(instruction), "DO THIS NOW");
  assert.equal(instructionPromptDisplayText(instruction), instruction);
});

test("meta-instructions that ask the student to act are not SAY scripts", () => {
  const instruction =
    "Ask student to solve. Minimal guidance. Observe clarity under execution.";

  assert.equal(instructionPromptLabelFor(instruction), "DO THIS NOW");
  assert.equal(instructionPromptDisplayText(instruction), instruction);
});

test("direct student-facing scripts are SAY and quoted", () => {
  const instruction =
    "Before you solve, tell me the steps you will follow. Then solve using those steps.";

  assert.equal(instructionPromptLabelFor(instruction), "SAY");
  assert.equal(
    instructionPromptDisplayText(instruction),
    `"${instruction}"`,
  );
});

test("short direct prompts remain SAY scripts", () => {
  assert.equal(instructionPromptLabelFor("Solve independently."), "SAY");
  assert.equal(instructionPromptDisplayText("Solve independently."), '"Solve independently."');
});
