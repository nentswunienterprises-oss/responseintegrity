# Training Evidence and Stability Contract

Status: Approved architecture
Scope: Training, stability, High Maintenance, progression, regression, and evidence authority
Branch: `feat/evidence-complete-diagnosis`

## 1. Purpose

This contract defines how Response Integrity training must convert observed student behavior into topic state.

Diagnosis and training have different jobs:

- Diagnosis discovers the earliest unsupported response layer using the minimum evidence needed to resolve placement.
- Training deliberately creates repeated exposure in order to change the response.
- Training repetition is therefore legitimate, but state movement must still be authorized by behavioral evidence rather than by an averaged numeric score.

The governing training chain is:

`training condition -> concrete observed behavior -> valid evidence -> dimension state -> observed phase stability -> persistent topic state -> next action`

A score may exist for analytics, compatibility, visualization, or historical comparison. A score may not independently authorize a stability change, High Maintenance entry, phase progression, regression, or parent-facing capability claim.

## 2. Non-negotiable laws

1. Specialists record behavior. They do not decide the student's state.
2. Averages may summarize performance. They may not erase a phase-defining breakdown.
3. Not observed and confounded evidence are never converted into weakness.
4. Training support is not automatically contamination. Instead, each opportunity is only allowed to prove the dimensions that remain valid under the support actually given.
5. High Maintenance is a training-earned state. Diagnosis cannot mint it.
6. High Maintenance is a progression-confirmation gate, not a synonym for a high score.
7. A topic may enter High from a strong evidence session, but it may enter High Maintenance only from a later qualifying session while already High.
8. A topic may progress phase only from High Maintenance and only after a later qualifying exit-confirmation session.
9. Ordinary training changes stability inside the current phase. Evidence that appears to contradict an earlier prerequisite triggers targeted re-diagnosis rather than automatic backward phase movement.
10. The final phase, Time Pressure Stability, has no fifth phase. Strong High Maintenance evidence keeps the topic in final-phase maintenance and transfer.
11. Every state change must be explainable from persisted evidence occurrences.
12. Reports may describe only claims authorized by the same evidence that authorized the underlying state or by explicitly claim-safe evidence lineage.

## 3. Training is not diagnosis

Diagnosis is evidence-complete, not rep-complete.

Training is exposure-complete and evidence-authorized.

A training set may deliberately contain repeated opportunities because repetition is part of the intervention. The system should not stop a training set merely because it already knows the student's current state.

However, the completed training exposure does not earn state movement merely because the student accumulated enough points.

The system asks two separate questions:

1. Was the intended training exposure delivered?
2. What capability did the student's valid behavior actually prove?

The first question concerns delivery integrity.
The second question concerns evidence authority.

## 4. Evidence vocabulary

Training uses the same behavioral classes as evidence-native diagnosis:

- `breakdown` - the phase-defining behavior substantially failed.
- `conditional` - the capability appeared only inconsistently, dependently, or with material instability.
- `near_stable` - the capability substantially held but with a small decision-relevant drift.
- `supported` - the capability was cleanly demonstrated under the conditions of that opportunity.
- `not_observed` - the opportunity did not meaningfully expose the behavior.
- `confounded` - assistance, task design, content readiness, interruption, or another factor prevents clean interpretation.

Only the first four classes can contribute to a capability decision.

`not_observed` and `confounded` reduce evidence coverage. They never lower a student by themselves.

## 5. Evidence validity under support

Training contains legitimate intervention. Therefore support is handled at dimension level.

Examples:

- A modeled Clarity example proves that modeling occurred. It does not prove independent Clarity.
- If a Specialist supplies the first step during Controlled Discomfort, that opportunity cannot prove independent first-step control.
- The same opportunity may still prove that the student re-engaged, tolerated the difficult portion, and completed the remaining structure without further rescue.
- If a Specialist provides the method during Structured Execution, that opportunity cannot prove method selection or an independent start.
- If the timer is paused or materially relaxed, that opportunity cannot prove Time Pressure Stability under the original time constraint.

Each persisted evidence occurrence must therefore be either:

- decision-eligible for its dimension,
- not observed for its dimension, or
- confounded for its dimension.

No whole-rep shortcut may silently convert supported and unsupported dimensions into one generic score.

## 6. Dimension resolution

For a single training session, each phase dimension resolves to one of:

- `BREAKDOWN`
- `CONDITIONAL`
- `NEAR_STABLE`
- `SUPPORTED`
- `UNRESOLVED`

Only decision-eligible evidence is considered.

### 6.1 SUPPORTED

A dimension is `SUPPORTED` when either:

- it has enough valid supported occurrences to meet that dimension's temporal requirement with no unresolved later deterioration; or
- earlier conditional / near-stable behavior is followed by at least the normal minimum number of consecutive clean supported comparable opportunities; or
- an earlier breakdown is followed by at least one additional clean supported comparable opportunity beyond the normal minimum.

This recovery suffix is authoritative. Earlier instability is historical evidence, but it does not permanently poison a dimension after the student has cleanly demonstrated recovery.

### 6.2 NEAR_STABLE

A dimension is `NEAR_STABLE` when:

- usable capability is substantially present,
- evidence contains near-stable behavior or a minor drift,
- the drift does not amount to a repeated or final unresolved breakdown,
- and the temporal requirement for full support has not been cleanly met.

### 6.3 CONDITIONAL

A dimension is `CONDITIONAL` when:

- capability appears but is materially inconsistent, reassurance-dependent, support-dependent, or unstable,
- or a single breakdown has not yet been cleanly resolved by later comparable evidence.

### 6.4 BREAKDOWN

A dimension is `BREAKDOWN` when either:

- the final valid comparable opportunity ends in breakdown; or
- repeated breakdown has occurred and the required later recovery sequence has not been completed.

A breakdown history can be superseded only by a stronger recovery sequence: at least one more consecutive supported comparable opportunity than the dimension's normal minimum. Recovery is evidence, but one isolated clean rep cannot erase a genuine break.

### 6.5 UNRESOLVED

A dimension is `UNRESOLVED` when valid coverage is insufficient because the relevant behavior was not observed, was confounded, or the required comparable opportunities did not occur.

Unresolved evidence blocks claims that require that dimension. It does not count as failure.

## 7. Phase-level observed stability

Every completed training drill produces an `observedStability` of Low, Medium, or High.

A training drill never directly produces High Maintenance.

### Low

The current session is observed as Low when at least one phase-critical dimension resolves to `BREAKDOWN`.

Meaning:

> A phase-defining behavior is currently breaking under valid exposure.

### Medium

The current session is observed as Medium when:

- no phase-critical dimension is in decisive breakdown,
- but at least one phase-critical dimension is `CONDITIONAL` or `UNRESOLVED`,
- or required coverage for High has not been established.

Meaning:

> The capability exists, but it is conditional, incomplete, support-dependent, or not yet sufficiently evidenced.

### High

The current session is observed as High when:

- every phase-critical dimension is `SUPPORTED` or `NEAR_STABLE`,
- all mandatory temporal dimensions meet their minimum valid opportunity count,
- all mandatory set contexts have been represented,
- and there is no unresolved phase-critical breakdown.

Meaning:

> The phase-defining capability is substantially present under the current training conditions.

High does not itself authorize progression.

## 8. Persistent stability state

Persistent topic stability remains:

- Low
- Medium
- High
- High Maintenance

The persistent state is not a direct alias for the current session result. It preserves confirmed history and prevents one noisy session from rewriting a previously established capability.

### 8.1 From Low

- observed Low -> remain Low
- observed Medium -> Medium
- observed High -> High

### 8.2 From Medium

- observed Low -> Low
- observed Medium -> remain Medium
- observed High -> High

### 8.3 From High

- observed Low -> Medium
- observed Medium -> Medium
- observed High without High Maintenance entry qualification -> remain High
- observed High with High Maintenance entry qualification -> High Maintenance

A single later poor session can reduce confidence in High, but does not erase the entire phase history in one step.

### 8.4 From High Maintenance

- observed Low -> High
- observed Medium -> High
- observed High without exit qualification -> remain High Maintenance
- observed High with exit qualification -> progress to the next phase at Low
- if the current phase is Time Pressure Stability, observed High with exit qualification -> remain Time Pressure Stability / High Maintenance and enter maintenance-transfer mode

## 9. Temporal separation

High, High Maintenance, and phase progression must not be minted from the same submitted training session.

At minimum:

1. A qualifying session may establish High.
2. A later qualifying session while already High may establish High Maintenance.
3. A later qualifying session while already High Maintenance may authorize phase progression.

This separation protects repeatability and prevents one unusually strong set of reps from being treated as durable transformation.

## 10. Phase contracts

All four dimensions in each phase are phase-critical.

For High, every phase-critical dimension must be at least `NEAR_STABLE`, with the coverage rules below.

For High Maintenance entry, every phase-critical dimension must resolve to `SUPPORTED`.

For phase exit, every phase-critical dimension must resolve to `SUPPORTED` again in a later session, and the designated exit context must itself be clean.

### 10.1 Clarity

Dimensions:

- `clarity.vocabulary`
- `clarity.method`
- `clarity.reason`
- `clarity.immediate_apply`

Training sets:

- Modeling - teaching only, never independent evidence
- Identification - recognition evidence
- Light Apply - evidence that clarity survives active solving

High coverage:

- all four dimensions represented by valid evidence,
- each dimension has at least two valid opportunities across the scored sets,
- Vocabulary and Method must each include at least one valid Light Apply observation,
- no phase-critical dimension ends in unresolved breakdown.

High Maintenance entry:

- all four dimensions resolve to `SUPPORTED`,
- Vocabulary and Method each have supported evidence in both Identification and Light Apply,
- Reason and Immediate Apply each have at least two supported occurrences,
- the final valid Light Apply opportunity contains no breakdown or conditional evidence in a phase-critical dimension.

Exit confirmation:

- must occur in a later submitted session,
- Light Apply is the designated exit context,
- Vocabulary, Method, Reason, and Immediate Apply must all resolve to `SUPPORTED`,
- no modeling evidence may be used to satisfy the exit contract.

Progression target: Structured Execution / Low.

### 10.2 Structured Execution

Dimensions:

- `execution.start`
- `execution.step_discipline`
- `execution.repeatability`
- `execution.independence`

Training sets:

- Required Structure
- Independent Execution
- Variation Control

High coverage:

- all four dimensions represented,
- each dimension has at least two valid comparable opportunities,
- Independent Execution must contain valid no-help evidence,
- Variation Control must contain valid changed-form evidence,
- no phase-critical dimension ends in unresolved breakdown.

High Maintenance entry:

- all four dimensions resolve to `SUPPORTED`,
- Start and Independence each include supported evidence in Independent Execution,
- Step Discipline and Repeatability each include supported evidence in Variation Control,
- at least two of the three Variation Control reps show supported Start, Step Discipline, and Independence,
- the final valid changed-form opportunity contains no breakdown or conditional evidence in a phase-critical dimension.

Exit confirmation:

- must occur in a later submitted session,
- Variation Control is the designated exit context,
- at least two valid changed-form reps support Start, Step Discipline, Repeatability, and Independence,
- no method prompt or opening rescue may be used to satisfy the exit contract.

Progression target: Controlled Discomfort / Low.

### 10.3 Controlled Discomfort

Dimensions:

- `difficulty.initial_response`
- `difficulty.first_step_control`
- `difficulty.tolerance`
- `difficulty.rescue_dependence`

Training sets:

- Controlled Entry
- No Rescue
- Repeat Exposure

High coverage:

- all four dimensions represented,
- Tolerance has at least two valid difficult opportunities,
- No Rescue includes a genuine stuck or challenge moment,
- Repeat Exposure includes at least two comparable difficult opportunities,
- no phase-critical dimension ends in unresolved breakdown.

High Maintenance entry:

- all four dimensions resolve to `SUPPORTED`,
- Initial Response and First-Step Control include supported evidence under difficulty,
- Tolerance includes at least two supported difficult opportunities,
- Rescue Dependence includes supported low-rescue behavior in No Rescue and Repeat Exposure,
- the final Repeat Exposure opportunity contains no breakdown or conditional evidence in a phase-critical dimension.

Exit confirmation:

- must occur in a later submitted session,
- Repeat Exposure is the designated exit context,
- at least two repeated difficult opportunities support controlled entry, first-step control, tolerance/recovery, and low rescue dependence,
- a first-step intervention may not satisfy independent First-Step Control, even if later dimensions remain eligible.

Progression target: Time Pressure Stability / Low.

### 10.4 Time Pressure Stability

Dimensions:

- `time.start`
- `time.structure`
- `time.pace`
- `time.completion_integrity`

Training sets:

- Structure Under Timer
- Repeated Timed Execution
- Full Constraint

High coverage:

- all four dimensions represented under a real timer,
- Structure and Completion Integrity each have at least two valid timed opportunities,
- Repeated Timed Execution contains at least two comparable timed attempts,
- Full Constraint is represented,
- no phase-critical dimension ends in unresolved breakdown.

High Maintenance entry:

- all four dimensions resolve to `SUPPORTED`,
- Start and Pace each have supported evidence in repeated timed work,
- Structure and Completion Integrity each have at least two supported timed occurrences,
- Full Constraint contains supported structure and completion,
- the final Full Constraint opportunity contains no breakdown or conditional evidence in a phase-critical dimension.

Final-phase confirmation:

- must occur in a later submitted session,
- Full Constraint is the designated confirmation context,
- all four dimensions resolve to `SUPPORTED`,
- Structure and Completion Integrity each have at least two supported valid timed occurrences,
- no timer relaxation or material support may satisfy the confirmation contract.

Outcome: remain Time Pressure Stability / High Maintenance and enter maintenance-transfer mode.

## 11. High Maintenance meaning

High Maintenance means:

> The phase-defining capability has already been established as High and has now repeated strongly enough in a later qualifying session to enter the progression-confirmation gate.

It does not mean:

- 85 or more,
- generally good work,
- a percentage band,
- perfect arithmetic accuracy,
- or a Specialist judgment.

The next session must still confirm the exit contract before a phase can progress.

## 12. Prerequisite contradiction and targeted re-diagnosis

Ordinary training never directly regresses a topic to an earlier phase.

If current-phase behavior suggests that an earlier prerequisite may no longer be trustworthy, the correct outcome is:

`POSSIBLE_PREREQUISITE_CONTRADICTION -> targeted evidence-native re-diagnosis`

Examples:

- Structured Execution behavior suggests the student may no longer recognize the method.
- Controlled Discomfort behavior suggests the student cannot execute the known method even after difficulty is removed.
- Time Pressure behavior suggests the structure also fails when the timer is removed.

Current same-phase training fields cannot always distinguish a genuine earlier-layer loss from a current-layer breakdown.

Therefore a prerequisite contradiction is a re-diagnosis trigger, not an automatic backward phase decision.

The targeted diagnosis engine owns the final reclassification.

## 13. Scores after this contract

Existing rep, set, and session scores may remain temporarily for:

- historical compatibility,
- analytics,
- charts,
- comparison during shadow validation,
- and legacy Response Snapshot surfaces.

They are non-authoritative.

Specifically, a score may not independently:

- advance Low to Medium,
- advance Medium to High,
- mint High Maintenance,
- progress a phase,
- cause a stability regression,
- clear an unresolved dimension,
- override a breakdown,
- or authorize a parent-facing capability claim.

## 14. Response Snapshot

Response Snapshot should evolve from score explanation into evidence explanation.

The durable source is already the exact evidence occurrence:

- set
- rep
- dimension
- selected raw behavior
- normalized evidence semantics
- constraint profile
- state before and after
- source drill identity

Ordered patterns remain useful because recovery, deterioration, and repeatability are temporally meaningful.

The future snapshot should preserve patterns such as:

- breakdown -> support -> support = recovered and held
- support -> breakdown -> support = capability present but unstable
- support -> support -> support = repeatable support
- support -> support -> breakdown = late deterioration

Pattern meaning must be derived from behavior, not from numeric averages.

## 15. Reporting authority

Parent reporting may describe:

- what was trained,
- what concrete behavior was observed,
- which behavior changed across valid evidence,
- the current verified phase and stability,
- the next system-directed move.

A report may say a capability became stronger only when the evidence lineage supports that claim across the report window.

Diagnosis-only evidence may establish a baseline but must not be described as training improvement.

Future report claim authorization should reason over evidence occurrences and constraint context rather than broad score bands.

## 16. Migration sequence

The safe migration order is:

1. Lock this contract.
2. Encode the phase evidence contract in shared code.
3. Build a training evidence evaluator that reads existing versioned drill evidence without changing live state.
4. Persist its result beside the current score-driven result as shadow output.
5. Replay sandbox and proof drills and compare score authority against evidence authority.
6. Add explicit support-aware evidence eligibility where current capture is insufficient.
7. Define and validate High Maintenance entry and exit evidence in the live UI.
8. Add prerequisite contradiction detection and targeted re-diagnosis routing.
9. Cut state authority over from score to evidence only after proof.
10. Migrate Response Snapshot and reporting claim authority.
11. Retain numeric scores only where they remain useful as non-authoritative analytics.

## 17. Acceptance tests for the future engine

The evidence-native training engine must prove at least these cases:

1. One early breakdown followed by clean recovery does not automatically make the phase Low.
2. Repeated breakdown in a phase-critical dimension cannot be averaged away by strong unrelated dimensions.
3. A 98/100 compatibility score cannot mint High Maintenance if a phase-critical behavior remains unresolved.
4. Not-observed and confounded evidence cannot count as weak evidence.
5. Supported evidence collected after invalid assistance cannot prove an independent dimension that the assistance supplied.
6. Low or Medium may move directly to High when the full High evidence contract is genuinely satisfied.
7. High cannot become High Maintenance from score alone.
8. High Maintenance cannot progress without a later exit-confirmation session.
9. Final-phase High Maintenance remains in Time Pressure Stability after successful confirmation.
10. A current-phase breakdown never directly forces a previous phase.
11. A prerequisite contradiction routes to targeted re-diagnosis.
12. Every state movement can return the exact evidence occurrences that authorized it.
13. Reports cannot claim training improvement from diagnosis-only evidence.
14. Existing legacy score fields can be present while having zero decision authority.

## 18. System statement

The intended operating principle is:

> Training creates the exposure. Behavior supplies the evidence. The system decides the state.

And the stability ladder means:

> Low = a phase-defining behavior is breaking.
>
> Medium = the capability exists but is conditional or incompletely evidenced.
>
> High = the capability is substantially present under the phase's training conditions.
>
> High Maintenance = High has repeated in a later qualifying session and the topic is now awaiting exit confirmation.
>
> Phase progression = a later High Maintenance confirmation proves the phase remains supported under its exit conditions.


## 19. Shadow proof dataset

Every new versioned training drill produces an immutable comparison row containing:

- the legacy compatibility score and transition;
- the evidence-native observed stability and predicted transition;
- whether phase/stability state paths diverged (`diverged` / `stateDiverged`);
- whether transition-reason labels diverged separately (`reasonDiverged`);
- High Maintenance entry qualification;
- exit qualification;
- intervention events;
- ineligible evidence count;
- the evaluator version and contract version;
- the complete shadow evaluation payload.

The dataset is proof-only and protected by RLS with no direct client policies. It cannot authorize live topic state.

Comparison contract version 2 defines `diverged` as a phase/stability state disagreement only. A reason-label mismatch without a state disagreement is preserved as `reasonDiverged = true` and does not make `diverged` true.

A new evaluator or contract version must create a new comparison identity rather than rewriting prior proof. Historical comparisons are evidence about a particular engine version and remain immutable.

### Authority-cutover evidence

No single divergence rate is sufficient to authorize cutover.

Before evidence becomes live authority, the proof set must demonstrate:

- representation across all four phases;
- representation across Low, Medium, High, and High Maintenance histories;
- recovery, deterioration, support/intervention, not-observed, and confounded cases;
- stable replay results for the same evaluator/contract version;
- every divergence classified as either a legacy-score failure, evidence-engine defect, capture insufficiency, or an intentionally conservative difference;
- no unexplained state movement;
- exact source evidence for every evidence-native transition;
- parent/report claims remaining downstream of the same evidence authority.

Until those conditions are met, the comparison dataset is observational only.
