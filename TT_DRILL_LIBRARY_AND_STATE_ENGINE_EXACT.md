# Response Integrity Drill Library And State Engine Exact Reference

Derived from:

- `client/src/components/tutor/IntroSessionDrillRunner.tsx`
- `shared/topicConditioningEngine.ts`
- `client/src/components/tutor/topicConditioningEngine.ts`
- `client/src/components/parent/ProposalView.tsx`
- `shared/observationScoring.ts`

## Core runtime rules

- `phase`: `Clarity`, `Structured Execution`, `Controlled Discomfort`, `Time Pressure Stability`
- `stability`: `Low`, `Medium`, `High`, `High Maintenance`
- `session` mode uses the training drill library for each selected topic.
- `diagnosis` mode uses `DIAGNOSIS_SETS_BY_PHASE`.
- `training` mode uses `TRAINING_SETS_BY_PHASE`.
- Observation scoring is positional:
  - first option => `weak`
  - middle option => `partial`
  - last option => `clear`
- `getObservationBlockForRep`:
  - uses rep-specific `repObservationBlocks` when present
  - otherwise reuses the same `observationBlock` for every rep

## Phase context shown in runner

### Clarity

- Purpose: `Can the student see the problem clearly before solving? Clarity is naming what's there, recognizing the method, understanding why. If this fails - everything else collapses.`
- Constraints:
  - `No Boss Battles`
  - `No time pressure`
  - `No skipping layers`

### Structured Execution

- Purpose: `Test and build ability to execute the known method independently. Student knows - now prove they can do it alone, repeatably.`
- Constraints:
  - `State steps before solving`
  - `No guessing tolerated`
  - `No skipping steps`

### Controlled Discomfort

- Purpose: `Test and stabilize behavior under uncertainty and difficulty. Does the student persist - or shut down?`
- Constraints:
  - `No full rescue`
  - `Hold discomfort window`
  - `One-step confirmation max`

### Time Pressure Stability

- Purpose: `Maintain method structure under urgency. Structure is the target - speed is secondary.`
- Constraints:
  - `Method over speed`
  - `Timer is active`
  - `Structured response required - panic responding is logged as instability.`

## Drill library

## Diagnosis library

### Clarity

#### Set 1: `Recognition Probe`

- Reps: `3`
- Purpose: `Student does NOT solve. Tests vocabulary, type recognition, and step awareness only.`
- Rep instruction: `Show the problem. Ask student to name terms, identify type, and state the steps. Do not let them solve.`
- Active rules:
  - `Student does not solve`
  - `Recognition only - no execution`
  - `No hints or steps from tutor`
- Rep 1:
  - `vocabulary`: `Vocabulary (Rep 1 - Cold Name)` => `cannot name | partial | clear`
  - `method`: `Type Recognition (Rep 1)` => `wrong | hesitant | correct`
  - `reason`: `Step Awareness (Rep 1)` => `none | partial | clear`
  - `immediateApply`: `First Response (Rep 1)` => `avoids | unsure | engages`
- Rep 2:
  - `vocabulary`: `Vocabulary (Rep 2 - Second Look)` => `cannot name | partial | clear`
  - `method`: `Method Recognition (Rep 2)` => `wrong | hesitant | correct`
  - `reason`: `Can They State Steps? (Rep 2)` => `none | partial | clear`
  - `immediateApply`: `Willingness to Try (Rep 2)` => `avoids | unsure | engages`
- Rep 3:
  - `vocabulary`: `Vocabulary (Rep 3 - Confirm)` => `cannot name | partial | clear`
  - `method`: `Method Recall (Rep 3)` => `wrong | hesitant | correct`
  - `reason`: `Can They Explain Why? (Rep 3)` => `none | partial | clear`
  - `immediateApply`: `Confidence Signal (Rep 3)` => `avoids | unsure | engages`

#### Set 2: `Light Apply Probe`

- Reps: `3`
- Purpose: `Student solves with minimal help. Tests start behavior, structure, and clarity carryover.`
- Rep instruction: `Ask student to solve. Minimal guidance only. Observe start behavior and step discipline.`
- Active rules:
  - `Minimal guidance only`
  - `No step-by-step help`
  - `Observe independent start and execution`
- Rep 1:
  - `vocabulary`: `Vocabulary in Context (Rep 1 - First Attempt)` => `incorrect | partial | correct`
  - `method`: `Step Execution (Rep 1)` => `random | partial | structured`
  - `reason`: `Reason Awareness (Rep 1)` => `none | weak | present`
  - `immediateApply`: `Start Behavior (Rep 1)` => `cannot start | delayed | starts`
- Rep 2:
  - `vocabulary`: `Vocabulary in Context (Rep 2 - With Feedback)` => `incorrect | partial | correct`
  - `method`: `Step Discipline (Rep 2)` => `random | partial | structured`
  - `reason`: `Reason Application (Rep 2)` => `none | weak | present`
  - `immediateApply`: `Adjustment to Feedback (Rep 2)` => `cannot start | delayed | starts`
- Rep 3:
  - `vocabulary`: `Vocabulary in Context (Rep 3 - Independence Check)` => `incorrect | partial | correct`
  - `method`: `Step Consistency (Rep 3)` => `random | partial | structured`
  - `reason`: `Reason Retention (Rep 3)` => `none | weak | present`
  - `immediateApply`: `Independent Start (Rep 3)` => `cannot start | delayed | starts`

### Structured Execution

#### Set 1: `Start + Structure`

- Reps: `3`
- Purpose: `Test ability to execute from a cold start with no assistance. Observe whether structure exists from the first move.`
- Rep instruction: `Solve the problem. No help for 10 seconds.`
- Active rules:
  - `No help for 10 seconds`
  - `Observe cold start behavior`
  - `Record exactly what happens - no prompting`
- Rep 1:
  - `startBehavior`: `Cold Start (Rep 1)` => `avoids | delayed | immediate`
  - `stepExecution`: `First Step Attempt (Rep 1)` => `random / guessing | partial steps | full structure`
  - `repeatability`: `Step Order (Rep 1)` => `incorrect | minor errors | correct`
  - `independence`: `Help-Seeking (Rep 1)` => `waits for help | asks after trying | independent`
- Rep 2:
  - `startBehavior`: `Start Under Observation (Rep 2)` => `avoids | delayed | immediate`
  - `stepExecution`: `Mid-Execution Discipline (Rep 2)` => `random / guessing | partial steps | full structure`
  - `repeatability`: `Correction Response (Rep 2)` => `incorrect | minor errors | correct`
  - `independence`: `Dependence Pattern (Rep 2)` => `waits for help | asks after trying | independent`
- Rep 3:
  - `startBehavior`: `Completion Start (Rep 3)` => `avoids | delayed | immediate`
  - `stepExecution`: `Full Execution (Rep 3)` => `random / guessing | partial steps | full structure`
  - `repeatability`: `Final Step Order (Rep 3)` => `incorrect | minor errors | correct`
  - `independence`: `Can They Finish Alone? (Rep 3)` => `waits for help | asks after trying | independent`

#### Set 2: `Repeatability`

- Reps: `3`
- Purpose: `Test whether execution holds across similar problems without breaking down.`
- Rep instruction: `Solve similar problem.`
- Active rules:
  - `Similar problem - same method`
  - `No step-by-step guidance`
  - `Observe consistency across reps`
- Rep 1:
  - `repeatability`: `First Repeat - Consistency (Rep 1)` => `breaks each time | inconsistent | stable`
  - `stepExecution`: `Step Recall (Rep 1)` => `forgets | partial | full`
  - `independence`: `Error Type (Rep 1)` => `guessing | careless | structured`
  - `startBehavior`: `Completion (Rep 1)` => `cannot finish | partial | complete`
- Rep 2:
  - `repeatability`: `Second Repeat - Pattern (Rep 2)` => `breaks each time | inconsistent | stable`
  - `stepExecution`: `Step Retention (Rep 2)` => `forgets | partial | full`
  - `independence`: `Self-Correction (Rep 2)` => `guessing | careless | structured`
  - `startBehavior`: `Completion (Rep 2)` => `cannot finish | partial | complete`
- Rep 3:
  - `repeatability`: `Third Repeat - Final Stability (Rep 3)` => `breaks each time | inconsistent | stable`
  - `stepExecution`: `Step Reliability (Rep 3)` => `forgets | partial | full`
  - `independence`: `Independence Signal (Rep 3)` => `guessing | careless | structured`
  - `startBehavior`: `Completion (Rep 3)` => `cannot finish | partial | complete`

### Controlled Discomfort

#### Set 1: `First Contact`

- Reps: `3`
- Purpose: `Test initial response to difficulty under a no-help condition. What does the student do first?`
- Rep instruction: `Try this. No help for 10 seconds.`
- Active rules:
  - `No help for 10 seconds`
  - `Hold the discomfort window`
  - `Do not rescue - observe`
- Rep 1:
  - `initialResponse`: `Immediate Reaction (Rep 1 - Cold Contact)` => `freeze | hesitate | attempt`
  - `firstStepControl`: `First Step Without Prompt (Rep 1)` => `none | prompted | independent`
  - `discomfortTolerance`: `Emotional State (Rep 1)` => `panic | tension | controlled`
  - `rescueDependence`: `Rescue Seeking (Rep 1)` => `asks immediately | asks later | no rescue`
- Rep 2:
  - `initialResponse`: `Persistence Under Hold (Rep 2)` => `freeze | hesitate | attempt`
  - `firstStepControl`: `Step Control Maintained? (Rep 2)` => `none | prompted | independent`
  - `discomfortTolerance`: `Tolerance Window (Rep 2)` => `panic | tension | controlled`
  - `rescueDependence`: `Rescue Pattern (Rep 2)` => `asks immediately | asks later | no rescue`
- Rep 3:
  - `initialResponse`: `Recovery Behavior (Rep 3)` => `freeze | hesitate | attempt`
  - `firstStepControl`: `Reentry After Struggle (Rep 3)` => `none | prompted | independent`
  - `discomfortTolerance`: `Final Stability (Rep 3)` => `panic | tension | controlled`
  - `rescueDependence`: `Final Rescue Check (Rep 3)` => `asks immediately | asks later | no rescue`

#### Set 2: `Pressure Hold`

- Reps: `3`
- Purpose: `Test sustained engagement under difficulty. Can the student persist without rescue?`
- Rep instruction: `Continue. I will only confirm the first step.`
- Active rules:
  - `One-step confirmation only`
  - `No rescue allowed`
  - `Hold pressure - do not relieve it`
- Rep 1:
  - `discomfortTolerance`: `Sustained Engagement (Rep 1)` => `gives up | short attempt | stays engaged`
  - `rescueDependence`: `Rescue Under Sustained Hold (Rep 1)` => `asks immediately | asks later | no rescue`
  - `firstStepControl`: `Structure Retention (Rep 1)` => `breaks | partial | maintained`
  - `initialResponse`: `Recovery After Struggle (Rep 1)` => `collapses | partial | recovers`
- Rep 2:
  - `discomfortTolerance`: `Tolerance Ceiling (Rep 2)` => `gives up | short attempt | stays engaged`
  - `rescueDependence`: `Rescue Pattern (Rep 2)` => `asks immediately | asks later | no rescue`
  - `firstStepControl`: `Can Still Sequence? (Rep 2)` => `breaks | partial | maintained`
  - `initialResponse`: `Composed or Reactive? (Rep 2)` => `collapses | partial | recovers`
- Rep 3:
  - `discomfortTolerance`: `Final Hold - Stability (Rep 3)` => `gives up | short attempt | stays engaged`
  - `rescueDependence`: `Final Rescue Check (Rep 3)` => `asks immediately | asks later | no rescue`
  - `firstStepControl`: `Structure Under Max Pressure (Rep 3)` => `breaks | partial | maintained`
  - `initialResponse`: `Final Recovery (Rep 3)` => `collapses | partial | recovers`

### Time Pressure Stability

#### Set 1: `Light Timer`

- Reps: `3`
- Purpose: `Test structure and start behavior under a timer. First exposure to time constraint.`
- Rep instruction: `Solve under short timer.`
- Active rules:
  - `Timer is active`
  - `Observe structure - not just speed`
  - `Record panic vs controlled response`
- Rep 1:
  - `startUnderTime`: `First Time Exposure - Start (Rep 1)` => `freeze | delayed | immediate`
  - `structureUnderTime`: `Structure on First Timer (Rep 1)` => `breaks | partial | maintained`
  - `paceControl`: `Pace Reaction (Rep 1)` => `panic | rushed | controlled`
  - `completionIntegrity`: `Completion Under Time (Rep 1)` => `fails | partial | complete`
- Rep 2:
  - `startUnderTime`: `Start - Adjusted? (Rep 2)` => `freeze | delayed | immediate`
  - `structureUnderTime`: `Structure Mid-Timer (Rep 2)` => `breaks | partial | maintained`
  - `paceControl`: `Pace Regulation (Rep 2)` => `panic | rushed | controlled`
  - `completionIntegrity`: `Completion Quality (Rep 2)` => `fails | partial | complete`
- Rep 3:
  - `startUnderTime`: `Start - Consistent? (Rep 3)` => `freeze | delayed | immediate`
  - `structureUnderTime`: `Structure Integrity (Rep 3)` => `breaks | partial | maintained`
  - `paceControl`: `Final Pace Control (Rep 3)` => `panic | rushed | controlled`
  - `completionIntegrity`: `Final Completion (Rep 3)` => `fails | partial | complete`

#### Set 2: `Consistency`

- Reps: `3`
- Purpose: `Test whether structure holds across repeated timed attempts. Look for drift.`
- Rep instruction: `Repeat under same time constraint.`
- Active rules:
  - `Same timer`
  - `Observe drift and consistency`
  - `Behavioral pattern - not just completion`
- Rep 1:
  - `completionIntegrity`: `Repeat 1 - Consistency Signal` => `collapses | inconsistent | stable`
  - `startUnderTime`: `Behavior Pattern (Rep 1)` => `panic | tension | composed`
  - `structureUnderTime`: `Structure Repeat 1` => `breaks | partial | maintained`
  - `paceControl`: `Pace Pattern (Rep 1)` => `rushed | uneven | controlled`
- Rep 2:
  - `completionIntegrity`: `Repeat 2 - Holding? (Rep 2)` => `collapses | inconsistent | stable`
  - `startUnderTime`: `Behavioral Drift (Rep 2)` => `panic | tension | composed`
  - `structureUnderTime`: `Structure Stability (Rep 2)` => `breaks | partial | maintained`
  - `paceControl`: `Pace Discipline (Rep 2)` => `rushed | uneven | controlled`
- Rep 3:
  - `completionIntegrity`: `Repeat 3 - Final Stability (Rep 3)` => `collapses | inconsistent | stable`
  - `startUnderTime`: `Final Behavior (Rep 3)` => `panic | tension | composed`
  - `structureUnderTime`: `Final Structure (Rep 3)` => `breaks | partial | maintained`
  - `paceControl`: `Final Pace (Rep 3)` => `rushed | uneven | controlled`

## Training library

### Clarity

#### Set 1: `Modeling`

- Reps: `1`
- Purpose: `Build the mental map before drilling.`
- Rep instruction: `Teach Vocabulary → Method → Reason, then ask the student to explain back.`
- Modeling set: `true`
- Active rules:
  - `Tutor models - student does NOT solve`
  - `Vocab → Method → Reason sequence`
  - `Ask student to explain back after each model`
- Observation block: none

#### Set 2: `Identification`

- Reps: `3`
- Purpose: `Recognition without solving. Student names terms, identifies type, states steps, explains why.`
- Rep instruction: `Show the problem. Ask student to: name the terms, identify the type, state the steps, explain why it works. No solving allowed.`
- Active rules:
  - `No solving allowed`
  - `Push for vocabulary precision`
  - `All 4 layers: terms, type, steps, reason`
- Rep 1:
  - `vocabulary`: `Type Recognition (Rep 1)` => `wrong | hesitant | correct`
  - `method`: `Step Recall (Rep 1)` => `missing | partial | clear`
  - `reason`: `Reason Recall (Rep 1)` => `none | weak | clear`
  - `immediateApply`: `Response Behavior (Rep 1)` => `avoids answering | unsure but tries | confident`
- Rep 2:
  - `vocabulary`: `Type Recognition (Rep 2)` => `wrong | hesitant | correct`
  - `method`: `Step Recall (Rep 2)` => `missing | partial | clear`
  - `reason`: `Reason Recall (Rep 2)` => `none | weak | clear`
  - `immediateApply`: `Response Behavior (Rep 2)` => `avoids answering | unsure but tries | confident`
- Rep 3:
  - `vocabulary`: `Type Recognition (Rep 3)` => `wrong | hesitant | correct`
  - `method`: `Step Recall (Rep 3)` => `missing | partial | clear`
  - `reason`: `Reason Recall (Rep 3)` => `none | weak | clear`
  - `immediateApply`: `Response Behavior (Rep 3)` => `avoids answering | unsure but tries | confident`

#### Set 3: `Light Apply`

- Reps: `3`
- Purpose: `Test clarity under active solving. Minimal guidance only. Observe whether clarity holds when they execute.`
- Rep instruction: `Ask student to solve. Minimal guidance. Observe clarity under execution.`
- Active rules:
  - `Minimal guidance only`
  - `No step-by-step help`
  - `Observe independent start and execution`
- Rep 1:
  - `vocabulary`: `Vocabulary Usage (Rep 1)` => `incorrect | partial | correct`
  - `method`: `Step Execution (Rep 1)` => `skips | inconsistent | structured`
  - `reason`: `Reason Usage (Rep 1)` => `absent | weak | present`
  - `immediateApply`: `Start Behavior (Rep 1)` => `delayed | hesitant | immediate`
- Rep 2:
  - `vocabulary`: `Vocabulary Usage (Rep 2)` => `incorrect | partial | correct`
  - `method`: `Step Execution (Rep 2)` => `skips | inconsistent | structured`
  - `reason`: `Reason Usage (Rep 2)` => `absent | weak | present`
  - `immediateApply`: `Start Behavior (Rep 2)` => `delayed | hesitant | immediate`
- Rep 3:
  - `vocabulary`: `Vocabulary Usage (Rep 3)` => `incorrect | partial | correct`
  - `method`: `Step Execution (Rep 3)` => `skips | inconsistent | structured`
  - `reason`: `Reason Usage (Rep 3)` => `absent | weak | present`
  - `immediateApply`: `Start Behavior (Rep 3)` => `delayed | hesitant | immediate`

### Structured Execution

#### Set 1: `Required Structure`

- Reps: `3`
- Purpose: `Require structured execution. Student must state all steps first, then solve. Build discipline before independence.`
- Rep instruction: `State steps first. Then solve.`
- Active rules:
  - `Steps must be stated before solving`
  - `No skipping steps`
  - `Correct step order required`
- Shared observation block for reps 1-3:
  - `startBehavior`: `Start` => `delayed | hesitant | immediate`
  - `stepExecution`: `Step Discipline` => `skips | partial | full`
  - `repeatability`: `Correction Response` => `resists | accepts | adjusts`
  - `independence`: `Independence` => `needs help | light support | independent`

#### Set 2: `Independent Execution`

- Reps: `3`
- Purpose: `Full independent execution without any help. Build consistent, repeatable execution.`
- Rep instruction: `Solve independently.`
- Active rules:
  - `No help from tutor`
  - `Full independence expected`
  - `Observe consistency and error handling`
- Shared observation block for reps 1-3:
  - `independence`: `Independence` => `needs help | light support | independent`
  - `repeatability`: `Consistency` => `breaks | inconsistent | stable`
  - `stepExecution`: `Error Handling` => `guesses | partial correction | structured correction`
  - `startBehavior`: `Start` => `delayed | hesitant | immediate`

#### Set 3: `Variation Control`

- Reps: `3`
- Purpose: `Test transfer. Student adapts to a slightly different form using the same method. Method must survive variation.`
- Rep instruction: `Solve slightly different form.`
- Active rules:
  - `Same method - different form`
  - `Test transfer not memorization`
  - `No hints on what changed`
- Shared observation block for reps 1-3:
  - `stepExecution`: `Transfer` => `cannot adapt | partial | adapts`
  - `repeatability`: `Step Retention` => `lost | partial | stable`
  - `independence`: `Completion` => `fails | partial | complete`
  - `startBehavior`: `Start` => `delayed | hesitant | immediate`

### Controlled Discomfort

#### Set 1: `Controlled Entry`

- Reps: `3`
- Purpose: `Build controlled entry under difficulty. Force a pause before the first action.`
- Rep instruction: `Pause. Then state the first step.`
- Active rules:
  - `Force a pause before starting`
  - `First step must be stated out loud`
  - `Do not let them jump in`
- Shared observation block for reps 1-3:
  - `initialResponse`: `Start Control` => `freeze | hesitant | controlled`
  - `firstStepControl`: `First-Step Accuracy` => `wrong | partial | correct`
  - `discomfortTolerance`: `Stability` => `breaks | unstable | stable`
  - `rescueDependence`: `Rescue Behavior` => `frequent | occasional | none`

#### Set 2: `No Rescue`

- Reps: `3`
- Purpose: `Build independence under difficulty. No rescue under any circumstance.`
- Rep instruction: `Continue. No full help.`
- Active rules:
  - `No rescue allowed`
  - `Hold the hold - do not relieve`
  - `Observe rescue-seeking pattern`
- Shared observation block for reps 1-3:
  - `rescueDependence`: `Independence` => `dependent | partial | independent`
  - `discomfortTolerance`: `Stability` => `breaks | unstable | stable`
  - `initialResponse`: `Recovery` => `collapses | partial | recovers`
  - `firstStepControl`: `First-Step Control` => `none | prompted | independent`

#### Set 3: `Repeat Exposure`

- Reps: `3`
- Purpose: `Repeat exposure to build tolerance. Same difficulty level. The target is stability - not just survival.`
- Rep instruction: `Another similar difficulty.`
- Active rules:
  - `Same difficulty level`
  - `Repeat exposure - build tolerance`
  - `Observe consistency of response`
- Shared observation block for reps 1-3:
  - `discomfortTolerance`: `Consistency` => `breaks | inconsistent | stable`
  - `initialResponse`: `Recovery` => `collapses | partial | recovers`
  - `rescueDependence`: `Rescue Behavior` => `frequent | occasional | none`
  - `firstStepControl`: `First-Step Control` => `none | prompted | independent`

### Time Pressure Stability

#### Set 1: `Structure Under Timer`

- Reps: `3`
- Purpose: `Build structured execution under a timer. Method is priority - speed is secondary.`
- Rep instruction: `Focus on method, not speed.`
- Active rules:
  - `Timer active`
  - `Method priority - not speed`
  - `Structure must be maintained throughout`
- Shared observation block for reps 1-3:
  - `startUnderTime`: `Start` => `panic | hesitant | controlled`
  - `structureUnderTime`: `Structure` => `lost | partial | maintained`
  - `paceControl`: `Pace` => `rushed | uneven | controlled`
  - `completionIntegrity`: `Completion` => `fails | partial | complete`

#### Set 2: `Repeated Timed Execution`

- Reps: `3`
- Purpose: `Build consistency under repeated timed execution. Same constraint - look for drift.`
- Rep instruction: `Repeat under timer.`
- Active rules:
  - `Same timer constraint`
  - `Build consistency - not just completion`
  - `Observe pace regulation`
- Shared observation block for reps 1-3:
  - `completionIntegrity`: `Consistency` => `breaks | inconsistent | stable`
  - `paceControl`: `Pace` => `rushed | uneven | controlled`
  - `structureUnderTime`: `Structure` => `lost | partial | maintained`
  - `startUnderTime`: `Start` => `panic | hesitant | controlled`

#### Set 3: `Full Constraint`

- Reps: `3`
- Purpose: `Full constraint drill. Tighter time - structure and completion integrity both tested.`
- Rep instruction: `Solve under tighter time.`
- Active rules:
  - `Tighter timer`
  - `Full constraint - no relief`
  - `Structure + completion both required`
- Shared observation block for reps 1-3:
  - `completionIntegrity`: `Completion` => `fails | partial | complete`
  - `structureUnderTime`: `Integrity` => `collapses | unstable | stable`
  - `paceControl`: `Pace` => `rushed | uneven | controlled`
  - `startUnderTime`: `Start` => `panic | hesitant | controlled`

## State engine exact overview

## 1. Transition engine

Source: `shared/topicConditioningEngine.ts`

Inputs:

- `previous_phase`
- `previous_stability`
- `drill_total_out_of_100`

Outputs:

- `next_phase`
- `next_stability`
- `transition_reason`

Thresholds:

- From `Low`:
  - `0-49` => remain `Low`
  - `50-79` => advance to `Medium`
  - `80-100` => advance to `High`
- From `Medium`:
  - `0-44` => regress to `Low`
  - `45-79` => remain `Medium`
  - `80-100` => advance to `High`
- From `High`:
  - `0-49` => regress to `Medium`
  - `50-84` => remain `High`
  - `85-100` => advance to `High Maintenance`
- From `High Maintenance`:
  - `0-59` => regress to `High`
  - `60-84` => remain `High Maintenance`
  - `85-100` => `phase progress`, move to next phase at `Low`

Phase progression rule:

- Only legal when previous stability is `High Maintenance` and score is `>= 85`
- `next_phase = getNextPhase(previous_phase)`
- `next_stability = Low`
- If already in final phase, `getNextPhase` returns current phase, so final-phase `High Maintenance` + `85+` produces the same phase at `Low` with `phase progress`

## 2. Next-action engine

Source: `shared/topicConditioningEngine.ts` and `client/src/components/tutor/topicConditioningEngine.ts`

Per phase × stability, the engine provides:

- `primaryAction`
- `rules`
- `nextActions`
- optional `advanceTo`

### Clarity

- Low:
  - Primary action: `Run Clarity drill`
  - Rules: `No Boss Battles`; `No time pressure`; `No skipping layers`
  - Next actions: `Reinforce Vocabulary, Method & Reason (3 Layer Lens)`; `Reinforce Method (step sequence)`; `Reinforce Reason (why it works)`; `Re-model same concept`; `Immediate Apply after each model`
- Medium:
  - Primary action: `Run Clarity drill`
  - Rules: `No Boss Battles as primary`; `No time pressure`; `Reduce explanation, increase execution`
  - Next actions: `Continue 3-Layer Lens`; `Run Clarity drill`; `Start light execution checks (can they repeat without help?)`
- High:
  - Primary action: `Run Clarity High Maintenance drill`
  - Rules: `Do NOT phase advance yet`; `Prove repeatable stability first`
  - Next actions: `Run High Maintenance check in Clarity`; `Reduce modeling`; `Increase independent attempts`; `Validate consistency across full set volume`
- High Maintenance:
  - Primary action: `Run Structured Execution drill`
  - Rules: `Do NOT stay in teaching mode`; `Move forward`
  - Next actions: `Transition to Structured Execution`; `Reduce modeling`; `Increase independent attempts`
  - `advanceTo`: `Structured Execution`

### Structured Execution

- Low:
  - Primary action: `Run Structured Execution drill`
  - Rules: `No time pressure`; `Boss Battles only if student can start`; `No over-explaining`
  - Next actions: `Run strict Model -> Apply -> Guide loops`; `Enforce step-by-step execution`; `Correct every skipped step`; `Require student to start every problem`
- Medium:
  - Primary action: `Run Structured Execution drill`
  - Rules: `Do not rush to time pressure`; `Still reinforce structure every time`
  - Next actions: `Run Structured Execution drill`; `Reduce modeling`; `Strengthen consistency across multiple problems`; `Introduce light Boss Battles`
- High:
  - Primary action: `Run Structured Execution High Maintenance drill`
  - Rules: `Do NOT phase advance yet`; `Prove repeatable stability first`
  - Next actions: `Run High Maintenance check in Structured Execution`; `Run Structured Execution drill`; `Confirm repeatable execution stability`
- High Maintenance:
  - Primary action: `Run Controlled Discomfort drill`
  - Rules: `Do NOT keep repeating basic problems`; `Move forward`
  - Next actions: `Transition to Controlled Discomfort`; `Introduce Boss Battles consistently`; `Focus on response under uncertainty`
  - `advanceTo`: `Controlled Discomfort`

### Controlled Discomfort

- Low:
  - Primary action: `Run Controlled Discomfort drill`
  - Rules: `No rescuing`; `No full explanations mid-struggle`; `No time pressure yet`
  - Next actions: `Introduce Boss Battles carefully`; `Enforce 10-15 second pause`; `Guide only to first step`; `Reinforce start despite uncertainty`
- Medium:
  - Primary action: `Run Controlled Discomfort drill`
  - Rules: `Do not remove difficulty`; `Do not over-guide`
  - Next actions: `Run Controlled Discomfort drill`; `Reduce hesitation time`; `Push independent starts`; `Reinforce calm execution`
- High:
  - Primary action: `Run Controlled Discomfort High Maintenance drill`
  - Rules: `Do NOT phase advance yet`; `Prove repeatable stability first`
  - Next actions: `Run High Maintenance check in Controlled Discomfort`; `Increase difficulty consistency`; `Confirm composed starts under uncertainty`
- High Maintenance:
  - Primary action: `Run Time Pressure Stability drill`
  - Rules: `Do NOT stay in comfort zone`; `Move forward`
  - Next actions: `Transition to Time Pressure Stability`; `Introduce timed Boss Battles`; `Maintain structure under constraint`
  - `advanceTo`: `Time Pressure Stability`

### Time Pressure Stability

- Low:
  - Primary action: `Run Time Pressure Stability drill`
  - Rules: `Do not push speed`; `Do not increase time pressure aggressively`
  - Next actions: `Run Time Pressure Stability drill`; `Reinforce process over speed`; `Debrief after every attempt`; `Re-anchor structure`
- Medium:
  - Primary action: `Run Time Pressure Stability drill`
  - Rules: `Do not sacrifice structure for speed`; `Maintain method discipline`
  - Next actions: `Run Time Pressure Stability drill`; `Reduce breakdown frequency`; `Strengthen full execution within time`
- High:
  - Primary action: `Run Time Pressure Stability High Maintenance drill`
  - Rules: `Do NOT declare transfer yet`; `Confirm sustained stability first`
  - Next actions: `Run High Maintenance check under time pressure`; `Confirm structure under timed variation`; `Sustain consistency across multiple sets`
- High Maintenance:
  - Primary action: `Run Time Pressure Stability maintenance drill`
  - Rules: `Do not over-train same pattern`; `Begin cross-topic conditioning`
  - Next actions: `Run Time Pressure Stability maintenance drill`; `Introduce new variations of topic`; `Prepare for transfer to new topics`

## 3. Tutor-facing interpreted state

Source: `client/src/components/tutor/topicConditioningEngine.ts`

`interpretTopicState` returns:

- `nextAction`: the `primaryAction`
- `transitionStatus`:
  - `High Maintenance`:
    - non-final phase => `Advance to <next phase>`
    - final phase => `Maintain and transfer to new topics`
  - `High` => `Run High Maintenance check before advancing`
  - `Medium` => `Hold current phase - build stability before advancing`
  - `Low`:
    - `Clarity` => `Hold at Clarity - reinforce foundations`
    - otherwise => `Reinforce <previous phase> - stability too low to advance`

## 4. Observation-behavior translation

Source: `shared/topicConditioningEngine.ts`

`mapObservationsToBehavior` maps normalized observation levels into phrases by key family:

- Clarity family
  - Aliases: `vocabulary`, `reason`, `immediate_apply`, `immediateapply`
  - Weak => `clarity breakdown`
  - Clear => `clearer concept recall`
- Method family
  - Aliases: `method`, `step`, `execution`, `repeatability`
  - Weak => `inconsistent step execution`
  - Clear => `more reliable step execution`
- Independence family
  - Aliases: `independence`, `dependence`, `support`, `rescue`
  - Weak => `early dependence`
  - Clear => `more independent execution`
- Start family
  - Aliases: `start`, `initial`
  - Weak => `delayed starts`
  - Clear => `earlier independent starts`
- Difficulty family
  - Aliases: `boss`, `discomfort`, `pressure`, `first_step`
  - Weak => `hesitation under pressure`
  - Clear => `better control under difficulty`
- Structure family
  - Aliases: `structure`, `completion`, `integrity`
  - Weak => `structure breakdown`
  - Clear => `stronger structure retention`
- Pace family
  - Aliases: `pace`, `time`, `speed`
  - Weak => `pace loss`
  - Clear => `more controlled pace`
- Fallback: `no mapped observation signal detected`

## 5. Parent translation engine

Actual parent meaning source for dashboard state copy:

- `client/src/pages/client/parent/dashboard.tsx`
- constant name in current code: `PARENT_STATE_ENGINE`

This is the phase-specific parent dashboard matrix to use for `status`, `meaning`, and `focus`.

### Clarity

- Low:
  - Status: `Your child is still building a clear understanding of this topic.`
  - Meaning: `They are not yet fully comfortable with the terms, steps, or logic involved.`
  - Focus: `We are rebuilding the foundation so they can clearly recognize and understand the problem.`
- Medium:
  - Status: `Your child is beginning to understand this topic more clearly.`
  - Meaning: `They can follow explanations, but still need reinforcement to apply it independently.`
  - Focus: `We are increasing practice and helping them apply the method more consistently.`
- High:
  - Status: `Your child now understands this topic clearly.`
  - Meaning: `They can recognize the problem and explain the steps with confidence.`
  - Focus: `We are moving into independent problem-solving to build execution.`
- High Maintenance:
  - Status: `Your child has sustained strong clarity in this topic.`
  - Meaning: `They have held high performance consistently and are ready for progression decisions.`
  - Focus: `We are now transitioning into Structured Execution training.`

### Structured Execution

- Low:
  - Status: `Your child is learning to apply the steps correctly.`
  - Meaning: `They understand the topic but struggle to follow the method consistently on their own.`
  - Focus: `We are reinforcing a clear step-by-step approach so they can start and complete problems reliably.`
- Medium:
  - Status: `Your child is becoming more consistent in solving problems.`
  - Meaning: `They can follow the method in many cases, but still show occasional inconsistency.`
  - Focus: `We are increasing independent practice to strengthen consistency.`
- High:
  - Status: `Your child can now solve problems consistently in this topic.`
  - Meaning: `They are able to follow the correct steps independently with minimal support.`
  - Focus: `We are verifying sustained high execution through repeated, constrained practice before introducing more challenging questions to strengthen their response under difficulty.`
- High Maintenance:
  - Status: `Your child has sustained strong execution consistency in this topic.`
  - Meaning: `They have held high execution quality across sessions and are ready for progression decisions.`
  - Focus: `We are now transitioning into Controlled Discomfort training.`

### Controlled Discomfort

- Low:
  - Status: `Your child is starting to face more challenging problems in this topic.`
  - Meaning: `They can solve basic problems, but struggle when questions become less familiar.`
  - Focus: `We are helping them stay calm and start correctly even when the problem feels difficult.`
- Medium:
  - Status: `Your child is improving in handling difficult questions.`
  - Meaning: `They can work through unfamiliar problems, but still show hesitation at times.`
  - Focus: `We are increasing exposure to harder questions to build confidence under difficulty.`
- High:
  - Status: `Your child is handling difficult problems well.`
  - Meaning: `They are able to stay structured and solve unfamiliar questions with stability.`
  - Focus: `We are preparing them to perform under time pressure.`
- High Maintenance:
  - Status: `Your child has sustained strong performance under challenge in this topic.`
  - Meaning: `They have held high stability in difficult work and are ready for progression decisions.`
  - Focus: `We are now transitioning into Time Pressure Stability training.`

### Time Pressure Stability

- Low:
  - Status: `Your child is learning to stay structured under time pressure.`
  - Meaning: `They can solve problems, but may lose structure when working against the clock.`
  - Focus: `We are helping them maintain their method while working within time limits.`
- Medium:
  - Status: `Your child is becoming more stable under time pressure.`
  - Meaning: `They are improving their ability to complete problems within time while staying structured.`
  - Focus: `We are increasing timed practice to strengthen consistency.`
- High:
  - Status: `Your child is performing consistently under time pressure.`
  - Meaning: `They can solve problems accurately and maintain structure even under time constraints.`
  - Focus: `We are maintaining performance and preparing them to transfer this skill to new topics.`
- High Maintenance:
  - Status: `Your child has sustained top stability under time pressure.`
  - Meaning: `They consistently maintain structure and accuracy under timed conditions.`
  - Focus: `We are maintaining performance and expanding transfer across related topics.`

Generic shared translator still exists in `shared/topicConditioningEngine.ts`, but it is not the actual dashboard phase-specific meaning source.

`translateTransitionForParent` maps:

- `stability advance` => `showing improved consistency`
- `stability regress` => `working through some challenges`
- `phase progress` => `ready to advance to the next level`
- `remain` => `continuing to build at this level`
- default => `making steady progress`

## 6. Proposal-view parent state matrix

Source: `client/src/components/parent/ProposalView.tsx`

This is a separate full `phase × stability` parent-copy matrix.

### Clarity

- Low:
  - Status: `did not consistently identify terms, problem type, or starting structure during diagnosis`
  - Meaning: `needs clearer recognition before independent execution can be trained`
- Medium:
  - Status: `showed partial recognition of terms and structure across the diagnosis sets`
  - Meaning: `can follow parts of the method but still needs reinforcement for consistent clarity`
- High:
  - Status: `demonstrated clear recognition and explanation patterns in the diagnosis topic`
  - Meaning: `begins training in Clarity with system scoring determining remain, regress, or advance`
- High Maintenance:
  - Status: `has shown repeated high consistency in Clarity across strong sessions`
  - Meaning: `is at the gate where one more strong session can trigger progression to Structured Execution`

### Structured Execution

- Low:
  - Status: `did not execute the method consistently without support`
  - Meaning: `needs repetition of start behavior and step order to stabilize execution`
- Medium:
  - Status: `executed parts of the method correctly but showed inconsistency across attempts`
  - Meaning: `needs stronger independent repetition before phase pressure increases`
- High:
  - Status: `maintained method execution consistently across attempts`
  - Meaning: `begins training in Structured Execution with transitions handled by session scoring`
- High Maintenance:
  - Status: `has repeatedly sustained stable independent execution across sets`
  - Meaning: `is at the gate where one more strong session can trigger progression to Controlled Discomfort`

### Controlled Discomfort

- Low:
  - Status: `destabilized when problems became less familiar or more difficult`
  - Meaning: `needs structured exposure to difficulty while preserving method control`
- Medium:
  - Status: `stayed structured in some higher-friction prompts but not consistently`
  - Meaning: `needs more discomfort reps before timed pressure is introduced`
- High:
  - Status: `stayed structured during challenge-heavy prompts`
  - Meaning: `begins training in Controlled Discomfort with transitions handled by session scoring`
- High Maintenance:
  - Status: `has repeatedly held structure under discomfort across strong sessions`
  - Meaning: `is at the gate where one more strong session can trigger progression to Time Pressure Stability`

### Time Pressure Stability

- Low:
  - Status: `lost structure when time pressure increased`
  - Meaning: `needs controlled timed reps to stabilize pace and method integrity`
- Medium:
  - Status: `retained structure in parts of timed work but showed instability across attempts`
  - Meaning: `needs continued timed conditioning for consistent performance`
- High:
  - Status: `maintained structured execution under timed conditions`
  - Meaning: `can now sustain method integrity under pressure`
- High Maintenance:
  - Status: `has repeatedly sustained structured execution under timed pressure`
  - Meaning: `is in maintenance mode and will continue with mixed practice to preserve transfer-ready stability`
