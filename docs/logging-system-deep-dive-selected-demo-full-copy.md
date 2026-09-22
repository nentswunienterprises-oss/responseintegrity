# Response Integrity-OS Deep Dive

**Canonical reference**
The single source of truth for live Response Integrity-OS algorithm rules is [Response Integrity-OS Live Implementation Source of Truth](response-integrity-os-implementation-source-of-truth.md).
This file is a logging and runner deep dive, not the canonical implementation spec.
If any shared engine rule here conflicts with the canonical spec or current code, the canonical spec wins and this file must be brought back into alignment.

## Logging System

Evidence capture, score resolution, and system-led output

## What Logging Is For

Tutors do not log opinions. Tutors log what actually happened. The system uses that evidence to decide whether to hold, place, or move.

### Intro diagnosis

Logging supports phase verification and placement.

### Active training

Logging supports continuity, reinforcement, and next-step selection.

### Handover verification

Logging supports continuity checks after Specialist reassignment.

Handover is evidence-driven continuity verification. It is not a fixed rep sequence and it is not a Training drill.

### Handover operating chain

1. Inherit the active topic, phase, stability, evidence history, next action, and constraints.
2. Prepare a small reserve bank of phase-appropriate continuity problems.
3. Present one clean continuity opportunity at a time.
4. Record the concrete behavior that actually happened.
5. Record not-observed or confounded evidence when the behavior cannot be interpreted cleanly.
6. Let the Response Evidence Model decide whether another comparable opportunity is required.
7. Stop when evidence resolves to hold, bounded same-phase stability adjustment, or targeted evidence-complete re-diagnosis.

The reserve problem bank is not a completion quota.

### Handover evidence language

The live Handover runner uses the same canonical behavior contract as Diagnosis:

- breakdown
- conditional
- near-stable
- supported
- not observed
- confounded

The Specialist sees concrete behavior options rather than choosing these state classes directly.

Not-observed and confounded evidence count as neither weakness nor strength.

### Recovery and contradiction

A real breakdown is not erased by one later clean response.

With the current minimum of two valid opportunities, recovery after an earlier breakdown requires three trailing supported comparable opportunities.

Confirmed phase-defining breakdown stops Handover and routes the topic to targeted evidence-complete re-diagnosis.

Persistent conditional evidence can adjust stability only after the bounded verification window closes.

### Handover result screen

The live result is evidence-first and shows:

- inherited state
- resulting state
- evidence reason
- dimension-level evidence decisions
- recovery status
- next action
- active constraint

Compatibility scoring is technical reference only and has no authority over phase, stability, recovery, regression, or re-diagnosis.

### Audit relevance

Evidence integrity is the operating standard:

- do not strengthen an observation beyond what happened;
- do not convert missing evidence into weakness;
- do not use post-help behavior as independent evidence;
- do not add extra Handover opportunities to chase a preferred result;
- do not manually change state against the system decision.

If the observation record is manipulated, the Handover decision and downstream institutional record are compromised.


---

## All Selected Demo Cards

### Training: Clarity

Can the student see the problem clearly before solving? Clarity is naming what's there, recognizing the method, understanding why. If this fails - everything else collapses.

Constraints:

- No Boss Battles
- No time pressure
- No skipping layers

### Training: Structured Execution

Test and build ability to execute the known method independently. Student knows - now prove they can do it alone, repeatably.

Constraints:

- State steps before solving
- No guessing tolerated
- No skipping steps

### Training: Controlled Discomfort

Test and stabilize behavior under uncertainty and difficulty. Does the student persist - or shut down?

Constraints:

- No full rescue
- Hold discomfort window
- One-step confirmation max

### Training: Time Pressure Stability

Maintain method structure under urgency. Structure is the target - speed is secondary.

Constraints:

- Method over speed
- Timer is active
- Structured response required - panic responding is logged as instability.

### Intro Diagnosis Start: Clarity

Can the student see the problem clearly before solving? Clarity is naming what's there, recognizing the method, understanding why. If this fails - everything else collapses.

Constraints:

- No Boss Battles
- No time pressure
- No skipping layers

### Intro Diagnosis Start: Structured Execution

Test and build ability to execute the known method independently. Student knows - now prove they can do it alone, repeatably.

Constraints:

- State steps before solving
- No guessing tolerated
- No skipping steps

### Intro Diagnosis Start: Controlled Discomfort

Test and stabilize behavior under uncertainty and difficulty. Does the student persist - or shut down?

Constraints:

- No full rescue
- Hold discomfort window
- One-step confirmation max

### Intro Diagnosis Start: Time Pressure Stability

Maintain method structure under urgency. Structure is the target - speed is secondary.

Constraints:

- Method over speed
- Timer is active
- Structured response required - panic responding is logged as instability.

### Handover: Clarity

Verify whether inherited Clarity remains independently available. Do not teach Clarity forward inside Handover.

Constraints:

- No Boss Battles
- No time pressure
- No skipping layers

### Handover: Structured Execution

Verify whether inherited independent method structure still holds under the no-help execution condition.

Constraints:

- State steps before solving
- No guessing tolerated
- No skipping steps

### Handover: Controlled Discomfort

Verify whether inherited control under difficulty still holds without turning the continuity check into Training.

Constraints:

- No full rescue
- Hold discomfort window
- One-step confirmation max

### Handover: Time Pressure Stability

Verify whether inherited structure and control still survive the required timed condition.

Constraints:

- Method over speed
- Timer is active
- Structured response required - panic responding is logged as instability.

---

## Shared Runner Chrome

### Training headers

- Training Drill - Clarity
- Training Drill - Structured Execution
- Training Drill - Controlled Discomfort
- Training Drill - Time Pressure Stability

### Diagnosis headers

- Adaptive Intro Diagnosis - Clarity
- Adaptive Intro Diagnosis - Structured Execution
- Adaptive Intro Diagnosis - Controlled Discomfort
- Adaptive Intro Diagnosis - Time Pressure Stability

### Handover headers

- Handover Verification - Clarity
- Handover Verification - Structured Execution
- Handover Verification - Controlled Discomfort
- Handover Verification - Time Pressure Stability

### Topic labels

- Current Topic: Selected Practice Topic
- Diagnostic Topic: Selected Practice Topic
- Practice Student

### Buttons

- Back
- Start Demo Drill
- Continue to {nextPhase}
- Next
- Submit Demo Drill
- Restart Demo
- Close Demo

### Result screen labels

- Drill submitted. Scoring complete.
- Set Total
- Rep 1
- Rep 2
- Rep 3
- Session Total
- Diagnosis Total
- Verification Total
- System Direction
- This Session Result
- Topic Score
- Before
- Now
- Phase
- Next Session Focus
- Reason
- Tutor Meaning
- Constraint: {current phase rule or drill constraint}

### Diagnosis-only transition copy

- System Transition
- The current phase block is complete. Review the decision before opening the next diagnosis block.
- Current Phase:
- Phase Score:
- System Decision:
- Why:
- What happens next:
- The demo will reset and open the {nextPhase} diagnosis block.
- Adaptive Path

---

## Training Mode

### Clarity

#### Training Prep

##### Drill type

Clarity Drill

##### Objective

Run the correct Clarity training drill for the current topic-state.

##### Set plan

- Set 1: Modeling - 2 problems - Simple/Normal
- Set 2: Identification - 3 problems - Simple/Normal
- Set 3: Light Apply - 3 problems - Simple/Normal

##### Prep rules

- Set 1 is teaching only; no scored observations.
- Prepare 8 total problems (2 model + 6 drill reps).
- No boss battles and no timed pressure in Clarity.
- Difficulty: keep all problems at Simple/Normal level.

##### Required confirmations

- I prepared the full drill problem count.
- I am ready to run the full training structure.
- I will hold the phase rules exactly as shown.

##### Derived from

Full Clarity training structure.

#### Modeling Step

Build the mental map before drilling.

Rep instruction:

Teach Vocabulary -> Method -> Reason, then ask the student to explain back.

Active rules:

- Tutor models first
- Student does not solve yet
- Use Vocabulary -> Method -> Reason

#### Set 2 / 3: Identification

Recognition without solving. Student names terms, identifies type, states steps, explains why.

Rep instruction:

Show the problem. Ask student to: name the terms, identify the type, state the steps, explain why it works. No solving allowed.

Active rules:

- No solving allowed
- Push for vocabulary precision
- All 4 layers: terms, type, steps, reason

Observation choices by rep:

Rep 1

- Type Recognition (Rep 1): wrong / hesitant / correct
- Step Recall (Rep 1): missing / partial / clear
- Reason Recall (Rep 1): none / weak / clear
- Response Behavior (Rep 1): avoids answering / unsure but tries / confident

Rep 2

- Type Recognition (Rep 2): wrong / hesitant / correct
- Step Recall (Rep 2): missing / partial / clear
- Reason Recall (Rep 2): none / weak / clear
- Response Behavior (Rep 2): avoids answering / unsure but tries / confident

Rep 3

- Type Recognition (Rep 3): wrong / hesitant / correct
- Step Recall (Rep 3): missing / partial / clear
- Reason Recall (Rep 3): none / weak / clear
- Response Behavior (Rep 3): avoids answering / unsure but tries / confident

#### Set 3 / 3: Light Apply

Test clarity under active solving with minimal guidance.

Rep instruction:

Ask student to solve. Minimal guidance only.

Active rules:

- Minimal guidance only
- No step-by-step help
- Observe whether clarity holds under solving

Observation choices by rep:

Rep 1

- Vocabulary Usage (Rep 1): incorrect / partial / correct
- Step Execution (Rep 1): skips / inconsistent / structured
- Reason Usage (Rep 1): absent / weak / present
- Start Behavior (Rep 1): delayed / hesitant / immediate

Rep 2

- Vocabulary Usage (Rep 2): incorrect / partial / correct
- Step Execution (Rep 2): skips / inconsistent / structured
- Reason Usage (Rep 2): absent / weak / present
- Start Behavior (Rep 2): delayed / hesitant / immediate

Rep 3

- Vocabulary Usage (Rep 3): incorrect / partial / correct
- Step Execution (Rep 3): skips / inconsistent / structured
- Reason Usage (Rep 3): absent / weak / present
- Start Behavior (Rep 3): delayed / hesitant / immediate

### Structured Execution

#### Training Prep

##### Drill type

Structured Execution Drill

##### Objective

Run the correct Structured Execution training drill for the current topic-state.

##### Set plan

- Set 1 - 3 problems - Simple/Normal
- Set 2 - 3 problems - Simple/Normal
- Set 3 - 3 problems - Simple/Normal

##### Prep rules

- Prepare 9 total problems (3 sets x 3 reps).
- Focus on independent starts and full step sequence.
- Difficulty: keep all problems at Simple/Normal level.

##### Required confirmations

- I prepared the full drill problem count.
- I am ready to run the full training structure.
- I will hold the phase rules exactly as shown.

##### Derived from

Full Structured Execution training structure.

#### Set 1 / 3: Required Structure

Student must state all steps first, then solve.

Rep instruction:

State steps first. Then solve.

Active rules:

- Steps must be stated first
- No skipping steps
- Correct step order required

Observation choices shown on each rep:

- Start: delayed / hesitant / immediate
- Step Discipline: skips / partial / full
- Correction Response: resists / accepts / adjusts
- Independence: needs help / light support / independent

#### Set 2 / 3: Independent Execution

Full independent execution without help.

Rep instruction:

Solve independently.

Active rules:

- No help from tutor
- Full independence expected
- Watch consistency and error handling

Observation choices shown on each rep:

- Independence: needs help / light support / independent
- Consistency: breaks / inconsistent / stable
- Error Handling: guesses / partial correction / structured correction
- Start: delayed / hesitant / immediate

#### Set 3 / 3: Variation Control

Test transfer to a slightly different form using the same method.

Rep instruction:

Solve slightly different form.

Active rules:

- Same method, different form
- Test transfer, not memorization
- No hints on what changed

Observation choices shown on each rep:

- Transfer: cannot adapt / partial / adapts
- Step Retention: lost / partial / stable
- Completion: fails / partial / complete
- Start: delayed / hesitant / immediate

### Controlled Discomfort

#### Training Prep

##### Drill type

Controlled Discomfort Drill

##### Objective

Run the correct Controlled Discomfort training drill for the current topic-state.

##### Set plan

- Set 1 - 3 problems - Hard
- Set 2 - 3 problems - Challenging (but solvable)
- Set 3 - 3 problems - Challenging (but solvable)

##### Prep rules

- Prepare 9 total problems with controlled challenge increase.
- No rescue beyond first-step guidance.

##### Required confirmations

- I prepared the full drill problem count.
- I am ready to run the full training structure.
- I will hold the phase rules exactly as shown.

##### Derived from

Full Controlled Discomfort training structure.

#### Set 1 / 3: Controlled Entry

Build controlled entry under difficulty.

Rep instruction:

Pause. Then state the first step.

Active rules:

- Force a pause before starting
- First step must be stated out loud
- Do not let them jump in

Observation choices shown on each rep:

- Start Control: freeze / hesitant / controlled
- First-Step Accuracy: wrong / partial / correct
- Stability: breaks / unstable / stable
- Rescue Behavior: frequent / occasional / none

#### Set 2 / 3: No Rescue

Build independence under difficulty with no rescue.

Rep instruction:

Continue. No full help.

Active rules:

- No rescue allowed
- Hold the discomfort
- Observe rescue-seeking pattern

Observation choices shown on each rep:

- Independence: dependent / partial / independent
- Stability: breaks / unstable / stable
- Recovery: collapses / partial / recovers
- First-Step Control: none / prompted / independent

#### Set 3 / 3: Repeat Exposure

Repeat exposure to build tolerance at the same difficulty.

Rep instruction:

Another similar difficulty.

Active rules:

- Same difficulty level
- Repeat exposure
- Observe consistency of response

Observation choices shown on each rep:

- Consistency: breaks / inconsistent / stable
- Recovery: collapses / partial / recovers
- Rescue Behavior: frequent / occasional / none
- First-Step Control: none / prompted / independent

### Time Pressure Stability

#### Training Prep

##### Drill type

Time Pressure Stability Drill

##### Objective

Run the correct Time Pressure Stability training drill for the current topic-state.

##### Set plan

- Set 1 - 3 problems - Hard
- Set 2 - 3 problems - Challenging (but solvable)
- Set 3 - 3 problems - Challenging (but solvable)

##### Prep rules

- Prepare 9 total timed problems.
- Keep pressure controlled; preserve structure over speed.

##### Required confirmations

- I prepared the full drill problem count.
- I am ready to run the full training structure.
- I will hold the phase rules exactly as shown.

##### Derived from

Full Time Pressure Stability training structure.

#### Set 1 / 3: Structure Under Timer

Build structured execution under a timer.

Rep instruction:

Focus on method, not speed.

Active rules:

- Timer active
- Method first
- Structure must be maintained

Observation choices shown on each rep:

- Start: panic / hesitant / controlled
- Structure: lost / partial / maintained
- Pace: rushed / uneven / controlled
- Completion: fails / partial / complete

#### Set 2 / 3: Repeated Timed Execution

Build consistency under repeated timed execution.

Rep instruction:

Repeat under timer.

Active rules:

- Same timer
- Build consistency
- Observe pace regulation

Observation choices shown on each rep:

- Consistency: breaks / inconsistent / stable
- Pace: rushed / uneven / controlled
- Structure: lost / partial / maintained
- Start: panic / hesitant / controlled

#### Set 3 / 3: Full Constraint

Full constraint drill with tighter time.

Rep instruction:

Solve under tighter time.

Active rules:

- Tighter timer
- No relief
- Structure and completion both matter

Observation choices shown on each rep:

- Completion: fails / partial / complete
- Integrity: collapses / unstable / stable
- Pace: rushed / uneven / controlled
- Start: panic / hesitant / controlled

---

## Diagnosis Mode

### Clarity

#### Diagnosis Prep

##### Drill type

Clarity Diagnosis Block

##### Objective

Place the topic correctly in Clarity.

##### Set plan

- Diagnosis Block - 3 problems - Simple/Normal

##### Prep rules

- Prepare bidirectionally before the session starts.
- Clarity: 3 Recognition Probe problems
- Structured Execution: 3 Start + Structure problems
- The tutor should be ready for the starting phase and the immediate adjacent phase the system may move into.
- Use the Clarity phase target, but strip the system down to verification only.
- No full teaching cycle and no normal training expansion.

##### Required confirmations

- I prepared bidirectional diagnosis coverage for Clarity, Structured Execution.
- I will use this to place the topic, not to run a normal training session.
- I will hold the Clarity phase rules exactly as shown.

##### Derived from

Derived from the Clarity training lane and expanded to bidirectional adaptive diagnosis coverage.

#### Diagnosis Block: Recognition Probe

Student does not solve. Tests vocabulary, type recognition, and step awareness only.

Rep instruction:

Show the problem. Ask student to name terms, identify type, and state the steps. Do not let them solve.

Active rules:

- Student does not solve
- Recognition only
- No hints or steps from tutor

Observation choices by rep:

Rep 1

- Vocabulary (Rep 1 - Cold Name): cannot name / partial / clear
- Type Recognition (Rep 1): wrong / hesitant / correct
- Step Awareness (Rep 1): none / partial / clear
- First Response (Rep 1): avoids / unsure / engages

Rep 2

- Vocabulary (Rep 2 - Second Look): cannot name / partial / clear
- Method Recognition (Rep 2): wrong / hesitant / correct
- Can They State Steps? (Rep 2): none / partial / clear
- Willingness to Try (Rep 2): avoids / unsure / engages

Rep 3

- Vocabulary (Rep 3 - Confirm): cannot name / partial / clear
- Method Recall (Rep 3): wrong / hesitant / correct
- Can They Explain Why? (Rep 3): none / partial / clear
- Confidence Signal (Rep 3): avoids / unsure / engages

### Structured Execution

#### Diagnosis Prep

##### Drill type

Structured Execution Diagnosis Block

##### Objective

Place the topic correctly in Structured Execution.

##### Set plan

- Diagnosis Block - 3 problems - Simple/Normal

##### Prep rules

- Prepare bidirectionally before the session starts.
- Clarity: 3 Recognition Probe problems
- Structured Execution: 3 Start + Structure problems
- Controlled Discomfort: 3 First Contact problems
- The tutor should be ready for the starting phase and both adjacent phases where they exist.
- Use the same cold-start execution target as training, but only for verification.
- No extra tutor prompting beyond the phase rules.

##### Required confirmations

- I prepared bidirectional diagnosis coverage for Clarity, Structured Execution, Controlled Discomfort.
- I will hold the no-help start window and structure target.
- I will place the topic only.

##### Derived from

Derived from the Structured Execution training lane and expanded to bidirectional adaptive diagnosis coverage.

#### Diagnosis Block: Start + Structure

Test ability to execute from a cold start with no assistance. Observe whether structure exists from the first move.

Rep instruction:

Solve the problem. No help for 10 seconds.

Active rules:

- No help for 10 seconds
- Observe cold start behavior
- Record exactly what happens

Observation choices by rep:

Rep 1

- Cold Start (Rep 1): avoids / delayed / immediate
- First Step Attempt (Rep 1): random / guessing, partial steps, full structure
- Step Order (Rep 1): incorrect / minor errors / correct
- Help-Seeking (Rep 1): waits for help / asks after trying / independent

Rep 2

- Start Under Observation (Rep 2): avoids / delayed / immediate
- Mid-Execution Discipline (Rep 2): random / guessing, partial steps, full structure
- Correction Response (Rep 2): incorrect / minor errors / correct
- Dependence Pattern (Rep 2): waits for help / asks after trying / independent

Rep 3

- Completion Start (Rep 3): avoids / delayed / immediate
- Full Execution (Rep 3): random / guessing, partial steps, full structure
- Final Step Order (Rep 3): incorrect / minor errors / correct
- Can They Finish Alone? (Rep 3): waits for help / asks after trying / independent

### Controlled Discomfort

#### Diagnosis Prep

##### Drill type

Controlled Discomfort Diagnosis Block

##### Objective

Place the topic correctly in Controlled Discomfort.

##### Set plan

- Diagnosis Block - 3 problems - Phase-appropriate challenge

##### Prep rules

- Prepare bidirectionally before the session starts.
- Structured Execution: 3 Start + Structure problems
- Controlled Discomfort: 3 First Contact problems
- Time Pressure Stability: 3 Light Timer problems
- The tutor should be ready for the starting phase and both adjacent phases where they exist.
- Problems should be challenging enough to expose discomfort behavior, but still solvable.
- No rescue beyond the phase allowance.

##### Required confirmations

- I prepared bidirectional diagnosis coverage for Structured Execution, Controlled Discomfort, Time Pressure Stability.
- The problems are challenging enough to test the phase honestly.
- I will classify the topic only.

##### Derived from

Derived from the Controlled Discomfort training lane and expanded to bidirectional adaptive diagnosis coverage.

#### Diagnosis Block: First Contact

Test initial response to difficulty under a no-help condition. What does the student do first?

Rep instruction:

Try this. No help for 10 seconds.

Active rules:

- No help for 10 seconds
- Hold the discomfort window
- Do not rescue

Observation choices by rep:

Rep 1

- Immediate Reaction (Rep 1 - Cold Contact): freeze / hesitate / attempt
- First Step Without Prompt (Rep 1): none / prompted / independent
- Emotional State (Rep 1): panic / tension / controlled
- Rescue Seeking (Rep 1): asks immediately / asks later / no rescue

Rep 2

- Persistence Under Hold (Rep 2): freeze / hesitate / attempt
- Step Control Maintained? (Rep 2): none / prompted / independent
- Tolerance Window (Rep 2): panic / tension / controlled
- Rescue Pattern (Rep 2): asks immediately / asks later / no rescue

Rep 3

- Recovery Behavior (Rep 3): freeze / hesitate / attempt
- Reentry After Struggle (Rep 3): none / prompted / independent
- Final Stability (Rep 3): panic / tension / controlled
- Final Rescue Check (Rep 3): asks immediately / asks later / no rescue

### Time Pressure Stability

#### Diagnosis Prep

##### Drill type

Time Pressure Stability Diagnosis Block

##### Objective

Place the topic correctly in Time Pressure Stability.

##### Set plan

- Diagnosis Block - 3 problems - Phase-appropriate challenge

##### Prep rules

- Prepare bidirectionally before the session starts.
- Controlled Discomfort: 3 First Contact problems
- Time Pressure Stability: 3 Light Timer problems
- The tutor should be ready for the starting phase and the immediate lower phase the system may drop into.
- Use timed pressure only to verify whether structure survives urgency.
- Keep pressure controlled. Structure matters more than speed.

##### Required confirmations

- I prepared bidirectional diagnosis coverage for Controlled Discomfort, Time Pressure Stability.
- I will keep pressure controlled and score structure honestly.
- I will place the topic only.

##### Derived from

Derived from the Time Pressure Stability training lane and expanded to bidirectional adaptive diagnosis coverage.

#### Diagnosis Block: Light Timer

Test structure and start behavior under a timer. First exposure to time constraint.

Rep instruction:

Solve under short timer.

Active rules:

- Timer is active
- Observe structure
- Record panic vs controlled response

Observation choices by rep:

Rep 1

- First Time Exposure - Start (Rep 1): freeze / delayed / immediate
- Structure on First Timer (Rep 1): breaks / partial / maintained
- Pace Reaction (Rep 1): panic / rushed / controlled
- Completion Under Time (Rep 1): fails / partial / complete

Rep 2

- Start - Adjusted? (Rep 2): freeze / delayed / immediate
- Structure Mid-Timer (Rep 2): breaks / partial / maintained
- Pace Regulation (Rep 2): panic / rushed / controlled
- Completion Quality (Rep 2): fails / partial / complete

Rep 3

- Start - Consistent? (Rep 3): freeze / delayed / immediate
- Structure Integrity (Rep 3): breaks / partial / maintained
- Final Pace Control (Rep 3): panic / rushed / controlled
- Final Completion (Rep 3): fails / partial / complete

---

## Handover Mode

The interactive score demo is intentionally not used for Handover.

The current Specialist walkthrough teaches the evidence-native live contract:

- prepare a reserve bank rather than a fixed three-problem block;
- present one continuity opportunity at a time;
- record canonical concrete behaviors;
- preserve not-observed and confounded evidence as ineligible;
- let the system request more clean evidence when the state is still recoverable or unresolved;
- hold inherited state when supported / near-stable continuity is sufficient;
- make a bounded same-phase stability adjustment only for persistent conditional evidence;
- route confirmed breakdown or bounded unresolved evidence to targeted evidence-complete re-diagnosis;
- read the Response Evidence Decision rather than a verification score.

### Phase-specific continuity conditions

Clarity:
- preserve recognition / clarity conditions;
- no Training-forward teaching cycle;
- verify the inherited Clarity dimensions only.

Structured Execution:
- preserve the no-help start and method-structure condition;
- do not supply the method or carry execution.

Controlled Discomfort:
- preserve meaningful difficulty;
- do not rescue away the condition being verified.

Time Pressure Stability:
- preserve the required timer condition;
- structure remains more important than raw speed;
- timer changes make affected evidence confounded.

### Stopping rule

Handover is evidence-complete, not rep-complete.

The current live window permits up to five opportunities as a safety bound, but the system stops earlier whenever evidence is sufficient. The maximum is not a target.

