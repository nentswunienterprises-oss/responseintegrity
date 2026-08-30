# Response Integrity Growth Operating Model

Implementation-aligned version (holistic operating model).

## Why This Document Exists

This document aligns the growth architecture language with what is actually implemented in the product and operations stack.

It translates the strategy into operating rules, rhythm, gates, and mode logic.

## Core Principle

Response Integrity does not scale by chasing students.

It scales by building capacity, validating delivery quality, and only then opening live pod growth.

A pod is not a sales achievement.
A pod is the consequence of a healthy operating system.

## The Operating Philosophy

Every function produces a measurable output.
That output becomes the input for the next function.

No isolated departments.
No isolated scaling.
One system producing healthy pods.

## The Four Laws (Canonical)

1. Capacity Before Demand.
2. Validation Before Scale.
3. Proof Creates Demand.
4. Every Pod Strengthens the System.

## Our Rhythm (How We Actually Operate)

### Parent intake rhythm

- Full-year intake window: 1 Nov to 31 Jan
- Full-year training start: 1 Feb
- Mid-year intake window: 1 May to 31 May
- Mid-year training start: 1 Jun

### Tutor/operator rhythm

- Annual application window: 1 Oct to 31 Oct
- Annual conditioning window: 1 Nov to 15 Jan
- Annual deployment lock-in: 16 Jan to 31 Jan
- Annual deployment begins: 1 Feb

- Mid-year application window: 1 Apr to 30 Apr
- Mid-year conditioning window: 1 May to 20 May
- Mid-year deployment lock-in: 21 May to 31 May
- Mid-year deployment begins: 1 Jun

This rhythm is calendar-gated by system windows, not handled as ad hoc intake.

## Mode System (Applicant, Training, SB, CL)

Current implementation mode keys:

- applicant
- training
- sandbox
- certified_live
- watchlist
- suspended

Operational shorthand:

- Applicant = Applicant Mode
- Training = Training Mode
- SB = Sandbox Mode
- CL = Certified Live Mode

### What each mode means

| Mode | Meaning | Responsibility Access |
|---|---|---|
| Applicant | Documentation not complete; onboarding only | No parent responsibility |
| Training | Pre-sandbox conditioning active | No live responsibility |
| SB (Sandbox) | Controlled practice lane opened | Sandbox-only parent responsibility |
| CL (Certified Live) | Full certification reached | Live parent responsibility allowed |
| Watchlist | Drift or critical fail signal detected | Restricted and recovery-focused |
| Suspended | Repeated drift beyond threshold | Removed from active responsibility |

### Where Trial Is Implemented

Trial is a first-class tutor lifecycle mode between Sandbox and Certified Live.

Current implementation progression:

Applicant -> Training -> Sandbox -> Trial -> Certified Live

Definitions:

- Trial: tutor is actively running exactly two governed live family placements under validation constraints
- Certified Live: COO has explicitly approved the tutor after the Trial certification gate
- Pod Ready: operator-level and pod-level gates are both satisfied for scale participation

Graduation rule:

Trial -> Certified Live is determined by the Specialist Academy Validation Gate and an explicit COO decision record.
Training, sandbox, and Battle Testing completion can open Trial; they cannot certify a new tutor automatically.

Operational interpretation:

- trial family or student status = assignment lane for the two governed Trial families
- tutor mode = operating permission lane

Target architecture note:

- operating mode should be lifecycle only (applicant, training, sandbox, trial, certified_live, suspended)
- risk should be tracked separately as health state (locked, watchlist, fail)

### Implemented gate logic behind mode progression

1. If documentation is incomplete, mode is forced to Applicant.
2. If Transformation Phases module is complete, tutor can move to SB.
3. If Transformation Phases plus Session Infrastructure are complete, tutor can move to Trial.
4. If drift or critical fail appears, mode shifts into watchlist behavior.
5. If repeated drift reaches threshold, mode moves to retraining or suspension based on severity.

Trial gate overlay:

1. Sandbox -> Trial gate:
	docs complete, transformation complete, session infrastructure complete, readiness thresholds met, no active fail health.
2. Trial -> Certified Live gate:
	exactly two distinct Trial families, nine qualifying sessions per family, required logs and reports, feedback received or declined, positive COO outcome reviews, no active Trial risk, and explicit COO approval.
3. Certified Live -> Pod Ready gate:
	certified_live operator conditions plus pod-level composition and quality gates pass.

Meaning: trust expands only when evidence is present.

## Pilot vs Commercial Billing Logic (Current vs Proposed)

### Current implemented operating logic

- Commercial onboarding follows normal paid flow after proposal acceptance.
- Pilot onboarding can bypass immediate payment and run a pilot block before standard paid conversion.
- Current operating decision: pilot block remains 9 free sessions.

### Current decision in this model

- Keep 9 free pilot sessions for now.
- Treat 9-session pilot as a Validation asset, not a discount mechanic.
- Conversion to commercial must pass trial-to-live evidence gates.

### Billing and conversion gates for Trial

1. Trial entry gate:
	family is marked pilot, trial capacity available, and intake or validation policy allows entry.
2. Trial continuation gate:
	attendance integrity, session execution integrity, and minimum reporting cadence are met.
3. Trial conversion gate:
	measurable student movement, parent acceptance, and plan confirmation are complete.
4. Commercial activation gate:
	billing profile valid, payment authorization complete, and post-trial schedule activated.

## Sandbox Criteria Framework (6 Sandbox Accounts)

This is the practical readiness pack before Trial.

Total sandbox accounts allocated per specialist: 6

### Lane A: Reporting Proficiency (3 accounts)

Required evidence from each account:

- 4 weekly reports triggered
- 1 monthly report triggered

Interpretation:

- report content must match actual drill logic from the OS

### Lane B: Conditioning Execution (2 active accounts)

Required evidence:

- 1 account with 1 topic completed end-to-end through the full conditioning loop (all phases)
- other account parallel handling proven as 3 active topics managed concurrently for 4 weeks across the active Lane B accounts

Interpretation:

- end-to-end means phase progression with valid transition evidence
- concurrency means quality must hold while load increases at the same time

### Lane C: Control Buffer (1 untouched account)

Required evidence:

- one sandbox account remains intentionally untouched during the evaluation window

Purpose:

- preserves a controlled account for late-stage corrections and stress tests
- provides contingency for remediation or verification without contaminating completed evidence

### Sandbox -> Trial Gate Decision

A specialist moves from Sandbox to Trial only when all are true:

1. Lane A thresholds are met and triggered.
2. Lane B thresholds are met and evidenced.
3. Lane C control buffer is preserved.
4. No active fail health state exists.
5. Specialist Academy Validation Gate signs off readiness.

If any condition fails, the system returns a deterministic failure reason and assigns remediation work before retest.

There should be a progress bar regarding this so the user knows

## Capacity -> Validation -> Pod Economy

## Stage 1: Capacity Engine

Mission: produce deployment-ready specialists.

Flow:

Applications -> screening -> training -> battle testing -> certification readiness.

Output:

Certified operator capacity.

## Where Academy Fits (Exact System Placement)

Academy is the front door of the production system and the primary owner of Stage 1 (Capacity Engine).

It sits before validation and before pod formation.

System position:

Applications -> Academy -> Certified Capacity -> Validation Programme -> Validation Gate -> Pod Economy

### Academy mandate

Academy does not optimize for enrollment volume.
Academy optimizes for certification quality and deployment readiness.

### Academy inputs

- tutor applications
- interview and fit signals
- documentation completion status
- assessment readiness indicators

### Academy processes

- onboarding and documentation control
- doctrine training (Transformation Phases + Session Infrastructure)
- battle testing and streak validation
- mode progression readiness decisions

### Academy outputs

- certified-ready operators (for sandbox or live eligibility depending on completion)
- operator evidence records (scores, streaks, health signals)
- deployment recommendation state

### Academy gate responsibilities

Academy owns the truth of "capacity readiness" and therefore controls the first gating layer:

- Applicant -> Training
- Training -> SB
- SB -> Trial eligibility
- Trial -> CL graduation (via Specialist Academy Validation Gate plus explicit COO decision)

Validation and operations then control the next gates:

- CL eligibility -> live assignment permission
- live assignment permission -> pod-level scaling decisions

### Practical rule

If Academy output quality drops, Validation Gate closes and Pod Economy should not expand.

So Academy is not an HR side function.
Academy is the capacity manufacturing engine the entire operating model depends on.

## Stage 2: Validation Engine

Mission: prove that the capacity produces repeatable outcomes.

Validation flow:

- diagnostic placement
- structured session execution
- parent reporting
- outcome comparison
- evidence capture (testimonials, behavior change proof)

Output:

- measurable student movement
- operational proof
- specialist development signals
- parent trust assets

Clarification:

- Specialist Academy Validation Gate governs tutor graduation (including Trial -> Certified Live).
- Stage 2 Validation Gate governs system-scale permission (whether scaling should open or remain constrained).

## Validation Gate (Before Scale)

Scale does not open automatically.

The gate opens only when operational evidence is stable across:

- service consistency
- specialist consistency
- parent trust
- student outcome movement
- repeatability without founder heroics
- sufficient evidence assets (testimonials, case proofs)

In implemented product terms, this mirrors hard gate behavior:

- mode gating
- battle-test state gating
- workflow-stage gating
- scheduling and assignment gating

## Stage 3: Pod Economy

After validation is stable, the system shifts from proving to repeating.

Pod unit target:

- 12 certified response conditioning specialists
- 36 students
- 3 students per specialist
- 9-month conditioning arc (well, depending on intake window)

Pods are the operating unit, not just a reporting artifact.

## Pod Operating Classes (Implemented COO Reality)

Pods are already monitored by operating-state composition:

- Training Plant Pods
- Sandbox Training Pods
- Certified Live Pods
- Misaligned Pods

Misaligned pods are a correction signal, not a normal steady-state class.

## Growth Engines (Connected)

1. Specialist Development Engine -> creates capacity.
2. Distribution Engine -> creates access.
3. Social Growth Engine -> creates qualified demand.
4. Validation Engine -> creates proof.

Platform and operations convert these four outputs into pod formation and repeatable delivery.

## Canonical Systems Blueprint

```text
Build Capacity -> Validate Quality -> Scale Proof

Specialist Academy
	-> Certified Capacity
	-> Distribution + Social Growth
	-> Validation Programme
	-> Validation Gate
			-> Not passed: retrain and improve system
			-> Passed: Pod Economy
	-> Student outcomes + parent trust + testimonials + referrals + data
	-> Stronger Academy + Distribution + Social
	-> Next generation of pods
```

## Flywheel Logic

Capacity -> Validation -> Proof -> Trust -> Demand -> Pod Creation -> Outcomes -> Testimonials/Referrals/Data -> Stronger Capacity.

Each completed cycle increases the probability of the next cycle.

## Launch Economy (Operating Intent)

During launch, platform economics fund ecosystem manufacturing, not just profit extraction.

The model prioritizes:

- platform operations reliability
- technology reserves
- validation and growth reinvestment
- reward for verified contribution to system growth

## North Star

Response Integrity is an educational production system.

The objective is to continuously produce:

- capacity
- proof
- trust
- demand
- healthy pods

When each pod strengthens the conditions for the next pod, growth becomes an emergent system property.

## Software Philosophy: State-Truth Before Progress

Traditional software asks: what screen comes next?

Response Integrity software asks: what condition must become true before the next state is allowed?

Think like a compiler:

Cannot compile. Missing dependency.

Equivalent product behavior:

```text
Cannot create pod.

Reason:
Only 9 certified specialists available.

Required:
12 certified specialists.
```

This is not an error style.
It is operating clarity.

## Strategic Success Condition

Success is not more random enrollments.

Success is a system where:

- Capacity consistently creates Validation
- Validation consistently creates Trust
- Trust consistently creates Demand
- Demand consistently creates Pods
- Pods consistently strengthen Capacity

At that point, growth is architecture-driven, not effort-dependent.

## Alignment Check: Proposed Idea vs Current Implementation

Short answer: mostly yes, with targeted gaps.

### What already aligns strongly

1. Capacity-before-demand rhythm is implemented through calendar-gated intake and tutor cycle windows.
2. Validation-before-scale behavior is implemented through mode gating, battle-test states, and assignment restrictions.
3. Proof-driven progression is implemented through deterministic scoring and mode reconciliation.
4. Pod-level operational monitoring exists, including misalignment detection classes.

### Where implementation is still behind the proposed architecture

1. Mode naming still mixes training status and risk status.
Current model includes `watchlist` inside the mode enum, while conceptually watchlist is a health or risk state, not an operating mode.

2. Validation Gate is partially distributed across logic paths.
Gate checks exist, but they are not yet represented as one explicit, auditable "Pod Formation Readiness" contract.

3. Pod creation constraints are not yet consistently compiler-style at all creation points.
Some flows enforce constraints, but the architecture calls for universal, deterministic "cannot advance because missing dependency" responses.

4. Evidence sufficiency for scale is implied but not yet centralized.
Testimonials, parent trust, student movement, and repeatability are not yet unified in one gate score used everywhere.

## Mode Tweaks Needed to Fully Support the Proposed Idea

### Tweak 1: Separate operating mode from risk state

Keep operating mode as:

- applicant
- training
- sandbox
- trial
- certified_live
- suspended

Move risk to a separate field, for example:

- operational_health: locked | watchlist | fail

This is the target-state cleanup of current implementation semantics.

Why:

- cleaner lifecycle semantics
- fewer contradictory states
- easier pod-state classification and gating

### Tweak 2: Add explicit readiness contract per transition

For each major transition, define required conditions and machine-readable failure reasons.

Examples:

- Training -> Sandbox requires: docs complete, transformation module complete, no critical fail lock
- Sandbox -> Trial requires: transformation complete, session infrastructure complete, readiness threshold met, no active fail health
- Trial -> Certified Live requires: exactly two distinct Trial families, nine qualifying sessions per family, required logs and reports, feedback received or declined, positive COO outcome reviews, no active Trial risk, and explicit COO approval
- Certified Live -> Pod Assignment requires: mode is certified_live, health not fail, assignment-cap rules satisfied

### Tweak 3: Introduce a single Validation Gate object

Add a consolidated gate record or computed view:

- service_consistency_pass
- specialist_consistency_pass
- parent_satisfaction_pass
- student_outcome_pass
- operational_repeatability_pass
- evidence_sufficiency_pass
- overall_gate_pass

Why:

- directly matches the proposed holistic model
- makes executive decisions auditable
- gives software one canonical source for scale permission

### Tweak 4: Enforce compiler-style guardrails on pod actions

All pod-forming actions should return deterministic failures, for example:

- cannot create pod: certified_live_count < 12
- cannot assign live parent: tutor_mode != certified_live
- cannot open intake expansion: validation_gate_pass = false

### Tweak 5: Align pod taxonomy with transition policy

Use existing pod classes as policy signals:

- training_plant: no live parent load allowed
- sandbox_training: sandbox-only parent load
- certified_live: normal live scaling lane
- misaligned: trigger pod remediation workflow

This turns pod labels into active governance, not only dashboard display.

## Practical Priority Order

1. Split mode from risk state.
2. Add transition readiness contract checks.
3. Add consolidated Validation Gate object.
4. Enforce compiler-style pod guardrail responses across all write paths.
5. Bind pod classes to remediation or scale policies.

If these five tweaks are implemented, the current system will move from "mostly aligned" to "architecturally faithful" with the proposed operating model.
