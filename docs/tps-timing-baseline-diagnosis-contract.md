# TPS Timing, Baseline, Diagnosis, and Measurement Integrity Contract

**Status:** Approved architecture; implementation pending  
**Scope:** Time Pressure Stability timing, baseline authority, diagnosis-origin timing, Structured Execution passive timing, timer-contract readiness, measurement integrity, and legacy recovery  
**Supersedes:** the proof-only pre-TPS calibration fallback in PR #45  
**Does not change:** the four-phase order, evidence-complete diagnosis, Training evidence authority, High Maintenance law, or Specialist state authority

## 1. Purpose

Time Pressure Stability (TPS) can only be valid if the time pressure being applied is meaningful for the individual student and topic.

RI therefore needs a trustworthy no-pressure execution reference before it can apply individualized urgency.

That reference must come from legitimate RI work. RI must not manufacture hidden side reps, arbitrary calibration blocks, or Specialist-chosen timer values.

The governing distinction is:

> **Diagnosis finds the correct load. Training changes the response under that load.**

For timing specifically:

> **The system owns measurement. The Specialist protects the measurement boundary.**

## 2. Non-negotiable laws

1. A topic must not begin TPS Training without a valid student/topic timing reference and an active Timer Contract.
2. TPS timing may never be based on an arbitrary generic timer when an individualized baseline is required.
3. There is no hidden or side-rep pre-TPS calibration block.
4. Structured Execution (SE) Training is the primary source of the no-pressure execution baseline.
5. Only the canonical **Independent Execution** set may authorize the SE Training-origin baseline.
6. Required Structure timing is ineligible because stating the ordered steps is an intentional additional behavior inside the interval.
7. Variation Control timing is ineligible because the changed-form condition is not comparable to the same-form baseline condition.
8. The baseline is selected as the **most recent complete clean three-rep Independent Execution set in the current SE conditioning epoch**.
9. RI never cherry-picks the three fastest, slowest, strongest, or otherwise preferred individual reps across sets or sessions.
10. Earlier eligible timing remains in lineage but does not override a later qualifying complete set.
11. Diagnosis provides the second legitimate route to the timing baseline when a student is being placed above SE without SE Training.
12. Diagnosis remains evidence-complete, not fixed-rep complete. The three-sample requirement belongs to the timing measurement contract, not to a universal diagnosis format.
13. No TPS timed diagnostic probe may be authoritative until a valid individualized timing reference exists.
14. Diagnosis cannot mint High Maintenance.
15. Training remains the mechanism that repeatedly applies the diagnosed load and changes the student's response under that load.
16. Passive timing must not itself create time pressure. No countdown, target, urgency cue, or visible running time is introduced during baseline measurement.
17. Specialist observation/admin time must not be included in the student's execution interval.
18. Specialists cannot manually enter, edit, round, pause, restart, or override baseline elapsed time.
19. Any interruption, intervention, technical failure, task mismatch, or other condition that destroys comparability makes the affected timing ineligible for baseline authority. The attempt remains in lineage.
20. A missing timing baseline is an unresolved evidence/readiness condition, not permission to invent a timer.

## 3. Definitions

### 3.1 Structured Execution conditioning epoch

A topic's SE conditioning epoch begins when the topic enters Structured Execution and ends when it leaves that phase.

If the topic later re-enters Structured Execution, that creates a new epoch.

Timing from an earlier SE epoch remains historical evidence but cannot silently override the current epoch's baseline authority.

### 3.2 Canonical Independent Execution set

The Training set identified by:

`structured_execution.independent_execution`

Its defining baseline-relevant conditions are:

- normal difficulty;
- same-form execution;
- no time pressure;
- no help that supplies the method, first move, or execution structure;
- full independent execution;
- three canonical opportunities.

### 3.3 Timing-eligible rep

A rep is timing-eligible only when:

- it belongs to the canonical Independent Execution set, or to an explicitly equivalent Diagnosis-origin independent baseline opportunity;
- the task condition is normal difficulty and same form;
- there is no active timer or urgency target;
- the execution boundary is valid;
- the student meaningfully completes the execution opportunity;
- support does not supply or materially alter the independent execution being measured;
- the evidence model treats the execution as structurally valid for the baseline purpose;
- the timing record is technically valid.

Correctness alone does not authorize timing eligibility. Eligibility is evidence-model-driven, not answer-only.

### 3.4 Complete clean baseline set

A complete clean baseline set contains all three canonical Independent Execution opportunities with timing-eligible measurements under the same set context.

A contaminated or technically invalid attempt remains in lineage. A lineage-linked replacement may repair the affected canonical opportunity only by re-running that opportunity under the same intended baseline conditions.

### 3.5 Baseline snapshot

A baseline snapshot stores at minimum:

- student ID;
- topic;
- source: Training or Diagnosis;
- source conditioning/diagnosis epoch;
- source set/opportunity IDs;
- three elapsed-time records;
- median baseline duration;
- timing/evidence validity;
- creation time;
- supersession lineage where applicable.

The baseline duration is the median of the three qualifying elapsed times.

### 3.6 Timer Contract

The Timer Contract is the immutable versioned operating contract that converts a valid baseline snapshot into the prescribed TPS timing conditions.

The Specialist does not author the Timer Contract.

## 4. Training-origin baseline authority

### 4.1 Source selection

When a topic passes through SE Training, RI passively measures the canonical Independent Execution set.

If the student remains in SE across multiple Training rounds, RI may accumulate multiple complete clean Independent Execution sets.

The baseline source is always:

> **the most recent qualifying complete clean Independent Execution set in the current SE conditioning epoch**

Example:

- SE round A Independent Execution: 58s / 55s / 57s -> qualifying candidate
- SE round B Independent Execution: 49s / 51s / 48s -> qualifying candidate
- SE round C Independent Execution: 43s / 45s / 44s -> qualifying candidate

If round C is the most recent qualifying complete set, the baseline is:

`median(43, 45, 44) = 44 seconds`

Rounds A and B remain in lineage.

### 4.2 No cross-set cherry-picking

RI must never construct the baseline from:

- one rep from Required Structure;
- one rep from Independent Execution;
- one rep from Variation Control;
- individually selected reps across several Independent Execution sets;
- the three fastest valid reps;
- the three most recent individual reps without set integrity.

The measurement unit is the **complete qualifying Independent Execution set**, not a free pool of durations.

### 4.3 Phase exit readiness

SE phase exit must not leave the institution without a valid baseline source when the topic will later need individualized TPS timing.

If a canonical Independent Execution opportunity is technically invalid or contaminated, the system preserves that attempt and requires a clean lineage-linked replacement inside the legitimate SE evidence flow.

This is not a side calibration activity. It is completion of the canonical SE opportunity under valid conditions.

## 5. Diagnosis-origin baseline authority

### 5.1 Why Diagnosis needs a second route

A student may legitimately be diagnosed directly into Controlled Discomfort or TPS.

That student may therefore never pass through SE Training.

RI must not force unnecessary earlier Training merely to gather timing, but RI also cannot later invent a timer.

Therefore Diagnosis may establish an equivalent no-pressure execution baseline while it is already resolving whether SE can be safely skipped.

### 5.2 Diagnosis remains adaptive

The current neutral independent baseline and execution-repeatability logic already ask whether the student can execute a known method independently with difficulty and time removed.

The timing contract extends that evidence route.

If Diagnosis is going to place the topic above SE and no valid current baseline exists, the engine must resolve the timing-baseline evidence question before above-SE placement is complete.

The three-sample requirement does **not** mean Diagnosis always runs a fixed three-rep SE block.

Instead:

- the first clean comparable independent execution can become timing sample 1;
- subsequent system-selected comparable independent opportunities can become samples 2 and 3;
- if an earlier response layer is found unsupported first, Diagnosis stops there and does not continue collecting timing merely for future use;
- if a valid current baseline already exists, Diagnosis reuses it rather than collecting another bundle;
- if the route genuinely requires placement above SE, the engine gathers only the additional clean comparable independent opportunities required to complete the timing measurement question.

These opportunities remain Diagnosis evidence. They are not backfilled as SE Training and do not imply that SE Training occurred.

### 5.3 Placement into Controlled Discomfort

To finalize placement above SE without SE Training, Diagnosis must have:

- sufficiently supported Clarity;
- sufficiently supported Structured Execution;
- enough clean comparable independent execution timing to establish the baseline snapshot.

Diagnosis may then test difficulty and identify Controlled Discomfort as the earliest unsupported layer.

The baseline exists because SE Training was skipped, not because a side calibration block was inserted later.

### 5.4 Placement into Time Pressure Stability

A TPS-first starting signal is only a routing hypothesis.

Diagnosis must not apply an arbitrary timed challenge and treat the result as authoritative TPS evidence.

Where no valid current Timer Contract exists, the route becomes:

1. establish clean no-pressure independent execution and the timing baseline;
2. establish that earlier layers remain supported under their appropriate conditions;
3. derive/mint the individualized Timer Contract when timed evidence is actually required;
4. apply the system-prescribed timer;
5. observe whether urgency is the earliest unsupported response layer.

A TPS diagnosis therefore means that earlier response layers held sufficiently and the response changed under a valid individualized time condition.

## 6. Diagnosis versus Training

Diagnosis and Training do not have the same job.

### Diagnosis

Diagnosis asks:

> **Where is the earliest condition under which the student's response stops being reliable?**

It uses the minimum named evidence questions required to resolve placement and operating readiness.

### Training

Training asks:

> **How do we repeatedly expose the student to that correct load until the response changes and becomes reliable there?**

This is why higher-phase Training remains real Training even when it contains little conventional teaching.

### Controlled Discomfort

Diagnosis can discover that normal independent execution is intact but difficulty destabilizes the response.

Controlled Discomfort Training then deliberately changes the student's relationship with difficulty through:

- Controlled Entry;
- No Rescue;
- Repeat Exposure;
- repeated exposure to uncertainty/difficulty under phase-appropriate support boundaries.

The intervention is the controlled repeated difficulty condition, not unnecessary re-teaching of mathematics that is already intact.

### Time Pressure Stability

Diagnosis can discover that earlier layers are intact but valid individualized urgency destabilizes the response.

TPS Training then changes the student's relationship with urgency through:

- Structure Under Timer;
- Repeated Timed Execution;
- Full Constraint.

The intervention is repeated time pressure while preserving method, pace regulation, structure, and completion integrity.

## 7. Measurement boundary

### 7.1 System-owned start

When the Specialist activates **Begin Rep** on an eligible baseline opportunity, RI automatically records the execution start timestamp.

The Specialist does not start a separate stopwatch and does not enter a start time.

### 7.2 Student-finished boundary

The execution interval must end when the student's mathematical execution ends.

RI must therefore record an explicit system event equivalent to:

`EXECUTION_ENDED`

The product may label this action **Student Finished**, **End Rep**, or another clear operating phrase, but its meaning is fixed:

> freeze elapsed student execution time now.

This boundary must occur before Specialist post-rep administration can inflate the duration.

### 7.3 Observation and confirmation

After the execution interval is frozen, the Specialist can complete any remaining observation recording and then Confirm Rep/Confirm Set.

Therefore:

`Begin Rep -> student executes -> Execution Ended -> observation/admin completion -> Confirm Rep`

not:

`Begin Rep -> student executes -> Specialist spends time completing form -> Confirm Rep = stop timer`

### 7.4 Passive means non-pressuring

During SE/Diagnosis baseline measurement:

- the student sees no timer;
- the student receives no time target;
- the Specialist does not announce a time target;
- the UI must not create urgency;
- the Specialist does not coach pace;
- the operating condition remains genuinely untimed.

The system may indicate that evidence capture is active, but the running elapsed duration should not become a pacing cue.

## 8. Specialist measurement-integrity standard

Specialists are not timer operators. They are custodians of a valid observation condition.

The Specialist must:

- begin the rep at the true start of the execution opportunity;
- preserve a normal, continuous execution condition;
- avoid creating artificial urgency;
- avoid allowing avoidable dead time unrelated to the student's execution;
- freeze the execution interval at actual student completion;
- record support/interruption/technical events honestly;
- never manipulate timing to create a better-looking baseline;
- never treat passive measurement as permission to alter the phase condition.

The operating principle is:

> **Do not rush because timing is measured. Do not tolerate artificial dead time because the phase is untimed. Preserve the real execution interval.**

Measurement integrity is a Specialist capability.

## 9. Contamination and technical invalidity

A timing sample cannot authorize the baseline when the execution interval is materially changed by, for example:

- method or step supply that changes independent execution;
- first-step assistance that invalidates the intended independence;
- full rescue or teaching;
- interruption that materially extends or fragments the interval;
- task/content mismatch;
- the Specialist failing to mark the execution end at a trustworthy point;
- browser/runtime timing failure;
- duplicated or missing execution-boundary events.

The attempt remains persisted for audit.

The system must distinguish:

- student capability evidence;
- Specialist intervention evidence;
- timing validity;
- technical attempt lineage.

Invalid timing must not silently become a slow student.

## 10. Baseline freezing, supersession, and re-entry

### 10.1 During SE

Each later qualifying complete Independent Execution set supersedes the previous baseline candidate within the same SE epoch.

### 10.2 Leaving SE

When the topic legitimately leaves SE, the most recent qualifying complete set becomes the frozen baseline snapshot for that completed SE epoch.

Controlled Discomfort does not rewrite that no-pressure baseline.

### 10.3 Re-entering SE

If later evidence causes a legitimate return to SE, a new SE conditioning epoch begins.

A later qualifying complete Independent Execution set from the new epoch may supersede the old baseline for future TPS use.

The old baseline remains historical lineage.

## 11. Timer Contract V1

The Timer Contract is versioned and immutable after minting for the applicable topic/conditioning epoch.

The proof-only PR #45 currently implements this V1 schedule:

- Structure Under Timer: baseline duration;
- Repeated Timed Execution: baseline duration;
- Full Constraint: 85% of baseline duration.

These values are system parameters, never Specialist choices.

The 85% compression factor is a **versioned V1 operating parameter**, not a permanent doctrine law. Future empirical validation may create a new Timer Contract version without rewriting historical contracts.

## 12. Progression and readiness gates

### SE -> Controlled Discomfort

Where SE Training is the source route, phase progression must leave a valid frozen baseline snapshot from the current SE epoch.

### Diagnosis -> placement above SE

Where Diagnosis skips SE Training, above-SE placement requires an equivalent valid Diagnosis-origin baseline snapshot.

### Controlled Discomfort -> TPS

TPS entry requires:

- valid earlier-layer state;
- a valid baseline snapshot;
- a valid Timer Contract for the current student/topic lineage.

If the Timer Contract is missing, TPS does not begin.

### TPS work

Every decision-eligible TPS Training opportunity must use the prescribed Timer Contract condition.

Timer relaxation, Specialist-defined timing, or missing contract authority confounds the timed evidence.

## 13. Legacy/current topics without a baseline

A topic may already be in Controlled Discomfort or TPS because it predates this contract.

RI must not solve that gap by inserting hidden untimed calibration reps into the current phase.

The system should surface a bounded readiness condition such as:

`TPS_TIMER_BASELINE_INCOMPLETE`

The recovery route is **targeted evidence-native re-diagnosis**, not side Training reps.

That re-diagnosis may:

- re-establish clean no-pressure independent execution;
- establish the three timing-eligible baseline samples;
- verify lower-layer trust where necessary;
- return the topic to the evidence-supported phase without automatically treating the recovery as regression.

This preserves phase truth and makes the missing measurement explicit.

## 14. Reporting and evidence claims

Passive timing is operational evidence.

It must not automatically produce parent-facing claims such as:

- "the student is faster";
- "speed improved";
- "the student took too long";
- "the student is slow".

Such claims require separate claim-safe lineage.

The baseline exists to define a valid pressure condition, not to turn RI into speed scoring.

## 15. Narrow port from PR #45

The implementation should preserve the useful proof work from PR #45:

- passive execution timing infrastructure;
- baseline sample lineage;
- median-based baseline derivation;
- immutable student/topic Timer Contract store;
- runner-owned TPS countdown;
- prescribed timer evidence;
- technical-invalid attempt persistence;
- replacement-attempt lineage;
- contract-version lineage.

The implementation must change the proof design in these ways:

1. remove the pre-TPS calibration fallback and its side-rep UI;
2. remove calibration as a Timer Contract source;
3. restrict SE baseline authority to the canonical Independent Execution set;
4. select the most recent qualifying complete three-rep set, not the latest three individual eligible records;
5. add Diagnosis-origin baseline authority;
6. require a valid individualized timing reference before authoritative timed Diagnosis;
7. align passive timing with the explicit Begin Rep -> Execution Ended -> Confirm Rep measurement boundary;
8. exclude Specialist admin latency from student execution time;
9. gate TPS entry on Timer Contract readiness;
10. add explicit legacy recovery through targeted re-diagnosis.

## 16. Acceptance criteria

The architecture is implemented correctly only if all of the following are true:

- [ ] Required Structure timing cannot authorize the TPS baseline.
- [ ] Variation Control timing cannot authorize the TPS baseline.
- [ ] A complete clean Independent Execution set can authorize a Training-origin baseline.
- [ ] Multiple SE rounds select the most recent qualifying complete set without cross-set cherry-picking.
- [ ] A contaminated/technical-invalid attempt remains in lineage and cannot authorize timing.
- [ ] Replacement attempts are lineage-linked.
- [ ] Passive baseline measurement shows no countdown or time target.
- [ ] Begin Rep automatically starts timing for eligible opportunities.
- [ ] Student execution time can be frozen before observation/admin completion.
- [ ] Specialist observation latency is excluded from elapsed student execution time.
- [ ] Specialists cannot manually author elapsed time.
- [ ] Diagnosis can establish a three-sample equivalent baseline when legitimately skipping SE Training.
- [ ] Diagnosis stops baseline collection when an earlier unsupported layer already determines placement.
- [ ] Existing valid baseline authority is reused rather than unnecessarily rebuilt.
- [ ] Direct TPS Diagnosis cannot use an arbitrary generic timer.
- [ ] A Timer Contract must exist before decision-eligible TPS evidence.
- [ ] No pre-TPS calibration side-rep path remains.
- [ ] Legacy above-SE topics with missing baseline route to explicit targeted re-diagnosis.
- [ ] Diagnosis never mints High Maintenance.
- [ ] Training remains repeated exposure under the diagnosed load.
- [ ] Reporting does not turn baseline timing into unsupported speed claims.

## 17. Source alignment

This contract must remain aligned with:

- `docs/evidence-complete-diagnosis-contract.md`
- `docs/training-evidence-stability-contract.md`
- `shared/evidenceCompleteDiagnosis.ts`
- `shared/diagnosisObservationMatrix.ts`
- `shared/responseIntegrityDrillRegistry.ts`
- PR #45 proof files:
  - `shared/capabilityTpsTimerContract.ts`
  - `shared/capabilityTpsTimerRuntime.ts`
  - `server/routes/capabilityTpsTimerRuntime.ts`
  - TPS timer migrations and runner finalization work

Where PR #45 conflicts with this document, this contract is authoritative for the eventual port.
