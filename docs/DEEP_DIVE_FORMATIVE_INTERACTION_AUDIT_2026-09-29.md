# Deep Dive Formative Interaction Standard

Status: **RECONCILED - 2 October 2026**

## Purpose

Deep Dive formative interactions teach Specialist thinking inside the lesson. They do not consume Capability attempts and they do not create formal Mastery evidence.

The interaction should be difficult because the distinctions are close, not because the wording is confusing.

## Locked formative standard

Every formative interaction must satisfy all of the following:

1. **Minimum five options**
   - Five visible options is the minimum boundary.
   - Three-option formative checks are no longer permitted.
   - More than five may be used when the reasoning space genuinely requires it.

2. **Intentional answer structure**
   - Single-choice is used only when exactly one answer is defensible under the stated condition.
   - When more than one conclusion is defensible, the interaction becomes multi-select and the learner is explicitly told to select every option that applies.
   - Multiple defensible answers are a teaching feature when they are intentional; they are not hidden ambiguity inside a single-choice question.

3. **Interaction variation**
   - A Deep Dive should not rely on one-answer multiple choice from beginning to end.
   - Multi-select should be used where several RI truths can coexist.
   - Formal Capability may additionally use sequence questions where order itself is the capability being tested.

4. **Plausible distractors**
   - Each wrong answer must be something a partially trained Specialist could reasonably believe.
   - Avoid joke answers, extreme strawmen and options that can be dismissed without RI understanding.

5. **Unique misconception**
   - Each wrong option must represent a distinct reasoning error.
   - Wrong options should not be paraphrases of the same mistake.

6. **Option-specific teaching**
   - Wrong-answer feedback identifies why that exact reasoning fails.
   - In multi-select, feedback must also make missed defensible conclusions teachable rather than treating the entire selected set as one undifferentiated error.

7. **Truth separation**
   - Local feedback diagnoses the selected reasoning.
   - Truth carries the complete RI rule when the response is incomplete or incorrect.

8. **No answer-shape cue**
   - The correct answer or correct set must not be systematically longer, more qualified or more polished than distractors.
   - Correct positions must not follow an obvious pattern.

9. **Distinct interaction purpose**
   - Interactions inside a Deep Dive should test different boundaries or misconceptions rather than repeatedly asking the same question in different words.

10. **Inevitable comprehensibility**
    - Once feedback is shown, the distinction should feel clear and reusable.

## Current implementation

The current Transformation / Topic Conditioning formative layer contains **28 interactions**.

All 28 now expose at least five options. The shared formative component enforces the five-option minimum and supports both:

- single-choice;
- multi-select with multiple defensible answers.

Each currently interactive Deep Dive also includes at least one intentional multi-select interaction.

## Relationship to Capability

Formative Deep Dive interactions teach.

Capability Checks prove.

Capability already supports single-choice, multi-select and sequence question kinds. Bank authoring should use those forms intentionally instead of flattening every reasoning problem into one-answer multiple choice.

## Authority

Founder correction: 2 October 2026.

Implementation branch:
`fix/preview-training-session-authority`


## Multi-select interaction structure - 2 October 2026

Multi-select is not a pile of plausible sentences. It must have a readable reasoning shape.

- The stem defines one clear selection rule, such as **Which conclusions are supported?**, **Which responses preserve the condition?**, or **Which actions violate the boundary?**
- Options are standalone claims. Do not mix a statement-selection stem with inherited Yes/No answers from an older binary question.
- Correct options must express distinct truths, not several paraphrases of the same principle.
- The component owns the instruction **Select all that apply.** Do not repeat that sentence inside the stem.
- Before confirmation, the interface shows how many options are selected.
- After confirmation, the interface separates missed required selections from selected options that do not apply.
- Fully correct multi-select feedback is concise and does not print a stack of repeated "Yes" explanations.
- The Core rule is always shown after a multi-select submission so the learner can compress the set back into one reusable RI principle.
