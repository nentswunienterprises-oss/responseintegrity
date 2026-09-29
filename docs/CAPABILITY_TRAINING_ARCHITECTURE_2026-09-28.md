# Capability Training Architecture - 28 September 2026

Status: **FOUNDER-APPROVED PRODUCT LAW; FEATURE-BRANCH IMPLEMENTATION COMPLETE; REVIEW/MAIN ACCEPTANCE OPEN**

## Purpose

This record defines how Specialist Training should produce evidence before Transformation authority opens Sandbox. It replaces the former Territory Director live-audit mechanism while preserving the principle that stable capability requires more than one lucky performance.

## Approved progression

```text
Interactive Deep Dive
-> Deep Dive Mastery
-> all five Transformation Deep Dives mastered
-> Transformation Delayed Retrieval
-> Transformation Interleaved Transfer
-> Sandbox unlocked
-> Session Infrastructure learned and evidenced in grounded operating context
```

Sandbox access is an expansion of the learning environment. It is not proof that Training is complete.

## 1. Deep Dive Mastery

Each Transformation Deep Dive owns a 45-item approved private bank.

A Mastery attempt:

- draws 15 questions from the 45-item bank;
- must preserve competency and critical-boundary coverage;
- passes only at 15/15 with no critical fail;
- allows at most three total attempts: initial attempt plus two retests.

Retry selection should be **unseen-first and preferably non-overlapping**. The 45-item bank should therefore be able to support three distinct balanced 15-question forms where coverage constraints permit.

A clean pass completes that Deep Dive. The Specialist does not need to answer all 45 items.

Unseen items remain Mastery-bank depth for retries, other Specialists, bank rotation and future revalidation. They are not automatically promoted into Retrieval or Transfer.

## 2. Transformation Delayed Retrieval

After all five Transformation Deep Dives are mastered, the Specialist must pass a separately authored cumulative Retrieval gate.

Approved target:

- 25 questions;
- 24/25 or better;
- no critical fail;
- spacing should preserve the existing delayed-retrieval principle rather than immediately repeat the Deep Dive context.

Retrieval should remove Deep Dive cues and require the Specialist to recover the correct RI framework from mixed Transformation content.

The Retrieval bank may reuse doctrine, competencies, critical boundaries and approved Truth from Mastery authoring, but it requires its own question authoring.

## 3. Transformation Interleaved Transfer

After Retrieval, the Specialist must pass a separately authored Transfer gate.

Approved target:

- 25 questions;
- 24/25 or better;
- no critical fail.

Transfer should use mixed scenarios in which the Specialist must determine which RI phase, rule, authority boundary or response applies without being told what is being tested.

Transfer is separately authored. Exact Mastery questions should not simply be copied into the Transfer layer.

## 4. Sandbox authority

Sandbox unlock requires:

1. Topic Conditioning Mastery;
2. Clarity Mastery;
3. Structured Execution Mastery;
4. Controlled Discomfort Mastery;
5. Time Pressure Stability Mastery;
6. Transformation Delayed Retrieval passed;
7. Transformation Interleaved Transfer passed.

Opening Sandbox does **not** mean Specialist Training is complete.

The original sequencing intent remains: once Transformation understanding is strong enough, Sandbox gives the Specialist a protected real operating environment. Session Infrastructure can then be learned and audited against something the Specialist can actually see and operate.

## 5. Interactive-learning law

The Quantic inspiration applies to the Training experience itself, not only to the final check.

Deep Dives should progressively move away from long passive reading toward a rhythm such as:

```text
small doctrine segment
-> teaching interaction
-> immediate response
-> explanation / Truth
-> next concept
-> scenario
-> response
-> explanation
-> continue
```

Teaching interactions are formative. They:

- help the Specialist think while learning;
- may use prediction, classification, scenario choices and operating distinctions;
- provide immediate feedback;
- do not consume a Capability attempt;
- do not become Mastery evidence.

The Capability Check remains the formal evidence gate after the active learning experience.

The Deep Dive delivery shell is now piece-by-piece rather than one long document scroll:

- one coherent learning unit is shown at a time;
- the Specialist advances deliberately with Continue;
- formative "Check your thinking" steps interrupt reading at regular points;
- a formative check must be answered before the next lesson step unlocks;
- immediate feedback remains teaching-only and creates no Mastery evidence;
- progress is visible throughout the lesson;
- the formal Capability Check is shown only after the Deep Dive lesson sequence is completed;
- larger drill recipes are split so each set is learned as its own lesson step rather than buried inside one long card.

The lesson runner remembers local reading progress for convenience, but that local progress is not Capability evidence and carries no lifecycle authority.

Specialist-facing UX should stay simple. Internal machinery such as deterministic seeds, bank depth, competency quotas and critical-boundary coverage should not become unnecessary learner-facing cognitive load.

## 6. Historical relationship

This architecture supersedes the old TD mechanism:

```text
15-question live audit
-> 96%+ three consecutive times
-> Deep Dive complete
```

The repeated-evidence principle is preserved, but the evidence is now stronger and differentiated:

```text
Mastery
-> Retrieval
-> Transfer
```

The Capability Engine's three attempts mean **one initial attempt plus two retests**, not three required passes.

## 7. Implementation status

The approved architecture is implemented on `fix/preview-training-session-authority` and in the isolated Capability Proof project.

Implemented:

- Mastery is a clean 15/15 pass with no critical fail;
- maximum three total Mastery attempts;
- Mastery retries prefer unseen bank items and fall back to the full bank only when the remaining unseen pool cannot preserve required coverage;
- five Transformation Masteries gate a 24-hour-spaced Delayed Retrieval assessment;
- Retrieval gates a separate Interleaved Transfer assessment;
- both cumulative Transformation gates use 25 questions and require 24/25+ with no critical fail;
- Capability, not legacy Battle Testing, owns the Training -> Sandbox transition;
- Sandbox unlock does not mark Training complete and opens Session Infrastructure learning in the protected operating environment;
- all five Transformation Deep Dives now run through a piece-by-piece lesson runner with formative teaching interactions that do not consume Capability attempts;
- the Specialist Capability Path UI exposes Mastery -> Retention -> Application -> Sandbox without surfacing unnecessary internal machinery;
- long-scroll delivery has been removed from the five Transformation Deep Dives: only the active lesson step is rendered, formative checks gate Continue, drill sets are separated into individual learning steps, and the Capability Check appears after lesson completion;
- current source-of-truth documents and integration tests have been reconciled to the new authority.

Proof content:

- `transformation_phases_retrieval_v1` bank v2 is separately authored with 25 items in Proof Review Mode;
- `transformation_state_transfer_v1` bank v2 is separately authored with 25 interleaved scenario items in Proof Review Mode;
- both banks have complete wrong-option-specific feedback and critical-boundary coverage;
- active Mastery configs in Proof use a 100% threshold and no new cooling-off interval.

Review and promotion remain open:

- Retrieval and Transfer v2 are deliberately still in Review Mode and do not count toward lifecycle promotion until Founder review exits;
- existing Deep Dive banks already in Review Mode remain governed by their review checkpoint;
- this feature branch has not been merged to `main`;
- the proposed mandatory 48-hour cooling-off period remains unresolved and is not implemented.

Capability Engine CI on the implemented branch proves focused Capability tests, the piece-by-piece Training frontend bundle, and the Preview API bundle.

Proof references:

- Capability Engine CI run `36513947780`: green after the piece-by-piece Deep Dive runner implementation, including focused Capability tests, Training frontend bundle, and Preview API bundle.
- Sandbox Simulation CI run `36477675853`: green, including Sandbox focused tests, live-runner frontend bundle, and Preview API bundle.
- Review/acceptance checkpoint: GitHub issue #113.

## Authority

Founder approval: 28 September 2026.

Affected surfaces include Capability Engine, Deep Dives, Specialist Training, Sandbox sequencing, operating documentation, COO Rulebook reconciliation and future canonical RI documentation.
