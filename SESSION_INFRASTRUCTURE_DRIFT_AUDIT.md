# Session Infrastructure Drift Audit

## Purpose

This document captures where the `Response Conditioning System` deep dives have drifted from the actual live operating flow in code, specifically around session infrastructure, session types, session purpose, and tutor-facing system language.

This is not a philosophy note. It is an implementation and operations alignment note.

The goal is:

- identify what the training pages currently teach
- identify what the live product actually does
- highlight where tutor understanding can break
- define the cleanup direction before we rewrite the deep dives

---

## Current Reality In Product

The live system no longer operates as if every tutor session follows one generic loop.

The actual system now has distinct session types with distinct purposes:

1. `Evidence-Complete Intro Diagnosis`
- used for placement verification
- starts from a recommended phase
- verifies performance phase-by-phase
- can escalate or de-escalate
- stops when the correct entry point is found

2. `Active Training`
- used after diagnosis and activation
- builds stability inside the student’s current phase/topic state
- this is where structured teaching loops belong

3. `Tutor Handover Verification`
- used when a student is reassigned to a new tutor
- does not restart onboarding
- preserves existing training history
- verifies inherited topic-state before normal training continues

So operationally, the system is now:

`Parent signal -> System recommendation -> Adaptive intro diagnosis -> Active training -> Handover verification when needed -> Resume training`

That is the live operating model.

---

## Bottleneck

The bottleneck is not a missing page.

The bottleneck is that the `Session Infrastructure` teaching pages are still presenting older or flatter session logic, while the live product has already evolved into a multi-session-type system.

That creates a tutor comprehension problem:

- the product behaves one way
- the internal training pages explain another
- the tutor is forced to mentally reconcile both

That is where drift becomes operational risk.

---

## Where Drift Exists

## 1. The system still teaches one generic session flow

In the deep dive for session flow control, the content currently presents a universal session loop:

- Prepare
- Model
- Apply
- Guide
- Boss Battle

It also frames this as the structure for `every Response Integrity tutoring session`.

### Why that is now wrong

That loop is only valid for `active training`.

It is not the operating shape for:

- adaptive intro diagnosis
- handover verification

Those are verification flows, not standard training loops.

### Risk

This teaches tutors to over-teach during sessions that should be used to verify:

- placement
- inherited state
- response stability

Instead of:

- introducing friction-light verification
- respecting stop logic
- letting the system determine the next move

---

## 2. Intro is still described like an old conversational intake

The intro deep dive still describes intro as:

- Orientation
- Surface the Pattern
- Diagnose the Layer

It also emphasizes identifying the `broken learning layer`.

### Why that is now wrong

Live intro is no longer mainly a conversational intake.

Live Intro is now evidence-complete and phase-aware.

The system asks the smallest next evidence question required to establish the earliest unsupported layer and a defensible topic-entry state.

Diagnosis stops when the required evidence is resolved. The Specialist records concrete behavior and preserves the active probe condition; the system owns interpretation, placement, and the next evidence question.

### Risk

The current deep dive still trains tutors to think:

- “find the broken layer”

instead of:

- “find the correct entry phase”

That is a major conceptual mismatch.

---

## 3. Layer language and phase language are being mixed incorrectly

The current pages still blur:

- `layer`
- `phase`
- `session`
- `drill`
- `conditioning`

### What each term should mean

`Phase`
- a response stability stage
- Clarity
- Structured Execution
- Controlled Discomfort
- Time Pressure Stability

`Concept Lens`
- the internal teaching lens for a concept
- vocabulary
- method
- reason

`Session Type`
- the operational purpose of the session
- adaptive intro diagnosis
- active training
- handover verification

### Why this matters

If tutors are taught that intro is about a `broken layer`, they can confuse:

- concept misunderstanding
with
- response-stage placement

That leads to muddled execution.

The tutor needs to understand:

- `layers` are used inside teaching
- `phases` are used for placement and response stability

Those are not the same thing.

---

## 4. Logging system content is partly teaching an older scoring model

The logging deep dive still presents a `drill total -> system decision -> next action` model inside one selected phase, with internal demo logic centered on:

- set totals
- drill total
- resolved stability
- system decision

### Why this is now incomplete

That is not the full live intro model anymore.

Live diagnosis now includes:

- one verification block per phase
- phase score out of `/100`
- band-based movement
- escalation or de-escalation
- stop when placement is found

So the current logging page is still closer to:

- “score the drill and determine stability in this phase”

when live intro now also requires:

- “score the phase block and decide whether to move up, move down, or stop”

### Risk

Tutors may understand logging as:

- outcome reporting

instead of:

- evidence capture for system movement

The system should teach:

- logging is evidence
- the system uses that evidence to place or continue
- tutors do not manually reinterpret what the score means

---

## 5. Handover verification is missing from the session infrastructure map

The live product now has a real handover verification flow.

That includes:

- reassignment state
- continuity-check booking
- tutor-side handover gate
- completion logic before training systems fully reopen

But the `Response Conditioning System` map still does not represent handover as a first-class session type.

### Why that matters

This means the training map still implies a world of:

- intro
- training

when the real system is now:

- intro
- training
- handover verification

### Risk

A tutor using only the system pages would not have a clean operational mental model for reassignment flow.

That is where terminology like:

- re-intro
- restart
- onboarding again

can creep back in.

That is exactly what the live product is trying to avoid.

---

## 6. Jargon density is higher than it needs to be

Some of the current deep dives use strong internal language, but not always the clearest tutor-operational language.

Examples of drift:

- `Transformation Process`
- `Session Operating System`
- `broken learning layer`
- `the system map`
- `mechanism gate`

These are not necessarily wrong in spirit, but they are not always the cleanest operational labels for fast tutor understanding.

### The practical issue

When jargon becomes too compressed, tutors have to decode the sentence before they can act on it.

That slows execution and increases interpretation drift.

The system pages should optimize for:

- clarity
- sequence
- operational purpose
- non-ambiguous action

not for internal mystique.

---

## What Breaks If We Leave It As Is

If we leave the deep dives as they are, several things remain fragile:

1. `Tutors may over-teach during intro diagnosis`
- because the docs still describe intro too much like an interactive intake/teaching session

2. `Tutors may misread placement logic`
- because the docs still use `layer` language where the live system now uses `phase` logic

3. `Tutors may treat handover like re-onboarding`
- because handover is not clearly modeled as its own session type in the docs

4. `Tutors may treat logging like interpretation instead of evidence capture`
- because the scoring explanation still feels phase-contained instead of movement-aware

5. `Tutor comprehension cost stays too high`
- because the session pages are no longer speaking the same language as the live workflow

---

## Recommended Fix Direction

We should rewrite `Session Infrastructure` around `session types and system purpose`, not around one generic tutoring session.

### Recommended new structure

1. `Evidence-Complete Intro Diagnosis`
- what it is
- what it is not
- evidence questions and eligibility
- system-selected adjacent verification
- evidence-complete stop logic

2. `Active Training Session`
- where Model / Apply / Guide / Boss Battle belongs
- what active training is trying to build
- how topic-state is reinforced

3. `Tutor Handover Verification`
- why it exists
- why it is not re-intro
- how it preserves continuity
- what happens before systems reopen

4. `Evidence Logging and System Decisions`
- what tutors log
- what the system decides
- what tutors should not reinterpret

5. `Tools and Live Delivery Setup`
- operational setup
- camera
- lighting
- audio

---

## Recommended Language Cleanup

The system should standardize on simpler, cleaner terminology.

### Replace

`Intro Session Structure`

### With

`Evidence-Complete Intro Diagnosis`

Reason:
- this is what the session actually is now

### Replace

`Session Flow Control`

### With

`Session Types and Operating Flow`

Reason:
- the issue is no longer just “how one session flows”
- the issue is “which session type are we in and what is its purpose”

### Replace

`Logging System`

### With

`Evidence Logging and System Decisions`

Reason:
- this tells tutors what logging is for

### Add

`Tutor Handover Verification`

Reason:
- this is now part of live session infrastructure

---

## Recommended Terminology Standard

### Use `phase` for:

- response stability stage
- placement logic
- phase-based progression

### Use `concept lens` for:

- vocabulary
- method
- reason

### Use `session type` for:

- adaptive intro diagnosis
- active training
- tutor handover verification

### Avoid using `layer` as a placement word

Why:
- it now conflicts with the phase model

---

## Simpler Tutor-Facing Operating Rules

These are the kinds of lines the deep dives should teach:

`Intro diagnosis verifies starting phase.`

`Training sessions build stability inside the current phase.`

`Handover verification confirms inherited state after tutor reassignment.`

`Logging captures evidence. The system decides movement.`

That is the right operational clarity.

---

## Proposed Rewrite Outcome

After rewrite, the session infrastructure pages should leave the tutor with this mental model:

1. `What kind of session is this?`
2. `What is this session trying to do?`
3. `What should I not do in this session?`
4. `What evidence does the system need from me?`
5. `What happens next after this session?`

That is more aligned with the actual product, cleaner for tutor comprehension, and easier to maintain as the live system evolves.

---

## Implementation Recommendation

Before rewriting the pages in code:

1. approve the new terminology set
2. approve the new session-type-based content architecture
3. decide whether to keep or remove old `.jsx` duplicates alongside `.tsx` files

Then rewrite the following in order:

1. `session-flow-control`
2. `intro-session-structure`
3. `logging-system`
4. add `handover-verification`
5. update the top-level `responseconditioningsystem.tsx` index labels

---

## Final Position

The drift is real, but fixable.

The product has already evolved into a stronger operating model:

- adaptive diagnosis
- system-guided placement
- continuity-preserving handover verification

The deep dives now need to catch up.

The right rewrite principle is:

`teach tutors the actual live operating flow, using simpler and stricter language than before`
