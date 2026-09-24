# Tutor Handover Verification Design

## Purpose

This document defines how Response Integrity should handle student reassignment from one tutor to another after intro diagnosis and active training have already begun.

The core principle is:

`Handover is verification, not re-onboarding.`

That means:

- do not restart the student
- do not rerun intro diagnosis by default
- do not discard previous topic-state history
- do verify that inherited state is still trustworthy before the new tutor continues

## Why This Is Needed

Once a student has:

- completed intro diagnosis
- entered active training
- accumulated topic drill history

the system source of truth is no longer the tutor alone.

The source of truth is now:

- topic history
- phase/stability history
- drill results
- recent trends
- next actions
- constraints
- parent-facing proposal context

If a new tutor is assigned and the system simply restarts intro diagnosis, the product creates false resets and weakens state integrity.

## What We Must Avoid

### 1. Re-intro by default

This is wrong because:

- intro is for initial placement
- reassignment is not initial placement
- the student may already have validated topic-state history

### 2. Blind continuation with no verification

This is also weak because:

- the new tutor may inherit stale or unclear state
- there may have been a gap in training
- previous logging quality may not be strong enough

So the answer is not:

- full restart

and not:

- blind trust

The answer is:

- handover verification

## Core Model

When a tutor is reassigned to an active student, the system should:

1. preserve all prior intro diagnosis and training history
2. mark the student as entering `handover verification`
3. require the new tutor to run short verification checks on inherited active topics
4. decide whether current stored topic-state:
   - holds
   - needs a small adjustment
   - needs targeted re-diagnosis
5. only after verification, allow standard active training to resume

## Handover Verification vs Intro Diagnosis

These are not the same thing.

### Intro diagnosis

Purpose:

- initial placement
- find entry phase
- find entry stability

Used when:

- student first enters topic conditioning

### Handover verification

Purpose:

- validate inherited topic-state
- ensure continuity is still safe
- protect against stale or misleading carryover

Used when:

- student already has phase/stability history
- tutor changes

So handover verification is not a weaker intro.
It is a different system event with a different question.

## The Question Handover Verification Must Answer

`Can the new tutor safely continue from the current stored topic-state?`

That is the only core question.

Not:

- where should the student begin for the first time?

But:

- is the current state still trustworthy enough to continue from?

## Trigger Conditions

Handover verification should trigger when:

- a student with existing Response Integrity topic-state is assigned to a new tutor

The requirement should apply when at least one of these is true:

- there is a prior intro diagnosis on record
- there are active topic conditioning entries
- there are prior training drills for the student

## Parent Experience Rule

The parent should not experience reassignment as re-onboarding.

That means the UI must not imply:

- your child is starting over
- your child is being re-evaluated from scratch
- the previous training did not count

Instead, parent-facing language should communicate:

- your child’s training history remains intact
- the new tutor is reviewing current progress
- a short continuity check may happen before sessions continue

## Parent Reassignment UI State

We should introduce a specific parent-visible state for reassigned active students.

Recommended state:

`Tutor Reassignment In Progress`

After tutor accepts:

`Continuity Check`

Then:

`Active`

### Parent-facing copy

#### State: Tutor Reassignment In Progress

Suggested wording:

`A new tutor is being assigned to continue your child’s Response Integrity program. Your child’s progress and training history remain in place.`

#### State: Continuity Check

Suggested wording:

`Your child’s new tutor is completing a short continuity check to confirm the current training state before continuing. This is not a restart of the program.`

#### State: Active

Suggested wording:

`Training has resumed with the new tutor using your child’s existing Response Integrity progress history.`

This keeps the parent oriented correctly.

## Tutor Experience Rule

The tutor should not be asked to guess whether to trust the inherited state.

The system should give the tutor:

- inherited active topics
- current phase/stability per topic
- last few drill results
- trend
- next action
- constraints
- original diagnosis summary
- handover verification tasks

The tutor’s job is:

- run verification
- observe honestly
- let the system confirm or correct the state

## Handover Verification Scope

Handover verification should be:

- topic-specific
- phase-aware
- short
- non-training

This is not a full session rebuild.

It is a targeted continuity check.

## Which Topics Should Be Verified

By default:

- verify the student’s currently active topics

If too many topics are active:

- prioritize top 1 to 2 topics by:
  - most recent work
  - highest friction
  - phase sensitivity

This avoids making reassignment too heavy.

## Verification Unit

Handover verification is evidence-driven rather than score-block-driven.

The live model is:

- inherit the topic's current phase and stability as the state under test;
- prepare a small reserve bank of phase-appropriate continuity problems;
- present one clean opportunity at a time;
- record concrete behavior against the inherited phase dimensions;
- stop as soon as the Response Evidence Model has enough evidence to hold, adjust, or exit to targeted re-diagnosis.

There is no fixed rep-completion requirement. The bounded window prevents continuity verification from quietly becoming Training.

## Canonical Behavior Contract

Handover uses the same concrete behavior definitions as evidence-complete Diagnosis.

Every phase-defining dimension can resolve from breakdown, conditional, near-stable, supported, not observed, or confounded.

The replacement Specialist records the behavior that happened. The system owns the evidence class, dimension state, recovery law, and whole-topic outcome.

Missing or contaminated evidence is never translated into weakness or strength.

## Verification Logic

Handover starts from inherited truth rather than neutral placement.

Example:

- Topic: Fractions
- Inherited state: `Structured Execution / High`

The continuity question is whether the inherited Structured Execution capability still holds under the correct no-help execution condition and whether the inherited stability remains defensible from clean evidence.

The question is not what phase the replacement Specialist would personally choose.

## Live Outcomes

### 1. Hold

Enough decision-eligible evidence supports the inherited phase and stability without a contradiction requiring reclassification.

Action: preserve inherited phase and stability and clear continuation once the Handover workflow is complete.

### 2. Stability adjust

The inherited phase remains usable, but conditional evidence persists through the bounded continuity window.

Current reduction law:

- `High Maintenance -> High`
- `High -> Medium`
- `Medium -> Medium`
- `Low -> Low`

Conditional evidence alone cannot mint `Low`.

### 3. Targeted re-diagnosis required

A phase-defining breakdown is confirmed, or the bounded Handover window ends without enough clean decision-eligible evidence.

Action: freeze the inherited state for continuity purposes, keep normal Training closed, and launch targeted evidence-complete Diagnosis. Diagnosis owns reclassification.

This is not full student re-onboarding.

## Recovery Law

With the current minimum of two valid opportunities, an earlier real breakdown requires three trailing clean supported comparable opportunities before recovery is confirmed.

Therefore:

- breakdown + two clean opportunities is not yet recovery;
- breakdown + three trailing supported opportunities can resolve as recovered;
- the Specialist must not keep adding opportunities after the system has already resolved an outcome.

## Data Integrity Rule

Handover must not overwrite Intro history or Training history.

Each Handover event preserves:

- student and Specialist lineage;
- topic;
- inherited phase and stability;
- verification schema ID, version, and definition hash;
- constraint profile;
- concrete behavior option identity and label;
- Response Evidence class;
- not-observed or confounded status where applicable;
- per-dimension resolution;
- recovery status;
- Handover outcome and reason;
- resulting phase/stability;
- targeted re-diagnosis requirement;
- next action and constraint;
- timestamp.

## Practical Evidence Examples

### Clean continuity

Two clean supported opportunities across the inherited phase dimensions are enough for a normal hold when no earlier contradiction exists.

### Near-stable continuity

Near-stable behavior can still support a hold. It must not be collapsed into generic weakness merely because it is not perfectly clean.

### Recoverable contradiction

One earlier breakdown followed by only two clean opportunities remains unresolved/conditional. A third trailing supported comparable opportunity is required before recovery can be confirmed.

### Missing or contaminated evidence

If a behavior is not meaningfully observable, record `not_observed`.

If an intervention, interruption, timer change, or another condition changes what is being observed, record `confounded`.

Neither becomes weakness or strength. The system asks for clean evidence or routes to targeted re-diagnosis if the bounded window closes unresolved.

## Tutor UI State

When a tutor inherits an active student, the tutor UI should show:

`Handover Verification Required`

Inside the student card or session launcher, show:

- inherited topics
- current stored state
- last updated time
- last drill trend
- verification required banner

Suggested tutor copy:

`This student is continuing from a previous tutor. Run handover verification before standard training resumes.`

## Session Access Rule

Until handover verification is complete, the system should:

- allow handover verification launch
- block normal training drill launch

This is important.

Otherwise tutors may skip verification and immediately continue training from a state they have not validated.

## Parent Portal Behavior

The parent portal should reflect continuity.

Recommended behavior:

- retain prior completed session history
- retain reports
- retain progress state
- show tutor reassignment status
- show continuity check as a short transitional step

Do not:

- reset progress bars
- relabel the student as newly enrolled
- require proposal re-acceptance unless the commercial logic actually changed

## System Rule Summary

When tutor changes for an already active Response Integrity student:

1. preserve all diagnosis and training history
2. mark student as reassigned
3. require handover verification
4. validate inherited topic-state
5. then unlock normal training

## Final Recommendation

The product should implement:

`Tutor Reassignment -> Handover Verification -> Continue Training`

Not:

`Tutor Reassignment -> Re-Intro Session`

This is the strongest design because it:

- preserves system continuity
- protects state integrity
- avoids false resets
- gives the new tutor a controlled entry point
- gives parents confidence that progress is continuing, not restarting

## Implementation Direction

The next implementation layer should include:

- new workflow state for reassigned active students
- parent UI reassignment state
- tutor UI handover verification gate
- new verification event type
- topic-state update rules for verification outcomes
- targeted re-diagnosis trigger path where needed
