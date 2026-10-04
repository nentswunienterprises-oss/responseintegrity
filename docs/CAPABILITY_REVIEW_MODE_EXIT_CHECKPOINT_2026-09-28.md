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

### Founder Review corrections - 2 October 2026

The How to Interpret Prompts review exposed two additional authoring rules that now apply to all Capability banks:

- **No polarity traps:** a single-choice stem using words such as *avoid*, *wrong*, *not*, or *must not* is invalid if more than one option semantically describes an action the Specialist should avoid. Rewrite the stem positively, or use explicit multi-select when several actions are genuinely correct.
- **Options must answer the same question:** do not mix a meta-answer such as "avoid doing X" with several concrete actions that also satisfy the stem. Grammatical form and decision level should remain parallel enough that the learner is choosing RI reasoning, not decoding test-writing structure.
- **Context is not authority:** asking a student or parent for preference can be valid context. The error occurs when that preference is used to override an evidence-derived state or route. Feedback must name that distinction.
- **System direction must be explained by evidence:** never teach "follow RI-OS because the system says so." The reason RI-OS owns state movement and next action is that it applies shared decision rules to the recorded qualifying evidence. Specialist judgment enters through clean execution, observation, recording, and defect escalation.
- **Disagreement is not disobedience:** if a Specialist suspects a prompt or system defect, the correct route is to preserve the evidence boundary and escalate the defect separately, not to improvise a private state decision.


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


## OS-wide Capability reconciliation - 2 October 2026

Founder Review exposed that the ambiguity was not isolated to How to Interpret Prompts. The entire active private Capability estate was therefore treated as one authoring surface.

The reconciliation standard is now:

- **No polarity traps in single-choice.** Stems such as “What should the Specialist avoid?”, “What must not happen?”, “What is wrong?”, and “Why is that wrong?” are not permitted as single-choice when the option set can make several actions semantically defensible. Rewrite the question positively/diagnostically, or use explicit multi-select.
- **Every bank contains deliberate interaction variation.** A private bank may not be single-choice only. Each bank must include at least one multi-select or sequence question.
- **Multi-select is structured.** It has at least five options, at least two defensible answers, and teaching feedback for every option so missed truths and selected non-answers can both be explained.
- **Sequence is real ordering.** It has at least four steps and the approved answer orders every option exactly once.
- **System authority is evidence governance.** Any question teaching RI-OS state or next-action authority must explain the evidence basis: qualifying observations are recorded, shared RI rules interpret them, and the resulting operating state is therefore not a Specialist preference. Software is not authoritative merely because it is software.
- **Human judgment remains necessary.** Specialist judgment belongs in accurate observation, preserving the active condition, truthful recording, and escalating a suspected prompt or system defect. It does not become private state-movement authority.
- **Coverage is preserved when wording changes.** Reconciliation must not reduce competency-cell counts or critical-boundary coverage from the bank version it replaces.

The private-bank importer now fails closed on these rules so future bank authoring cannot silently drift back to the pre-review pattern.

## Transformation Phases Founder approval checkpoint - 4 October 2026

The five Transformation Phases Mastery banks have now completed interactive Founder Review and are locked:

- Topic Conditioning `topic_conditioning_mastery_v1` v17
- Clarity `clarity_mastery_v1` v15
- Structured Execution `structured_execution_mastery_v1` v14
- Controlled Discomfort `controlled_discomfort_mastery_v1` v14
- Time Pressure Stability `time_pressure_stability_mastery_v1` v14

All five are active with Review Mode off.

Their approved Deep Dive learning flows are also frozen under the teach-before-test structure established during review.

This closes Founder acceptance for the five Transformation Mastery banks, but does **not** close this broader Capability checkpoint. Transformation Retention / Delayed Retrieval remains Founder-approved and is active as v10 after a narrow answer-length parity correction. Transformation Interleaved Transfer is active as v11 in Founder Review Mode after option/feedback, grammar-directness and answer-length parity passes. Session Infrastructure remains separately governed by its own review status.

Durable record: `docs/TRANSFORMATION_PHASES_FOUNDER_APPROVAL_CHECKPOINT_2026-10-04.md`.

## Transformation Retention Founder approval - 4 October 2026

`transformation_phases_retrieval_v1` v9 completed interactive Founder Review and was locked. A later narrow answer-length defect correction produced v10 without changing scoring/Truth authority.

Founder-reviewed v9 full content hash:

`7b797e2b54d0ff4529b603161e7d68c6`

Current v10 narrow-correction full content hash:

`cf403ed87fd55343398cf77d21ffa31c`

Before Review Mode exit, the remaining v9 review attempt was cleared so it cannot become lifecycle evidence. Proof now has Retrieval v10 active with Review Mode off and zero v10 review attempts/confirmations. Transfer v11 remains in Review Mode after its answer-length parity pass.

Production has not yet received Retrieval. Promotion remains gated on Transfer approval so the cumulative pair can be promoted and verified together.

Durable record: `docs/TRANSFORMATION_CUMULATIVE_CAPABILITY_REVIEW_CHECKPOINT_2026-09-29.md`.

## Transformation Transfer pre-Founder quality pass - 4 October 2026

`transformation_state_transfer_v1` was versioned from v8 to v9 before Founder review.

- 25 items manually reviewed;
- 22 option sets rewritten;
- prompts and scoring authority preserved;
- option-specific feedback independently audited;
- scoring/content authority hash unchanged between v8 and v9: `44395571b335fd38706f923de3ae9327`;
- current full v9 hash: `7097bf67528e90d921977c8d8ff175cf`;
- Transfer v9 is active in Proof with Review Mode on;
- Production contains no Transfer config.

Founder acceptance is still open.

## Cumulative answer-length parity pass - 4 October 2026

The Founder explicitly required answer-length quality to be checked across **both Retrieval and Transfer**.

Retrieval v9 and Transfer v10 were measured item by item for visible correctness cues created by option length. The correction standard was not identical character count. It was that length must not make the right answer inferable.

### Retrieval

Retrieval was rotated from v9 to v10 as a narrow presentation correction inside already-approved doctrine.

- all 25 option sets measured;
- 18 option sets rebalanced;
- authority hash unchanged: `ac0bfcc5232eb414b6aa955e10fac21e`;
- current full v10 hash: `cf403ed87fd55343398cf77d21ffa31c`;
- v10 active, Review Mode off;
- v9 retired.

### Transfer

Transfer was rotated from v10 to v11.

- all 25 option sets measured;
- 20 option sets rebalanced;
- authority hash unchanged: `44395571b335fd38706f923de3ae9327`;
- current full v11 hash: `272cc32a44436657352fdd42308ac12a`;
- v11 active in Review Mode;
- v10 retired.

Final current-bank checks for both gates show:

- zero items where all correct options are longer than every distractor;
- zero items where all correct options are shorter than every distractor;
- zero items with correct/wrong average-length ratio outside 0.80-1.25;
- zero items with max/min option-length ratio above 1.70;
- zero single-choice wrong-option feedback gaps;
- zero single-choice correct options carrying wrong-answer feedback.

Production still contains no Retrieval or Transfer config.

Founder acceptance remains open only for Transfer v11.

## Transformation Transfer grammar-directness pass - 4 October 2026

A stricter prompt-to-option audit identified seven v9 items whose answer meaning was acceptable but whose grammatical form did not answer the stem directly enough: 02, 06, 10, 14, 19, 22 and 25.

Because v9 already had one Review Mode attempt, it was not edited in place. The corrected bank was rotated to v10.

- all 25 prompt-to-option relationships were reviewed;
- 7 option sets were rewritten for grammatical directness;
- the other 18 passed unchanged;
- prompts, scoring keys, critical boundaries, Truths and option-specific feedback were preserved;
- scoring/content authority hash remains `44395571b335fd38706f923de3ae9327`;
- current full v10 hash: `c75df5ea8cbaf3cf852e0f6b3f787ef4`;
- Transfer v9 is retired;
- Transfer v10 is active in Proof with Review Mode on;
- Production still contains no Transfer config.

Founder acceptance is still open.



