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

## Current authoring and editorial status

**Authoring pass and full editorial quality audit completed 2026-09-28. Founder Review Mode remains OPEN.**

The 314-question gap has now been authored bank by bank. The active banks currently have complete option-specific feedback coverage:

| Bank | Active version | Questions with option-specific wrong-answer feedback |
| --- | ---: | ---: |
| Clarity | v8 | 45 / 45 |
| Structured Execution | v8 | 45 / 45 |
| Controlled Discomfort | v8 | 45 / 45 |
| Time Pressure Stability | v8 | 45 / 45 |
| Intro Session Structure | v8 | 45 / 45 |
| Logging System | v8 | 45 / 45 |
| Session Flow Control | v8 | 45 / 45 |
| Topic Conditioning | v9 | 45 / 45 |

For the seven banks that contained the 314-question authoring gap, there are now **945 option-specific wrong-answer feedback entries** (three wrong distractors per question), all distinct.

Post-audit integrity checks for the seven authored banks:

- 315 questions reviewed bank by bank.
- 945 wrong-option feedback entries present, all 945 distinct.
- 0 wrong options missing feedback.
- 0 correct options carrying option-specific feedback.
- 0 wrong-option feedback entries identical to the approved Truth.
- 0 stored “Not quite” prefixes.
- 0 em dashes or spaced-hyphen cleanup artifacts.
- 0 blocked implementation-jargon tokens such as schema, registry, runtime, payload, canonical, lineage, Capability Blueprint, or Capability Engine.
- 0 generic filler patterns such as “It adds context,” “It saves time,” or “This keeps the session moving.”
- Surrounding prompts, options, and Truths were also corrected where weak wording, repeated prose, implementation language, or assessment-writing language weakened the teaching.

These checks are guardrails, not the reason the audit is considered complete. The editorial pass itself reread the banks against the question, each wrong option, its feedback, the approved Truth, and the surrounding RI logic.

**This completes authoring and the pre-Review-Mode editorial audit, not Founder acceptance.** Any correction raised while the Founder tests in Review Mode remains required work under this checkpoint. The checkpoint stays open until those corrections are applied and the Founder explicitly exits Review Mode.

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

## Editorial quality gate

**Status: completed for the authored seven-bank pass. Founder Review Mode remains the final acceptance gate.**

The standard is **inevitable comprehensibility**. Simple does not mean short. A response may be one sentence, two sentences, or a short paragraph if that is what makes the distinction clearest.

Every wrong-option feedback entry was audited against these questions:

- Does this make the exact mistake clear?
- Does it change the Specialist’s thinking rather than merely tell them they were wrong?
- Is every word doing useful work?
- Does it teach only the distinction needed here, leaving the complete rule to the separate Truth?
- Could the same idea be made clearer without losing the distinction that matters?
- Does it sound like RI thinking rather than assessment-writing language?
- Does it leave the Specialist with a reusable mental model rather than wording to memorise?

Additional rules:

- **Question-specific teaching:** correct the misconception represented by the selected option, not the whole question and not a generic doctrine summary.
- **Truth separation:** the first-stage feedback orients the Specialist; the separate Truth teaches the complete rule.
- **No prose inflation:** remove filler, repeated setup, defensive qualifiers, committee language, and complexity that does not improve understanding.
- **No false compression:** do not shorten at the expense of understanding.
- **RI fidelity:** preserve phase boundaries, session-context boundaries, evidence eligibility, behaviour-versus-interpretation distinctions, state authority, and approved bank meaning.
- **Quality over coverage:** coverage, uniqueness, and character counts are structural checks only. They are not acceptance criteria.

The audit also used the correction pattern established across RI review history: preserve exact operating truth, remove drift, remove unnecessary machinery from learner-facing language, and prefer the clearest complete explanation over wording that merely sounds rigorous.

## Review Mode loop

The Founder reviews the checks in Review Mode.

When feedback is acceptable, no further action is required for that item.

When the Founder corrects or rejects wording, that correction is part of this branch's work and must be applied to the authored bank before this checkpoint can close.

Testing is therefore also an editorial approval pass. The goal is not merely that every wrong option has text. The goal is that, by the time Review Mode is exited, the active banks contain feedback the Founder accepts.

## Exit gate

This checkpoint remains **OPEN** until all of the following are true:

- [x] Clarity wrong-option feedback is fully authored.
- [x] Structured Execution wrong-option feedback is fully authored.
- [x] Controlled Discomfort wrong-option feedback is fully authored.
- [x] Time Pressure Stability wrong-option feedback is fully authored.
- [x] Intro Session Structure wrong-option feedback is fully authored.
- [x] Logging System wrong-option feedback is fully authored.
- [x] Session Flow Control wrong-option feedback is fully authored.
- [x] Topic Conditioning v9 already has complete option-specific wrong-answer feedback.
- [x] Automated coverage confirms there are **zero active single-choice items missing feedback for any wrong option**.
- [x] No wrong-answer path falls back to the Truth.
- [x] Bank validation rejects missing wrong-option feedback.
- [x] Full bank-by-bank editorial quality audit has been completed against the Founder inevitable-comprehensibility standard.
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
