# Capability Review Mode Exit Checkpoint

**Branch:** `fix/preview-training-session-authority`  
**Prior merged PR:** #108  
**Tracking issue:** #112  
**Status:** OPEN - do not treat this branch/review work as complete while this checkpoint is open.

## Objective

Before Review Mode is exited, every active Capability Check bank must have acceptable learner-facing feedback for every wrong answer.

The current gap identified on 2026-09-28 is **314 questions requiring carefully authored option-specific wrong-answer feedback**:

| Bank | Active bank version | Questions still requiring option-specific feedback at checkpoint creation |
| --- | ---: | ---: |
| Clarity | v8 | 44 |
| Structured Execution | v8 | 45 |
| Controlled Discomfort | v8 | 45 |
| Time Pressure Stability | v8 | 45 |
| Intro Session Structure | v8 | 45 |
| Logging System | v8 | 45 |
| Session Flow Control | v8 | 45 |
| Topic Conditioning | v9 | 0 |
| **Total** |  | **314** |

Clarity item `v2r8_clarity_25` has already been corrected and is therefore not included in the 314.

## Authoring standard

Work **bank by bank**, not as a bulk filler pass.

For every wrong option:

- Author feedback for the specific misconception represented by that distractor.
- Explain why that selected reasoning fails without simply restating the Truth.
- Keep the first-stage **Not quite** feedback concise enough to remain interactive.
- Let the separate **Truth** stage teach the complete approved rule.
- Do not add feedback for the correct option. Correct answers use the approved Truth.
- Do not copy the same generic message across distractors merely to satisfy coverage.
- Keep learner-facing copy free of authoring notes, schema names, implementation language, product internals, and engineering jargon.
- Preserve RI doctrine, phase boundaries, evidence rules, and the approved meaning of the authored bank.

## Review Mode loop

The Founder reviews the checks in Review Mode.

When feedback is acceptable, no further action is required for that item.

When the Founder corrects or rejects wording, that correction is part of this branch's work and must be applied to the authored bank before this checkpoint can close.

Testing is therefore also an editorial approval pass. The goal is not merely that every wrong option has text. The goal is that, by the time Review Mode is exited, the active banks contain feedback the Founder accepts.

## Exit gate

This checkpoint remains **OPEN** until all of the following are true:

- [ ] Clarity wrong-option feedback is fully authored.
- [ ] Structured Execution wrong-option feedback is fully authored.
- [ ] Controlled Discomfort wrong-option feedback is fully authored.
- [ ] Time Pressure Stability wrong-option feedback is fully authored.
- [ ] Intro Session Structure wrong-option feedback is fully authored.
- [ ] Logging System wrong-option feedback is fully authored.
- [ ] Session Flow Control wrong-option feedback is fully authored.
- [x] Topic Conditioning v9 already has complete option-specific wrong-answer feedback.
- [ ] Automated coverage confirms there are **zero active single-choice items missing feedback for any wrong option**.
- [ ] No wrong-answer path falls back to the Truth.
- [ ] Bank validation rejects missing wrong-option feedback.
- [ ] Known Founder corrections raised during Review Mode have all been applied.
- [ ] Founder explicitly exits Review Mode / accepts the reviewed state.

**Do not close this checkpoint merely because the 314 fields have been populated.** Completeness is necessary, but Review Mode acceptance is the final content-quality gate.

## Implementation protections already added on this branch

- Wrong-answer feedback no longer falls back to the Truth.
- Single-choice bank validation requires option-specific feedback for every wrong option.
- Correct options must not carry option-specific feedback.
- Learner-facing bank validation rejects authoring leakage and implementation jargon.
- Existing display cleanup protects already-issued forms from known legacy copy leakage.

## Handoff rule

If work continues in another chat, session, or by another contributor, start here. This document and GitHub issue #112 are the durable branch-level definition of done for Capability Review Mode. PR #108 is already merged; any follow-on PR from this branch must reference and satisfy this checkpoint before Review Mode is considered complete.
