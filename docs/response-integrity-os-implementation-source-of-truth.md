# Response Integrity-OS Live Implementation Source of Truth

Last updated: 2026-05-17
Status: Canonical implementation spec

## Purpose

This document is the single human-readable source of truth for the live Response Integrity-OS product, algorithm, service-delivery flow, reporting logic, and integrity layer in this repository.

It is intentionally large.

It exists so that:

- a human can understand the whole implemented system from one file
- an AI agent can reason about the whole product from one file
- no surrounding explainer is required in order to understand the core product logic
- drift between design language and live runtime behavior is reduced as much as possible

This file absorbs the essential explanatory content that used to live across multiple supporting engine docs.

## Reading Rules

Read this file with these rules:

1. This file is the sole documentation authority for Response Integrity-OS.
2. Other docs may still exist, but they are derivative, archival, historical, or specialized views.
3. If another doc conflicts with this file, this file wins.
4. If this file and the current code ever disagree, the current code is the live runtime behavior and this file must be updated immediately in the same workstream.
5. No Response Integrity-OS algorithm change is complete until this document is updated.

## What Response Integrity-OS Is

Response Integrity-OS is not a generic tutoring workflow.

It is a response-conditioning operating system delivered through mathematics.

Its product logic is:

- the student is not treated as one global math state
- each topic has its own response state
- the system classifies that topic by phase and stability
- tutors do not decide the final state manually
- tutors capture evidence
- the system converts evidence into deterministic topic movement
- reports are derived from topic movement, not tutor-written impressions
- operational integrity matters as much as instructional quality

Math is the arena.
Response is the skill.
Stable execution under difficulty is the product target.

## Product Definition

The platform is built around these principles:

- a session is not a blank tutoring event
- a session is the execution of a specific drill attached to a topic-state
- a drill is the smallest controlled training unit in the system
- a topic does not move because a tutor "felt progress"
- a topic moves because drill evidence was captured and processed through deterministic rules
- a tutor is an operator inside the system, not a free-form session designer
- the platform must tell the tutor what to run, what to prepare, what to observe, and what happens next

## Non-Negotiable Product Rules

These are product-protection rules, not stylistic preferences.

Do not build Response Integrity-OS around:

- open-ended session notes as the main system
- flexible tutor-designed lesson flows
- free typing everywhere
- manual phase selection during active training
- generic progress trackers without drill logic
- tutor-authored state movement that bypasses scored drill evidence

If the system becomes a loose tutoring tracker, it stops being Response Integrity-OS.

## System Layers

Response Integrity-OS is easiest to understand in four layers.

### 1. Operational shell

This is the scheduling, compliance, and delivery shell around the drill engine.

It answers:

- when the lesson is happening
- who is attending
- whether the lesson is confirmed
- whether the drill runner may be launched
- which scheduled session the drill belongs to
- whether a Meet link exists
- whether recording artifacts were found

### 2. Instruction shell

This is the layer that determines:

- which topic is active
- which mode is being run
- which phase applies
- which stability applies
- which drill set structure applies
- what prep rules the tutor must hold
- what observation fields appear on each rep

### 3. Deterministic engine core

This is the locked runtime that determines:

- symptom-based starting phase recommendation
- diagnosis placement
- training scoring
- topic-state transitions
- handover verification outcomes
- behavior mapping
- parent meaning
- next actions
- report generation

### 4. Integrity layer

This is the control layer that determines:

- whether tutors still understand and execute Response Integrity-OS correctly
- whether TDs are enforcing the system correctly
- whether operators are locked, watchlist, or fail
- whether the evidence trail can be trusted

## Canonical Code Map

The live implementation is primarily distributed across these files:

- `shared/topicConditioningEngine.ts`
- `shared/adaptiveDiagnosis.ts`
- `shared/responseSymptomMapping.ts`
- `shared/observationScoring.ts`
- `shared/battleTesting.ts`
- `server/battleTesting.ts`
- `server/routes.ts`
- `client/src/components/tutor/IntroSessionDrillRunner.tsx`

The main live endpoints involved in the engine are:

- `GET /api/tutor/students/:studentId/drill-session-access`
- `POST /api/tutor/intro-session-drill`
- `POST /api/tutor/training-session-drill`
- `POST /api/tutor/handover-verification-drill`
- `GET /api/parent/reports`
- `POST /api/parent/reports/:id/feedback`

Core test coverage for the shared algorithm layer currently exists in:

- `shared/topicConditioningEngine.test.ts`
- `shared/adaptiveDiagnosis.test.ts`
- `shared/observationScoring.test.ts`

## Product Domain Model

These are the most important product objects and distinctions.

### Student workflow stages

The product works with these high-level workflow stages:

- `Assignment Pending`
- `Intro Booking`
- `Intro Confirmed`
- `Active Training`

These states live above topic-level conditioning.

### Topic state

Each active topic conceptually carries:

- topic name
- current phase
- current stability
- current drill or current drill family
- next action
- constraint or active rule
- most recent transition result

This is the true unit of conditioning.

### Intake topic source of truth

The authoritative intake topic model is topic-structured, not a legacy free-text field.

The live runtime should derive pre-session topic intelligence from:

- `topic_response_symptom_ids` or `topic_response_symptoms`
- `topic_recommended_starting_phases`
- a derived `reported_topics` view assembled from those topic-structured fields

Parent intake should submit topics in structured form rather than relying on a legacy comma-separated topic string.

Legacy topic strings such as `math_struggle_areas` are not part of the live Response Integrity-OS topic-conditioning flow and should not be read or written by current runtime paths.

### Scheduled session

The operational shell uses `scheduled_sessions` as the real-world lesson container.

Live repo evidence shows that scheduled sessions already exist and are tied to:

- tutor
- student
- session type
- workflow stage
- confirmation status
- Google event identity
- Google Meet URL
- recording status
- training and intro drill linkage

At a conceptual level, a scheduled session contains:

- id
- student id
- tutor id
- type or kind
- workflow stage
- scheduled start
- scheduled end
- timezone
- confirmation state
- lesson status
- Google event id
- Google Meet URL
- recording status

### Training session run

A training session run is not the same thing as a scheduled session.

It is the pedagogical multi-topic drill container that can sit inside a scheduled lesson.

It groups one or more topic drills that happen during a training lesson.

### Drill row / drill run

The actual state-update unit is the drill-level topic submission.

For reporting purposes, each stored drill row is later normalized into a deterministic session-like object with fields such as:

- date
- session group id
- topic
- drill type
- score
- phase before
- phase after
- stability before
- stability after
- next action
- transition reason
- deterministic log or payload

### Critical distinction

These three objects are not the same:

- `scheduled_session` = operational calendar and compliance container
- `training_session_run` = pedagogical multi-topic container inside a lesson
- `drill row / drill run` = per-topic execution and state-update unit

The system is only coherent when those distinctions stay clear.

## Service Delivery Lifecycle

### Student-level lifecycle

The platform moves students through this operating chain:

1. A tutor assignment exists.
2. The intro lesson is scheduled and confirmed.
3. The tutor adds or confirms a diagnostic topic.
4. The tutor launches the intro drill only from a valid intro lesson context.
5. The system diagnoses topic entry state.
6. The topic becomes active for normal conditioning.
7. Active training lessons continue through scheduled lessons plus topic drills.
8. Topic state changes are reported deterministically.
9. If tutor handover occurs, continuity verification or targeted re-diagnosis is run before normal training resumes.

### Topic activation flow

At a conceptual level, the topic activation sequence is:

1. Tutor runs diagnosis.
2. System determines topic entry phase and stability.
3. System generates the training proposal or operating recommendation.
4. Topic becomes active in the map and drill cycle.
5. From that point onward the topic participates in:
   - maps
   - next-action logic
   - reporting
   - topic-state transitions
   - integrity review

Activation is the moment the topic becomes live in the OS.

### Launch gating

The drill runner does not exist as a free-floating tool.

The access-gate route validates whether the tutor may open it.

Current live gating behavior includes:

- intro drills require a confirmed intro session
- training drills require a scheduled and launch-valid training lesson
- handover verification requires a confirmed continuity-check session
- if a valid lesson context is missing, the runner should not launch

This is important because Response Integrity-OS is not meant to behave like ad hoc tutoring.

## Core System Model

### Phases

The live topic phases are:

- `Clarity`
- `Structured Execution`
- `Controlled Discomfort`
- `Time Pressure Stability`

### Stability states

The live topic stability states are:

- `Low`
- `Medium`
- `High`
- `High Maintenance`

### Final phase rule

`Time Pressure Stability` is the final core phase.

When a topic is already in `Time Pressure Stability / High Maintenance` and performs strongly again, the system does not enter a fifth phase.

It remains in:

- `Time Pressure Stability / High Maintenance`

### Phase sequence

The intended forward sequence is:

- `Clarity` -> `Structured Execution` -> `Controlled Discomfort` -> `Time Pressure Stability`

There is no cross-phase regression engine currently implemented inside the core transition function.

Stability can regress inside the current phase.

## Phase Doctrine

This section defines what each phase means in the live product.

### Clarity

Purpose:

- can the student see the problem clearly before solving
- can they name what is present
- can they recognize the method
- can they explain why it works

Constraints:

- no boss battles
- no time pressure
- no skipping layers

Interpretation:

- if this phase fails, everything downstream is unstable
- this is where explanation is most visible
- this is still not "teaching for teaching's sake"
- it is structured concept-entry conditioning

### Structured Execution

Purpose:

- test and build ability to execute the known method independently
- student may know what to do, but now must prove they can do it alone

Constraints:

- state steps before solving
- no guessing tolerated
- no skipping steps

Interpretation:

- this phase is about method discipline
- it protects sequence, structure, and independent starts
- it is not yet discomfort or time-pressure work

### Controlled Discomfort

Purpose:

- test and stabilize behavior under uncertainty and difficulty
- see whether the student persists or collapses

Constraints:

- no full rescue
- hold discomfort window
- one-step confirmation max

Interpretation:

- the target is response under force
- difficulty is a training input, not the output
- the tutor must not remove the discomfort the phase is meant to expose

### Time Pressure Stability

Purpose:

- maintain method structure under urgency
- keep response intact while time constraint is present

Constraints:

- method over speed
- timer is active
- structured response required and panic responding is logged as instability

Interpretation:

- speed is not the true target
- structure under time is the target
- this is the final core conditioning phase

## Drill Runner Doctrine

The drill runner is the live execution chamber of Response Integrity-OS.

### What the tutor is allowed to do

The tutor:

- prepares matching problems
- runs the rep exactly as instructed
- selects observation options
- submits evidence

The tutor does not:

- invent the drill structure
- manually decide the final topic state
- rewrite what the system concluded
- smooth over a weak response in the logging layer

### Logging rules

Tutors do not log opinions.

Tutors log what actually happened.

Primary logging rules:

- only log what the student actually did
- do not guess
- do not fill gaps with interpretation
- use the drill options exactly as written
- if you did not see it happen, do not log it

### Option ordering rule

For standard observation blocks:

- first option = weakest response
- middle option = partial response
- last option = strongest response

Some blocks define explicit `optionLevels` so that two different labels may both map to `clear`.

### What the result screen is expected to show

The result layer conceptually shows:

- rep totals
- grouped drill totals
- phase total
- system output
- reason
- tutor meaning
- next action
- current phase rule or drill constraint

## Map And Tutor Control View

The map is not the logging layer.

The map is the tutor's operating clarity layer.

For each active topic, the tutor should be able to see:

- topic name
- current phase
- current stability
- current drill or current drill family
- next action
- constraint
- transition status

The conceptual job of the map is:

- show where the topic currently sits in the OS
- show what the tutor is allowed to run next
- show what the tutor must protect
- prevent the tutor from drifting into improvisation

### Expected tutor experience

The ideal tutor experience is:

"The system tells me what drill to run, what work to prepare, what to observe, and what happens next."

If the tutor still has to invent the session, the product is incomplete.

## Observation Normalization Engine

Implementation:

- `shared/observationScoring.ts`

### Normalized levels

The live normalized observation levels are:

- `weak`
- `partial`
- `clear`

### Weight conversion

The live weighted scoring model is:

- `weak` = `0%` of field weight
- `partial` = `60%` of field weight
- `clear` = `100%` of field weight

### Free-text fallback behavior

The normalization layer also converts free-text style values into one of the three levels using keyword-based rules.

This protects older or less-structured payloads from breaking downstream logic.

## Shared Field Weights

These phase weights are reused across diagnosis, training, and handover logic.

### Clarity

- vocabulary = `30`
- method = `30`
- reason = `20`
- immediate apply = `20`

### Structured Execution

- start behavior = `25`
- step execution = `30`
- repeatability = `25`
- independence = `20`

### Controlled Discomfort

- initial response = `30`
- first-step control = `25`
- discomfort tolerance = `25`
- rescue dependence = `20`

### Time Pressure Stability

- start under time = `20`
- structure under time = `35`
- pace control = `20`
- completion integrity = `25`

## Intake Symptom Recommendation Engine

Implementation:

- `shared/responseSymptomMapping.ts`

### Purpose

This engine recommends where diagnosis should start based on parent-reported signals before drill evidence exists.

It is not the final placement engine.

It is a starting-phase recommendation engine.

### Live symptom domains

The response symptom flow currently reasons across domains such as:

- understanding the work
- working independently
- handling difficulty
- handling time and pressure

### Examples of the kinds of patterns it maps

Signals that often weight toward `Clarity`:

- does not understand the question
- cannot identify the method
- forgets terms, rules, or formulas
- is confused before starting

Signals that often weight toward `Structured Execution`:

- can follow when guided but breaks alone
- skips steps
- starts wrong after examples
- guesses without method
- needs frequent prompting

Signals that often weight toward `Controlled Discomfort`:

- freezes when work is unfamiliar
- gives up quickly
- gets overwhelmed by uncertainty
- asks for help almost immediately
- avoids challenge

Signals that often weight toward `Time Pressure Stability`:

- rushes under time pressure
- panics in tests
- loses structure when speed matters

### Live algorithm

The engine:

1. normalizes symptom ids
2. converts them into weighted phase scores
3. ranks all four phases by score
4. breaks ties by keeping the earlier phase in the phase sequence
5. defaults to `Clarity` if no meaningful positive score exists
6. returns the recommended phase plus supporting symptoms

### Output meaning

The output is:

- likely starting phase
- supporting evidence
- rationale string

Diagnosis still has to verify the topic with drill evidence.

## Diagnosis System

There are two diagnosis-related paths in the codebase and they should be distinguished clearly.

### A. Live runner diagnosis path

This is the main live diagnosis experience in the drill runner.

It is adaptive.

It uses:

- one verification block at a time
- one phase at a time
- adjacent phase movement only
- stop conditions when the placement is found or a boundary is reached

### B. Backend fixed intro diagnosis summary

The backend still contains a fixed intro diagnosis scoring summary path.

That path:

- scores the first two diagnosis sets of a payload
- averages them equally
- returns phase, stability, diagnosis score, next action, and constraint

This is useful to retain in the canonical spec because it still exists in the backend logic.

But the live runner experience is the adaptive block path described below.

## Live Adaptive Diagnosis Engine

Implementation:

- `shared/adaptiveDiagnosis.ts`
- `server/routes.ts`
- `client/src/components/tutor/IntroSessionDrillRunner.tsx`

### Core logic

For each phase block:

1. the system scores each rep using the phase weights
2. the rep scores are averaged into one `phaseScore`
3. the phase score is classified into one adaptive band
4. the system decides whether to:
   - drop to the previous phase
   - place in the current phase
   - move up to the next phase

### Adaptive bands

- `0-44` -> `de-escalate` and `Low`
- `45-79` -> `place` and `Medium`
- `80-100` -> `escalate` and `High`

### Path movement rule

The system may only move to the immediately adjacent phase.

It cannot jump multiple phases.

### Stop conditions

The adaptive path stops when:

- the current phase is a placement match
- the current phase is at the top or bottom boundary and the system cannot move further
- the current block was the last needed verification step

### Meaning of the final diagnosis result

The final adaptive diagnosis result outputs:

- resulting phase
- resulting stability
- diagnosis score
- final band
- next action
- constraint

## Live Adaptive Diagnosis Block Library

The current adaptive diagnosis runner uses one block per phase step.

The older multi-set diagnosis explainers are not the live runner truth.

The live runner truth is:

- one current phase block
- score it
- move up, place, or move down
- repeat only if the engine says to move

### Clarity diagnosis block

Block name:

- `Recognition Probe`

Objective:

- place the topic correctly inside `Clarity`

Structure:

- 3 reps
- recognition only
- student does not solve

Prep rules:

- prepare the starting phase and adjacent coverage around it
- keep this as placement verification, not normal training
- no full teaching cycle

Fields:

- vocabulary
- method
- reason
- immediate apply / first response

Typical option scales:

- vocabulary: `cannot name / partial / clear`
- method: `wrong / hesitant / correct`
- reason: `none / partial / clear`
- immediate apply: `avoids / unsure / engages`

### Structured Execution diagnosis block

Block name:

- `Start + Structure`

Objective:

- place the topic correctly inside `Structured Execution`

Structure:

- 3 reps
- cold-start execution verification
- no help for the opening window

Prep rules:

- prepare adjacent phase coverage
- hold the no-help start window
- use this only for phase verification

Fields:

- start behavior
- step execution
- repeatability / step order
- independence

Typical option scales:

- start: `avoids / delayed / immediate`
- step execution: `random or guessing / partial steps / full structure`
- repeatability: `incorrect / minor errors / correct`
- independence: `waits for help / asks after trying / independent`

### Controlled Discomfort diagnosis block

Block name:

- `First Contact`

Objective:

- place the topic correctly inside `Controlled Discomfort`

Structure:

- 3 reps
- challenging but solvable problems
- no help for the opening window

Prep rules:

- prepare adjacent phase coverage
- hold the discomfort window
- do not rescue

Fields:

- initial response
- first-step control
- discomfort tolerance
- rescue dependence

Typical option scales:

- initial response: `freeze / hesitate / attempt`
- first-step control: `none / prompted / independent`
- discomfort tolerance: `panic / tension / controlled`
- rescue dependence: `asks immediately / asks later / no rescue`

### Time Pressure Stability diagnosis block

Block name:

- `Light Timer`

Objective:

- place the topic correctly inside `Time Pressure Stability`

Structure:

- 3 reps
- timed verification only
- structure is more important than speed

Prep rules:

- prepare adjacent lower-phase coverage
- keep pressure controlled
- use timer to verify structure survival under urgency

Fields:

- start under time
- structure under time
- pace control
- completion integrity

Typical option scales:

- start under time: `freeze / delayed / immediate`
- structure under time: `breaks / partial / maintained`
- pace control: `panic / rushed / controlled`
- completion integrity: `fails / partial / complete`

## Backend Fixed Intro Diagnosis Summary

Implementation:

- `server/routes.ts`

### What it does

This summary:

- uses the first two diagnosis sets in the payload
- scores all reps by phase weight
- averages the first two set scores equally
- decides a diagnosis stability
- returns `nextAction` and `constraint` from the next-action engine

### Current summary thresholds

- `0-49` -> `Low`
- `50-69` -> `Medium`
- `70-100` -> `High` only if `highGuardPasses` is true, otherwise `Medium`

### Current high-guard checks in this summary path

Clarity:

- no zero-scoring field contribution across the scored reps

Structured Execution:

- no guessing and no avoidant start behavior

Controlled Discomfort:

- no avoid, freeze, or first-step collapse signal

Time Pressure Stability:

- structure must read as maintained and pace must read as controlled

## Training System

Training is where real topic-state updates happen.

Diagnosis classifies.
Training conditions.

Implementation:

- `client/src/components/tutor/IntroSessionDrillRunner.tsx`
- `server/routes.ts`
- `shared/topicConditioningEngine.ts`

### Training product law

Training is drill-driven.

The system does not score "the lesson" directly.

The system scores the drill output for the topic.

The lesson may contain multiple topics, but the state change still happens per topic drill.

### Live training set-weight rule

Clarity:

- scored sets are `Identification` and `Light Apply`
- weighting is `2:2`
- the modeling step is a pre-drill instructional step, not a scored observation set

Structured Execution:

- scoring uses all 3 sets
- weighting is `1:2:2`

Controlled Discomfort:

- scoring uses all 3 sets
- weighting is `1:2:2`

Time Pressure Stability:

- scoring uses all 3 sets
- weighting is `1:2:2`

### Important modeling-step clarification

Older derivative docs sometimes described Clarity training as "2 modeled problems".

The current live runner config uses:

- one modeled pre-drill step in the UI
- followed by the scored drill sets

If any older document says otherwise, trust the live runner and this file.

## Live Training Drill Library

This section describes the current live training set structures.

### Clarity training drill

Drill family:

- `Clarity drill`

Primary purpose:

- build the mental map
- verify recognition
- verify that clarity survives light solving

#### Set 1: Modeling

Type:

- pre-drill modeling step

Scoring:

- not scored

Purpose:

- build the mental map before drilling

Rep instruction:

- teach `Vocabulary -> Method -> Reason`, then ask the student to explain back

Active rules:

- tutor models first
- student does not solve yet
- use the vocabulary, method, reason sequence

#### Set 2: Identification

Reps:

- 3

Purpose:

- recognition without solving
- student names terms, identifies type, states steps, explains why

Rep instruction:

- show the problem and ask the student to name the terms, identify the type, state the steps, and explain why it works

Active rules:

- no solving allowed
- push for vocabulary precision
- require all four layers: terms, type, steps, reason

Fields:

- vocabulary
- method
- reason
- immediate apply

Typical options:

- vocabulary: `wrong / hesitant / correct`
- method: `missing / partial / clear`
- reason: `none / weak / clear`
- immediate apply: `avoids answering / unsure but tries / confident`

#### Set 3: Light Apply

Reps:

- 3

Purpose:

- test whether clarity holds during active solving

Rep instruction:

- ask the student to solve with minimal guidance

Active rules:

- minimal guidance only
- no step-by-step help
- observe independent start and execution

Fields:

- vocabulary
- method
- reason
- immediate apply

Typical options:

- vocabulary: `incorrect / partial / correct`
- method: `skips / inconsistent / structured`
- reason: `absent / weak / present`
- immediate apply: `delayed / hesitant / immediate`

### Structured Execution training drill

Drill family:

- `Structured Execution drill`

Primary purpose:

- enforce independent execution and repeatable structure

#### Set 1: Required Structure

Reps:

- 3

Purpose:

- require structured execution before independence claims are allowed

Rep instruction:

- state steps first, then solve

Active rules:

- steps must be stated before solving
- no skipping steps
- correct step order required

Fields:

- start behavior
- step execution
- repeatability
- independence

Typical options:

- start behavior: `delayed / hesitant / immediate`
- step execution: `skips / partial / full`
- repeatability: `resists / accepts / adjusts / already structured correctly`
- independence: `needs help / light support / independent`

#### Set 2: Independent Execution

Reps:

- 3

Purpose:

- full independent execution without help

Rep instruction:

- solve independently

Active rules:

- no help from tutor
- independence expected
- observe consistency and error handling

Fields:

- independence
- repeatability
- step execution
- start behavior

Typical options:

- independence: `needs help / light support / independent`
- repeatability: `breaks / inconsistent / stable`
- step execution: `guesses / partial correction / structured correction / no correction needed`
- start behavior: `delayed / hesitant / immediate`

#### Set 3: Variation Control

Reps:

- 3

Purpose:

- test method survival when the form changes slightly

Rep instruction:

- solve a slightly different form

Active rules:

- same method, different form
- test transfer, not memorization
- no hints about what changed

Fields:

- step execution
- repeatability
- independence
- start behavior

Typical options:

- transfer: `cannot adapt / partial / adapts`
- step retention: `lost / partial / stable`
- completion: `fails / partial / complete`
- start behavior: `delayed / hesitant / immediate`

### Controlled Discomfort training drill

Drill family:

- `Controlled Discomfort drill`

Primary purpose:

- build stable response under challenge without rescue

#### Set 1: Controlled Entry

Reps:

- 3

Purpose:

- force controlled entry under difficulty

Rep instruction:

- pause, then state the first step

Active rules:

- force a pause before starting
- first step must be stated out loud
- do not let the student jump in

Fields:

- initial response
- first-step control
- discomfort tolerance
- rescue dependence

Typical options:

- initial response: `freeze / hesitant / controlled`
- first-step control: `wrong / partial / correct`
- discomfort tolerance: `breaks / unstable / stable`
- rescue dependence: `frequent / occasional / none`

#### Set 2: No Rescue

Reps:

- 3

Purpose:

- build independence under difficulty with no rescue

Rep instruction:

- continue, no full help

Active rules:

- no rescue allowed
- hold the pressure
- observe rescue-seeking pattern

Fields:

- rescue dependence
- discomfort tolerance
- initial response
- first-step control

Typical options:

- rescue dependence: `dependent / partial / independent`
- discomfort tolerance: `breaks / unstable / stable`
- initial response: `collapses / partial / recovers / no recovery needed`
- first-step control: `none / prompted / independent`

#### Set 3: Repeat Exposure

Reps:

- 3

Purpose:

- repeat exposure at the same difficulty to build tolerance

Rep instruction:

- another similar difficulty

Active rules:

- same difficulty level
- repeat exposure
- observe response consistency

Fields:

- discomfort tolerance
- initial response
- rescue dependence
- first-step control

Typical options:

- discomfort tolerance: `breaks / inconsistent / stable`
- initial response: `collapses / partial / recovers / no recovery needed`
- rescue dependence: `frequent / occasional / none`
- first-step control: `none / prompted / independent`

### Time Pressure Stability training drill

Drill family:

- `Time Pressure Stability drill`

Primary purpose:

- keep structure intact while time constraint is active

#### Set 1: Structure Under Timer

Reps:

- 3

Purpose:

- build structured execution under a timer

Rep instruction:

- focus on method, not speed

Active rules:

- timer active
- method first
- structure must be maintained

Fields:

- start under time
- structure under time
- pace control
- completion integrity

Typical options:

- start: `panic / hesitant / controlled`
- structure: `lost / partial / maintained`
- pace: `rushed / uneven / controlled`
- completion: `fails / partial / complete`

#### Set 2: Repeated Timed Execution

Reps:

- 3

Purpose:

- build consistency under repeated timed attempts

Rep instruction:

- repeat under timer

Active rules:

- same timer
- build consistency
- observe pace regulation

Fields:

- completion integrity
- pace control
- structure under time
- start under time

Typical options:

- consistency: `breaks / inconsistent / stable`
- pace: `rushed / uneven / controlled`
- structure: `lost / partial / maintained`
- start: `panic / hesitant / controlled`

#### Set 3: Full Constraint

Reps:

- 3

Purpose:

- test full constraint performance under tighter time

Rep instruction:

- solve under tighter time

Active rules:

- tighter timer
- no relief
- structure and completion both matter

Fields:

- completion integrity
- structure under time
- pace control
- start under time

Typical options:

- completion: `fails / partial / complete`
- integrity: `collapses / unstable / stable`
- pace: `rushed / uneven / controlled`
- start: `panic / hesitant / controlled`

## Training Transition Engine

Implementation:

- `shared/topicConditioningEngine.ts`

### Inputs

The core transition engine accepts:

- previous phase
- previous stability
- normalized drill total out of 100

### Outputs

It returns:

- next phase
- next stability
- transition reason

### Transition reasons

The live transition reasons are:

- `remain`
- `stability advance`
- `stability regress`
- `phase progress`

### Live transition matrix

From `Low`:

- `0-49` -> remain `Low`
- `50-79` -> `Medium`
- `80-100` -> `High`

From `Medium`:

- `0-44` -> `Low`
- `45-79` -> remain `Medium`
- `80-100` -> `High`

From `High`:

- `0-49` -> `Medium`
- `50-84` -> remain `High`
- `85-100` -> `High Maintenance`

From `High Maintenance`:

- `0-59` -> `High`
- `60-84` -> remain `High Maintenance`
- `85-100` -> phase progress

### Phase progress rule

Phase progress only happens when:

- previous stability is `High Maintenance`
- score is `85+`

If phase progress happens:

- the system enters the next phase
- the new stability is always `Low`

Exception:

- if the current phase is already `Time Pressure Stability`, the result remains `Time Pressure Stability / High Maintenance`

### Important live note about guards

The training summary path in `server/routes.ts` still calculates `highGuardPasses`.

But the current live topic movement uses `computeTransition(...)`.

That means:

- the current live training transition engine is driven by score + previous phase + previous stability
- it does not currently gate progression with `highGuardPasses`

If that changes later, this file must be updated in the same change.

## Next Action Engine

Implementation:

- `shared/topicConditioningEngine.ts`

### Purpose

This engine tells the system what operational move should happen next from each live state.

Each state stores:

- `primaryAction`
- `rules`
- optional `nextActions`
- optional `advanceTo`

### State matrix

#### Clarity

`Low`

- primary action: `Run Clarity drill`
- rules: `No Boss Battles`, `No time pressure`, `No skipping layers`

`Medium`

- primary action: `Run Clarity drill`
- rules: `No Boss Battles as primary`, `No time pressure`, `Reduce explanation, increase execution`

`High`

- primary action: `Run Clarity High Maintenance drill`
- rules: `Do NOT phase advance yet`, `Prove repeatable stability first`

`High Maintenance`

- primary action: `Run Structured Execution drill`
- rules: `Do NOT stay in teaching mode`, `Move forward`
- advanceTo: `Structured Execution`

#### Structured Execution

`Low`

- primary action: `Run Structured Execution drill`
- rules: `No time pressure`, `Boss Battles only if student can start`, `No over-explaining`

`Medium`

- primary action: `Run Structured Execution drill`
- rules: `Do not rush to time pressure`, `Still reinforce structure every time`

`High`

- primary action: `Run Structured Execution High Maintenance drill`
- rules: `Do NOT phase advance yet`, `Prove repeatable stability first`

`High Maintenance`

- primary action: `Run Controlled Discomfort drill`
- rules: `Do NOT keep repeating basic problems`, `Move forward`
- advanceTo: `Controlled Discomfort`

#### Controlled Discomfort

`Low`

- primary action: `Run Controlled Discomfort drill`
- rules: `No rescuing`, `No full explanations mid-struggle`, `No time pressure yet`

`Medium`

- primary action: `Run Controlled Discomfort drill`
- rules: `Do not remove difficulty`, `Do not over-guide`

`High`

- primary action: `Run Controlled Discomfort High Maintenance drill`
- rules: `Do NOT phase advance yet`, `Prove repeatable stability first`

`High Maintenance`

- primary action: `Run Time Pressure Stability drill`
- rules: `Do NOT stay in comfort zone`, `Move forward`
- advanceTo: `Time Pressure Stability`

#### Time Pressure Stability

`Low`

- primary action: `Run Time Pressure Stability drill`
- rules: `Do not push speed`, `Do not increase time pressure aggressively`

`Medium`

- primary action: `Run Time Pressure Stability drill`
- rules: `Do not sacrifice structure for speed`, `Maintain method discipline`

`High`

- primary action: `Run Time Pressure Stability High Maintenance drill`
- rules: `Do NOT declare transfer yet`, `Confirm sustained stability first`

`High Maintenance`

- primary action: `Run Time Pressure Stability maintenance drill`
- rules: `Do not over-train same pattern`, `Begin cross-topic conditioning`

## Handover Verification Engine

Implementation:

- `server/routes.ts`
- `shared/adaptiveDiagnosis.ts`
- `client/src/components/tutor/IntroSessionDrillRunner.tsx`

### Purpose

Handover verification exists so that a new tutor does not blindly inherit topic states that might no longer be trustworthy.

It checks continuity before ordinary training resumes.

### Live handover structure

The live handover verification flow uses:

- a single verification block at the inherited phase
- handover-specific prep copy
- continuity-only intent
- no training-forward permission inside the verification step

### Live handover verification blocks

Clarity:

- block: `Recognition Probe`
- 3 clean phase-appropriate verification problems

Structured Execution:

- block: `Start + Structure`
- 3 clean phase-appropriate verification problems

Controlled Discomfort:

- block: `First Contact`
- 3 clean phase-appropriate verification problems

Time Pressure Stability:

- block: `Light Timer`
- 3 clean phase-appropriate verification problems

### Handover prep doctrine

The tutor is expected to:

- verify inherited state only
- not reteach from scratch
- not progress the student during verification
- hold the phase rules exactly

### Verification outcomes

The live handover verification thresholds are:

- `0-39` -> `targeted_re_diagnosis_required`
- `40-59` -> `stability_adjust`
- `60-84` -> `hold`
- `85-100` -> `hold` with strong confidence

### Stability reduction rule

If `stability_adjust` is triggered:

- `High Maintenance` -> `High`
- `High` -> `Medium`
- `Medium` -> `Low`
- `Low` -> `Low`

### Targeted re-diagnosis path

If the verification result is too weak to trust the inherited state:

- the system does not resume ordinary training
- the topic is reclassified through the adaptive diagnosis flow
- the result becomes the new trustworthy starting point

## Behavior-Language Engine

Implementation:

- `shared/topicConditioningEngine.ts`

### Purpose

This engine converts raw observations into reusable behavior labels.

It exists so that:

- reports are evidence-led
- summaries are consistent across tutors
- the system can speak about patterns rather than isolated taps

### Weak labels

- `clarity breakdown`
- `inconsistent step execution`
- `early dependence`
- `delayed starts`
- `hesitation under pressure`
- `structure breakdown`
- `pace loss`

### Strong labels in comparative form

- `clearer concept recall`
- `more reliable step execution`
- `more independent execution`
- `earlier independent starts`
- `better control under difficulty`
- `stronger structure retention`
- `more controlled pace`

### Strong labels in absolute form

These are used by some report outputs and fallbacks:

- `clear concept recall`
- `reliable step execution`
- `independent execution`
- `independent starts`
- `control under difficulty`
- `structure retention`
- `controlled pace`

### Weak vs strong classification rule in report logic

Weak classification patterns include terms such as:

- `breakdown`
- `dependence`
- `hesitation`
- `delayed`
- `pace loss`
- `inconsistent`

Everything else is treated as strong.

## Parent Meaning Layers

There are two parent-facing meaning layers and they should not be confused.

### 1. Parent dashboard state copy

This is the exact status, meaning, and focus copy keyed by `phase x stability`.

Implementation:

- `shared/topicConditioningEngine.ts`

#### Clarity

`Low`

- status: `Your child is still building a clear understanding of this topic.`
- meaning: `They are not yet fully comfortable with the terms, steps, or logic involved.`
- focus: `We are rebuilding the foundation so they can clearly recognize and understand the problem.`

`Medium`

- status: `Your child is beginning to understand this topic more clearly.`
- meaning: `They can follow explanations, but still need reinforcement to apply it independently.`
- focus: `We are increasing practice and helping them apply the method more consistently.`

`High`

- status: `Your child now understands this topic clearly.`
- meaning: `They can recognize the problem and explain the steps with confidence.`
- focus: `We are moving into independent problem-solving to build execution.`

`High Maintenance`

- status: `Your child has sustained strong clarity in this topic.`
- meaning: `They have held high performance consistently and are ready for progression decisions.`
- focus: `We are now transitioning into Structured Execution training.`

#### Structured Execution

`Low`

- status: `Your child is learning to apply the steps correctly.`
- meaning: `They understand the topic but struggle to follow the method consistently on their own.`
- focus: `We are reinforcing a clear step-by-step approach so they can start and complete problems reliably.`

`Medium`

- status: `Your child is becoming more consistent in solving problems.`
- meaning: `They can follow the method in many cases, but still show occasional inconsistency.`
- focus: `We are increasing independent practice to strengthen consistency.`

`High`

- status: `Your child can now solve problems consistently in this topic.`
- meaning: `They are able to follow the correct steps independently with minimal support.`
- focus: `We are verifying sustained high execution through repeated, constrained practice before introducing more challenging questions to strengthen their response under difficulty.`

`High Maintenance`

- status: `Your child has sustained strong execution consistency in this topic.`
- meaning: `They have held high execution quality across sessions and are ready for progression decisions.`
- focus: `We are now transitioning into Controlled Discomfort training.`

#### Controlled Discomfort

`Low`

- status: `Your child is starting to face more challenging problems in this topic.`
- meaning: `They can solve basic problems, but struggle when questions become less familiar.`
- focus: `We are helping them stay calm and start correctly even when the problem feels difficult.`

`Medium`

- status: `Your child is improving in handling difficult questions.`
- meaning: `They can work through unfamiliar problems, but still show hesitation at times.`
- focus: `We are increasing exposure to harder questions to build confidence under difficulty.`

`High`

- status: `Your child is handling difficult problems well.`
- meaning: `They are able to stay structured and solve unfamiliar questions with stability.`
- focus: `We are preparing them to perform under time pressure.`

`High Maintenance`

- status: `Your child has sustained strong performance under challenge in this topic.`
- meaning: `They have held high stability in difficult work and are ready for progression decisions.`
- focus: `We are now transitioning into Time Pressure Stability training.`

#### Time Pressure Stability

`Low`

- status: `Your child is learning to stay structured under time pressure.`
- meaning: `They can solve problems, but may lose structure when working against the clock.`
- focus: `We are helping them maintain their method while working within time limits.`

`Medium`

- status: `Your child is becoming more stable under time pressure.`
- meaning: `They are improving their ability to complete problems within time while staying structured.`
- focus: `We are increasing timed practice to strengthen consistency.`

`High`

- status: `Your child is performing consistently under time pressure.`
- meaning: `They can solve problems accurately and maintain structure even under time constraints.`
- focus: `We are maintaining performance and preparing them to transfer this skill to new topics.`

`High Maintenance`

- status: `Your child has sustained top stability under time pressure.`
- meaning: `They consistently maintain structure and accuracy under timed conditions.`
- focus: `We are maintaining performance and expanding transfer across related topics.`

### 2. Report meaning layer

This is the meaning system used inside weekly and monthly report fields such as `What This Means`.

It includes:

- a state meaning matrix
- phase-entry meanings
- special-case meanings for regress and final maintenance

#### State meaning matrix

Clarity:

- `Low`: `Recognition is improving, but independent execution is not yet stable.`
- `Medium`: `Recognition is improving, but independent execution is not yet stable.`
- `High`: `Recognition holds, but execution is not yet stable on its own.`
- `High Maintenance`: `Recognition holds, but execution is not yet stable on its own.`

Structured Execution:

- `Low`: `Execution is forming, but consistency is not yet stable.`
- `Medium`: `Execution is forming, but consistency is not yet stable.`
- `High`: `Execution is now holding independently.`
- `High Maintenance`: `Execution is now holding independently.`

Controlled Discomfort:

- `Low`: `Structure breaks when difficulty rises.`
- `Medium`: `Structure breaks when difficulty rises.`
- `High`: `Structure is holding under difficulty.`
- `High Maintenance`: `Structure is holding under difficulty.`

Time Pressure Stability:

- `Low`: `Structure breaks when pace increases.`
- `Medium`: `Structure breaks when pace increases.`
- `High`: `Structure is holding under pace pressure.`
- `High Maintenance`: `Structure is holding under pace pressure.`

#### Phase-entry meanings

- `Clarity`: `Entered foundation rebuilding before independent solving begins.`
- `Structured Execution`: `Entered independent execution, now building consistency without tutor carry.`
- `Controlled Discomfort`: `Entered the challenge phase, now learning to stay stable under difficulty.`
- `Time Pressure Stability`: `Entered timed stability, now learning to keep structure under urgency.`

#### Special-case meanings

Stability regress:

- `Stability has dipped at this level and needs reinforcement before progression.`

Final maintenance:

- `Top-level stability is holding, now in maintenance and transfer.`

## Report Generation Engine

Implementation:

- `server/routes.ts`

Supporting data reference:

- drill normalization and report matrices that were previously documented elsewhere are now centralized here

### End-to-end report flow

1. A tutor submits diagnosis, training, or handover-related drill data.
2. The drill row is stored.
3. `maybeAutoSendDeterministicReports(studentId, tutorId)` runs after drill submission.
4. The system fetches all drill rows for that student and tutor.
5. Each drill row is normalized into a deterministic session-like object.
6. Handover verification rows are excluded from weekly and monthly parent reports.
7. The normalized rows are grouped by session group id.
8. Weekly windows are built from every 2 completed session groups.
9. Monthly windows are built from every 8 completed session groups.
10. Structured report JSON is generated.
11. It is inserted into `parent_reports.summary`.
12. Parent UI later renders the stored structure.

Automatic report reliability rules:

- Each generated report carries the exact source session-group IDs in `sourceSessionIds`.
- A deterministic `report_window_key` identifies the report type and source session window.
- Automatic generation excludes source session groups already covered by a report of the same type.
- The database prevents two reports for the same tutor, student, report type, and source window.
- `sent_at` is delivery metadata only; it is not the source-coverage cursor.
- The parent-facing labels describe the thresholds: two-session conditioning update and eight-session conditioning report.
- Catch-up generation may create every missed deterministic window, but sends one consolidated notification per report type.
- Parent and tutor views are intentionally distinct; both must use the same stored deterministic evidence while presenting different context.

### Trigger windows

Weekly:

- generated from pairs of completed session groups
- windows are `[0,1]`, `[2,3]`, `[4,5]`, and so on

Monthly:

- generated from sets of 8 completed session groups
- windows are `[0..7]`, `[8..15]`, and so on

### Normalized drill fields used by reports

Each normalized deterministic row contributes:

- id
- date
- sessionGroupId
- topic
- drillType
- behaviorPatterns
- score
- phaseBefore
- phaseAfter
- stabilityBefore
- stabilityAfter
- nextAction
- transitionReason
- deterministicLog

### Diagnosis normalization behavior

Diagnosis rows use:

- topic from intro or training topic field
- phase from the drill summary
- stability from the drill summary
- diagnosis score
- transition reason forced to `remain`
- phase after equal to the diagnosed phase
- next action from the summary or next-action engine

### Training normalization behavior

Training rows use:

- phase before from the submitted or current phase
- phase after from the scored summary
- previous stability from the scored summary
- stability after from the scored summary
- transition reason from summary fields
- fallback transition normalization where needed

### Handover normalization behavior

Handover verification rows do not contribute to weekly or monthly parent reports.

## Weekly Report Model

### Generated object version

- `weekly-v2-auto`

### Stored fields

- `weekStartDate`
- `weekEndDate`
- `sessionsCompletedThisWeek`
- `topicsWorkedOn`
- `conditioningProgress`
- `whatImproved`
- `responsePattern`
- `mainBreakdown`
- `systemMovement`
- `whatThisMeans`
- `nextFocus`
- `internalWeeklyTutorNote`
- `drillCount`
- `sourceSessionIds`

### Parent card sections

- `Weekly Report`
- date range
- sent metadata
- `Sessions Completed`
- `Topics Worked On`
- `What Improved`
- `What This Means`
- `Response Pattern`
- `Challenges`
- `System Movement`
- `Conditioning Progress`
- `Next Focus`

### Weekly field assembly rules

`Sessions Completed`

- based on grouped session count, not raw drill row count

`Topics Worked On`

- all topics in the topic snapshots

`Conditioning Progress`

- one row per topic
- start state = first phase and stability in the window
- end state = last phase and stability in the window
- drill count = number of deterministic drill entries for that topic

`What Improved`

A topic qualifies if:

- end-state score is greater than start-state score
- or any transition reason is not `remain`

If phase progressed:

- `{topic}: progressed from {firstPhase} to {lastPhase} with {top 2 strong late behavior labels}`

If no phase progress:

- `{topic}: {behavior shift summary}`

If nothing qualifies:

- `No stability improvements detected this week`

`Response Pattern`

- `{topic}: {top 3 absolute behavior labels}`

Fallback:

- `{topic}: no mapped observation signal detected`

`Challenges`

- `{topic}: {top 2 weak labels}`

### Weekly `What Changed` templates

State changed:

- `{topic} moved from {phaseBefore} ({stabilityBefore}) to {phaseAfter} ({stabilityAfter}), with {behaviorShift}.`

State unchanged:

- `{topic} remained in {phaseAfter} ({stabilityAfter}), with {behaviorShift}.`

Behavior-shift rules:

- maximum 2 signals
- reduced weak signals become `less {weakSignal}`
- strengthened strong signals stay comparative
- fallback becomes strong absolute signals or a continued weak signal

Examples:

- `less delayed starts and more reliable step execution`
- `less hesitation under pressure and stronger structure retention`
- `reliable step execution and independent starts`
- `continued early dependence`
- `no consistent behavior shift recognized yet`

### Weekly `Breakdown Pattern` templates

- `{topic}: {weak1} and {weak2}`
- `{topic}: {weak1}`
- `{topic}: no consistent breakdown pattern identified`

### Weekly `Next Move` matrix

- `Clarity / Low` -> `reinforce recognition and first-step decisions before increasing difficulty.`
- `Clarity / Medium` -> `reinforce recognition and first-step decisions before increasing difficulty.`
- `Clarity / High` -> `reinforce recognition and first-step decisions before increasing difficulty.`
- `Clarity / High Maintenance` -> `introduce Structured Execution while protecting recognition and step choice.`
- `Structured Execution / Low` -> `reinforce step order and independent starts before increasing difficulty.`
- `Structured Execution / Medium` -> `reinforce step order and independent starts before increasing difficulty.`
- `Structured Execution / High` -> `increase variation while protecting step order and independent starts.`
- `Structured Execution / High Maintenance` -> `introduce Controlled Discomfort while protecting structure.`
- `Controlled Discomfort / Low` -> `increase exposure to harder problems while maintaining structure.`
- `Controlled Discomfort / Medium` -> `increase exposure to harder problems while maintaining structure.`
- `Controlled Discomfort / High` -> `increase timed demand while protecting structure under difficulty.`
- `Controlled Discomfort / High Maintenance` -> `introduce Time Pressure Stability while protecting structure.`
- `Time Pressure Stability / Low` -> `increase timed exposure while protecting structure and pace control.`
- `Time Pressure Stability / Medium` -> `increase timed exposure while protecting structure and pace control.`
- `Time Pressure Stability / High` -> `increase timed exposure while protecting structure and pace control.`
- `Time Pressure Stability / High Maintenance` -> `maintain timed performance and begin transfer across related topics.`

## Monthly Report Model

### Generated object version

- `monthly-v2-auto`

### Stored fields

- `monthStartDate`
- `monthEndDate`
- `totalSessionsCompletedThisMonth`
- `topicsConditioned`
- `topicProgression`
- `whatBecameStronger`
- `responseTrend`
- `recurringChallenge`
- `systemOutcome`
- `whatThisMeans`
- `currentStateSnapshot`
- `nextMonthFocus`
- `drillCount`
- `monthRange`
- `sourceSessionIds`

### Parent card sections

- `{monthName} Report`
- date range
- sent metadata
- feedback button
- `Total Sessions Completed`
- `Topics Conditioned`
- `What Became Stronger`
- `Recurring Challenge`
- `System Outcome`
- `Topic Progression`
- `Next Month Focus`
- `Current Conditioning State`
- `What This Means`
- `Your Feedback` when feedback exists

### Monthly field assembly rules

`Total Sessions Completed`

- based on grouped session count, not raw drill count

`Topics Conditioned`

- all topics in the topic snapshots

`Topic Progression`

- one row per topic
- start state = first phase and stability in the window
- end state = last phase and stability in the window
- drill count = number of deterministic drill entries for that topic

`What Became Stronger`

Same inclusion rule as weekly:

- end-state score is greater than start-state score
- or any transition reason is not `remain`

If phase progressed:

- `{topic}: progressed from {firstPhase} to {lastPhase} with {top 2 strong late behavior labels}`

If no phase progress:

- `{topic}: {behavior shift summary}`

If nothing qualifies:

- `No significant improvements detected this month`

`Response Trend`

- `{topic}: {behavior shift summary}`

Fallback:

- `{topic}: showed a more consistent response pattern`

`Recurring Challenge`

- `{topic}: {top 2 weak labels}`

Fallback:

- `{topic}: no recurring mapped weak signal detected`

Global fallback:

- `No recurring challenges detected`

`Current Conditioning State`

- `{topic} - {phase} ({stability})`

`Next Month Focus`

- `{topic}: Continue training {phase purpose}.`

### Monthly `System Movement` templates

- phase progress: `{topic} advanced from {phaseBefore} to {phaseAfter}.`
- stability advance: `{topic} remained in {phaseAfter}, with stability improving across sessions.`
- stability regress: `{topic} remained in {phaseAfter} with reduced stability.`
- final maintenance: `{topic} remained in {phaseAfter} with sustained maintenance.`
- no movement: `{topic} remained in {phaseAfter}.`

### Monthly `Current Position` format

Line 1:

- `{topic}: {phase} ({stability})`

Line 2 uses this position matrix:

- `Clarity / Low` -> `Recognition is improving, but independent execution is not yet stable.`
- `Clarity / Medium` -> `Recognition is improving, but independent execution is not yet stable.`
- `Clarity / High` -> `Recognition holds, but independent execution is not yet stable.`
- `Clarity / High Maintenance` -> `Recognition holds, but independent execution is not yet stable.`
- `Structured Execution / Low` -> `Execution is forming, but consistency is not yet stable.`
- `Structured Execution / Medium` -> `Execution is forming, but consistency is not yet stable.`
- `Structured Execution / High` -> `Execution is now holding independently.`
- `Structured Execution / High Maintenance` -> `Execution is now holding independently.`
- `Controlled Discomfort / Low` -> `Structure breaks when difficulty rises.`
- `Controlled Discomfort / Medium` -> `Structure breaks when difficulty rises.`
- `Controlled Discomfort / High` -> `Structure holds under difficulty, but timed pressure is not yet stable.`
- `Controlled Discomfort / High Maintenance` -> `Structure holds under difficulty, but timed pressure is not yet stable.`
- `Time Pressure Stability / Low` -> `Structure breaks when pace increases.`
- `Time Pressure Stability / Medium` -> `Structure breaks when pace increases.`
- `Time Pressure Stability / High` -> `Structure holds under pace pressure.`
- `Time Pressure Stability / High Maintenance` -> `Structure holds under pace pressure.`

## System Movement Output Rules

### Weekly `System Movement`

Phase progress:

- `{topic}: entered {lastPhase}`

Stability advance:

- `{topic}: improved stability inside {lastPhase}`

Stability regress:

- `{topic}: regressed within {lastPhase}`

Final maintenance:

- `{topic}: sustained final-phase maintenance`

Remain:

- `{topic}: reinforced {lastPhase}`

### Monthly `System Outcome`

Phase progress:

- `{topic}: advanced into {lastPhase}`

Final maintenance:

- `{topic}: remained in final-phase maintenance`

Stability advance:

- `{topic}: improved within {lastPhase}`

Stability regress:

- `{topic}: regressed within {lastPhase}`

Remain:

- `{topic}: held in {lastPhase}`

## Scenario Rules

### Phase progress scenario

Conditions:

- latest transition reason is `phase progress`
- first phase and last phase differ

Weekly behavior:

- `What Improved` uses the progression template
- `System Movement` says topic entered the last phase
- `What This Means` uses phase-entry meaning
- `Next Focus` uses the latest next action

Monthly behavior:

- `What Became Stronger` uses the progression template
- `System Outcome` says topic advanced into the last phase
- `What This Means` uses phase-entry meaning
- `Next Month Focus` says continue training the new phase purpose

### Stability advance scenario

Conditions:

- latest transition reason is `stability advance`
- phase does not change

Weekly behavior:

- `What Improved` uses behavior shift summary
- `System Movement` says improved stability inside the phase
- `What This Means` uses parent dashboard meaning for the final state

Monthly behavior:

- `What Became Stronger` uses behavior shift summary
- `System Outcome` says improved within the phase
- `What This Means` uses parent dashboard meaning for the final state

### Stability regress scenario

Conditions:

- latest transition reason is `stability regress`

Weekly behavior:

- `System Movement` says regressed within the phase
- `What This Means` becomes reinforcement warning

Monthly behavior:

- `System Outcome` says regressed within the phase
- `What This Means` becomes reinforcement warning

### Remain scenario

Conditions:

- latest transition reason is `remain`
- current state is not final-phase maintenance

Weekly behavior:

- topic may be excluded from `What Improved`
- `System Movement` says reinforced phase

Monthly behavior:

- topic may be excluded from `What Became Stronger`
- `System Outcome` says held in phase

### Final phase maintenance scenario

Conditions:

- last phase is `Time Pressure Stability`
- last stability is `High Maintenance`

Weekly behavior:

- `System Movement` says sustained final-phase maintenance
- `What This Means` says top-level stability is holding and now in maintenance and transfer

Monthly behavior:

- `System Outcome` says remained in final-phase maintenance
- `What This Means` says top-level stability is holding and now in maintenance and transfer

### Diagnosis-only window

If a report window mainly contains diagnosis rows:

- state snapshots usually match the diagnosed phase and stability
- diagnosis next action becomes the next focus
- transition reason typically behaves like `remain`

### Multi-topic window

When a report window includes multiple topics:

- each topic gets its own snapshot
- each topic gets its own behavior and breakdown lines
- each topic gets its own movement line
- parent cards join those lines into the combined output

## Exact Example Outputs

These are representative output examples drawn from the current report matrix behavior.

### Weekly phase progress example

- `Linear Equations moved from Structured Execution (High Maintenance) to Controlled Discomfort (Low), with control under difficulty and structure retention.`
- `Linear Equations: hesitation under pressure`
- `Entered the challenge phase, now learning to stay stable under difficulty.`
- `Linear Equations: increase exposure to harder problems while maintaining structure.`

### Weekly stability advance example

- `Linear Equations moved from Structured Execution (Medium) to Structured Execution (High), with less delayed starts and more reliable step execution.`
- `Linear Equations: early dependence`
- `Execution is now holding independently.`
- `Linear Equations: increase variation while protecting step order and independent starts.`

### Weekly final maintenance example

- `Linear Equations remained in Time Pressure Stability (High Maintenance), with controlled pace and structure retention.`
- `Top-level stability is holding, now in maintenance and transfer.`
- `Linear Equations: maintain timed performance and begin transfer across related topics.`

### Monthly phase progress example

- `Linear Equations advanced from Structured Execution to Controlled Discomfort.`
- `Linear Equations: control under difficulty and structure retention`
- `Linear Equations: Controlled Discomfort (Low)`
- `Entered the challenge phase, now learning to stay stable under difficulty.`

### Monthly regress example

- `Linear Equations remained in Controlled Discomfort with reduced stability.`
- `Linear Equations: hesitation under pressure and structure breakdown`
- `Linear Equations: Controlled Discomfort (Medium)`
- `This topic needs reinforcement at the current level before moving forward again.`

## Operational Shell And Lesson Wrapping

This section explains how the deterministic engine sits inside the live service-delivery shell.

### Real current model

The repo already reflects this mental model:

- student card workflow state
- intro booking before intro diagnosis
- active training after intro
- drill runner as execution engine
- backend scoring and deterministic state updates on submit

### Architectural layering rule

The correct operational model is:

- lesson scheduling plus Meet plus recording = outer shell
- Response Integrity drill runner plus scoring plus state engine = inner core

### Scheduled lesson rule

The system should treat scheduled lessons as the outer shell.

The drill runner should launch from valid lesson context, not as a free-floating action.

### Training lesson rule

The pedagogical distinction must remain:

- lesson or scheduled session = real-world lesson container
- training session run = multi-topic drill container inside that lesson
- drill = per-topic execution unit

### Why this matters

If scheduling logic is pushed into the drill engine itself:

- drill runner state becomes polluted
- compliance becomes less clear
- deterministic reporting becomes harder to trust

The outer shell must wrap the engine, not replace it.

## Tutor And TD Alignment Audit Engine

Implementation:

- `shared/battleTesting.ts`
- `server/battleTesting.ts`

### Purpose

This engine exists because Response Integrity is selling a system, not just tutor availability.

It measures whether operators still understand and execute the system correctly.

### Main audit coverage areas

The wider audit and battle-testing layer is intended to cover both:

- transformation-phase understanding
- session-infrastructure understanding

That includes areas such as:

- Clarity
- Structured Execution
- Controlled Discomfort
- Time Pressure Stability
- topic conditioning
- logging system
- session flow control
- drill library
- handover verification
- tools required
- intro session structure

### Current scored outputs

Each run produces:

- phase scores
- alignment percentage
- state
- weak phases
- critical fail reasons
- action required

### Live states

- `locked`
- `watchlist`
- `fail`

### Live thresholds

- below `90%` -> `fail`
- `90%` to below `95%` -> `watchlist`
- `95%` and above -> `locked`

### Critical-fail rule

Critical-fail logic can still force failure even if the percentage would otherwise be stronger.

### Why this layer matters

Without this layer:

- tutors can drift while seeming fine on the surface
- parent trust can be harmed before leadership notices
- the reporting layer can look cleaner than real delivery
- scale becomes more expensive because drift has to be corrected manually

## Resolved Drift And Contradiction Rules

This file explicitly resolves several recurring documentation drifts.

### 1. Clarity modeling-step drift

Older docs sometimes described 2 modeled Clarity problems.

The live runner uses:

- a single pre-drill modeling step in the UI
- followed by the scored Clarity drill sets

Trust the live runner and this file.

### 2. Diagnosis-structure drift

Older docs sometimes described broader multi-set diagnosis flows.

The live adaptive diagnosis runner currently uses:

- one current phase verification block at a time
- adjacent movement only

Trust the live runner and this file.

### 3. Training-guard drift

Some older scoring explainers describe high-threshold guardrails as if they still directly gate live training progression.

The current live transition engine uses:

- score
- previous phase
- previous stability

The current live `computeTransition(...)` function does not directly use `highGuardPasses`.

### 4. Final-phase drift

Older mindset documents may speak about transfer-readiness tracks or broader extensions.

The current live core phase engine ends at:

- `Time Pressure Stability / High Maintenance`

There is no fifth core phase in the current runtime.

## Status Of Other Docs

The surrounding engine docs may still be useful for:

- screenshots
- implementation history
- operational context
- archived wording
- deep-dive demos

But they are no longer required to understand the system.

This file is intended to replace them as the primary explanatory source.

## Required Change Discipline

Any change to the live Response Integrity-OS algorithm, reporting logic, drill structure, launch-gating rule, or parent meaning layer must do all of the following in the same workstream:

1. Update the relevant code.
2. Update this document.
3. Update or add tests if algorithm behavior changed.
4. Update any derivative docs whose screenshots, examples, or instructions are now visibly stale.

Do not ship Response Integrity-OS logic changes without updating this file.
