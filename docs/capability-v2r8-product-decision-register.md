# Capability V2R8 Product Decision Register

Status: active during manual human authoring and pre-freeze review
Scope: proof/capability-engine-shadow-validation only

## Purpose

This register captures every question raised during Capability V2R8 human review that requires a doctrine, product, evidence-contract, or workflow decision before the affected bank is frozen.

It does not contain the private assessment corpus. Question numbers are included only as review references.

The rule for the final pre-freeze sweep is simple: no question that exposed a real product ambiguity is allowed to disappear just because the assessment wording was approved.

## Human review checkpoint

The four transformation-phase mastery banks have completed manual item-level human review:

- Clarity: 45/45 approved
- Structured Execution: 45/45 approved
- Controlled Discomfort: 45/45 approved
- Time Pressure Stability: 45/45 approved

Time Pressure Stability items 41-44 were replaced after review exposed product assumptions that were not implemented. The replacements were approved. The original TPS item 38 was also withdrawn because it assumed timer-failure workflow infrastructure that did not exist; its replacement tests the implemented no-support boundary instead and was approved.

Human approval does not freeze these banks. Product decisions and implementation gaps below must be resolved first, followed by source, coverage, duplicate, critical-boundary, and answer-position audits.

## Resolved doctrine and product decisions

### High Maintenance is a real state inside the current phase

Resolved and synchronized in the proof branch.

- High + qualifying evidence moves to High Maintenance in the same phase.
- High Maintenance must run its own current-phase High Maintenance drill/check.
- Only qualifying evidence produced while already in High Maintenance can progress to the next phase at Low.
- Time Pressure Stability remains the final phase.

### Later phases inherit earlier capability

Resolved and synchronized in the canonical source and live Deep Dives.

- Clarity establishes the usable mental map: Vocabulary, Method, Reason, and the required step sequence.
- Structured Execution inherits that mental map and adds independent, ordered, repeatable execution.
- Controlled Discomfort inherits both and adds meaningful difficulty and uncertainty.
- Time Pressure Stability inherits all earlier layers and adds urgency.
- When an error appears, locate the earliest layer that visibly broke.
- A wrong final answer alone does not prove the mental map or response broke; an isolated local calculation error can change the answer while Vocabulary, Method, Reason, structure, and response remain intact.
- Strong later-phase behavior cannot excuse a visible break in an inherited layer.
- Specialists record the evidence; they do not manually move the topic between phases.

### Controlled Discomfort support semantics

Resolved doctrine. Product implementation follow-up remains before freeze.

- Support levels are ceilings, not scripts.
- Every rep begins without support.
- `minimal` in Controlled Entry means response-control cueing only when needed, for example: pause, do not rush, identify your first controlled action.
- `minimal` does not permit supplying a method, mathematical step, correction, correctness confirmation, or directional mathematical hint.
- `first_step_only` is the maximum permitted recovery scaffold in the relevant condition. It does not mean the Specialist automatically gives the student the first step.
- If first-step mathematical assistance is actually used, the evidence cannot be described as independent through that point.
- A supported recovery can still be legitimate training evidence under the condition that was actually run, but it cannot be silently upgraded into no-support evidence.
- Repeat Exposure remains strictly no-support.
- This explains why Structured Execution can be stricter: Structured Execution proves ownership of the known method without help; Controlled Discomfort conditions that already-established response against difficulty and may temporarily permit a bounded response/recovery scaffold before returning to no-support verification.

Assessment review references: Controlled Discomfort 6, 12, 13, 30; Time Pressure Stability revised item 38.

### Time Pressure Stability isolates the time condition

Resolved and synchronized in the proof branch.

- TPS does not increase mathematical difficulty while introducing time pressure.
- TPS training keeps `difficultyLevel: normal`, `variationLevel: same_form`, and `supportLevel: none` across Structure Under Timer, Repeated Timed Execution, and Full Constraint.
- What changes across the sequence is the time-pressure condition: light timer -> repeated timer -> full constraint.
- A Specialist may not make the mathematics harder or change the problem form simply because the student looks strong.
- The live Deep Dive now states the fixed condition directly: normal difficulty, same form, no support; timing is the only pressure variable that changes.

Assessment review reference: Time Pressure Stability 4.

### Reporting is deterministic, not Specialist-authored

Resolved live-product rule.

- Specialists capture observable drill evidence; they do not manually write the parent-facing performance conclusion.
- Response Snapshot and downstream report language are generated deterministically from the stored evidence and state movement.
- Capability questions must therefore test evidence integrity and downstream consequence, not a fictional manual report-writing workflow.

Time Pressure Stability review item 42 was rejected in its original form because it described the Specialist writing a session-summary claim manually. The replacement tests upstream evidence integrity instead and was approved.

### Topic states remain topic-specific

Resolved core-model rule; derivative next-action/reporting wording still needs synchronization below.

- Each mathematical topic has its own phase and stability state.
- A new topic receives its own state from its own diagnosis/activation evidence.
- One topic reaching Time Pressure Stability / High Maintenance does not assign, transfer, or imply the same phase or stability for another topic.

Time Pressure Stability review item 43 was rejected in its original form and replaced with this topic-specific-state boundary. The replacement was approved.

### Permitted support and actual support are separate evidence facts

Approved product contract. Implementation requires a new versioned evidence contract before freeze.

- `supportLevel` remains the set-level ceiling: the maximum support permitted by the assigned condition.
- Actual Specialist support is captured separately as a rep-level source fact.
- The rep-level `actualSupportUsed` values are:
  - `none`
  - `response_control_cue`
  - `first_step_math_support`
  - `beyond_permitted_boundary`
- The system deterministically compares the support ceiling with the actual support used.
- Support that remains inside the permitted ceiling can still produce legitimate evidence, but downstream language must reflect the support that actually occurred.
- A recovery after first-step mathematical support cannot be described as independent through that intervention point.
- Support that exceeds the permitted ceiling contaminates the evidence condition. It must not be disguised as weak student performance.
- The student's subsequent observable behaviour remains part of the historical record, but a contaminated rep cannot count as clean proof of the assigned condition.
- `actualSupportUsed` is stored once per rep as the source fact. Evidence-ledger projection may carry that rep-level fact alongside projected dimension rows for lineage, but it must not create four independent support facts merely because a rep has four scored fields.
- The published V1 evidence contract remains immutable. This change must be introduced through a deliberate versioned schema/contract with compatibility and migration decisions.

A V2 type contract now exists in `shared/responseIntegrityEvidenceContractV2.ts`; runtime capture and persistence still need to be wired before freeze.

Assessment review references: Controlled Discomfort support review; Time Pressure Stability revised item 38.

### Submitted evidence is immutable and corrected by supersession

Approved product contract. Implementation requires an auditable correction workflow before freeze.

- Before final submission, the Specialist may edit the current capture normally.
- After submission, the evidence record is historical and must not be silently edited or deleted.
- A Specialist who discovers an inaccurate submission raises an Evidence Correction against the exact submitted drill, set, rep, and affected observation.
- The correction preserves the original value and records the proposed corrected value, a structured reason, who raised it, and when.
- The Specialist may initiate correction of their own submitted evidence but may not approve their own post-submission correction.
- The assigned TD is the normal approval authority. COO is the escalation or fallback authority for exceptional cases.
- When a correction is approved, the system appends a superseding correction event. The original evidence remains visible for audit but is superseded for active interpretation.
- The system replays the affected topic lineage deterministically from immediately before the corrected submission: corrected evidence -> recomputed transition -> every later valid topic event in chronological order -> newly derived current state.
- The Specialist never chooses the replacement phase or stability.
- Dependent deterministic outputs such as Response Snapshot or parent/reporting artifacts are not manually rewritten. Their prior lineage is marked superseded where applicable and the output is regenerated from the corrected evidence chain.
- There must be no product path that deletes a submitted drill or quietly edits submitted evidence in place.

Assessment review reference: Clarity item 20.

### Topic Reference is preparation, not an in-rep evidence aid

Approved product contract. Runner and doctrine synchronization are required before freeze.

- Topic Reference is a teaching and preparation artifact built from Vocabulary, Method, Steps, and Reason.
- During Modeling, the Specialist and student may use the Topic Reference freely. Modeling is preparation, not scored evidence.
- Before or between scored reps, the Specialist may consult it and the student may review it as teaching once the previous rep is closed and before a fresh rep starts.
- During every currently defined scored rep, the student does not consult the Topic Reference. This applies to Identification, Light Apply, Structured Execution, Controlled Discomfort, and Time Pressure Stability.
- A Specialist may privately consult the Topic Reference for fidelity during a rep, but may not convert its contents into a hint, method reminder, mathematical step, correctness confirmation, or redirection for the student.
- If the student asks to see the Topic Reference during a scored rep, the Specialist does not expose it. The request itself may remain useful observed evidence.
- Specialist redirection to the Topic Reference, or exposing its contents as assistance during a scored rep, contaminates that rep. Closing the reference afterward does not restore the same rep.
- A later fresh rep can still produce legitimate evidence after teaching between reps, provided the reference is closed and the assigned support condition is restored before that rep begins.
- `minimal` support does not implicitly permit Topic Reference consultation. If a future scored condition permits reference use, that permission must be represented explicitly in the drill contract rather than inferred from `minimal`.
- The runner should lock or collapse Topic Reference while a scored rep is active and communicate that it is available between reps but unavailable during scored evidence.

Assessment review references: Clarity items 3, 34, and 42.

### `minimal` is response-control cueing only

Approved global support-semantics contract. Clarity Deep Dive and runner wording require synchronization before freeze.

- `minimal` has one meaning across the product: it permits bounded response-control cueing only and never mathematical content.
- Neutral task-launch instructions such as `Solve this and show me your steps` are part of running the rep and do not count as support.
- Once a scored rep is underway, an allowed `minimal` cue may regulate or re-engage the student without supplying mathematics, for example: `Pause`, `Don't rush`, `Use your own first step`, or `Show me what you would do next`.
- `minimal` does not permit naming the method or operation, identifying the relevant mathematical feature, giving or suggesting a step, correcting a mathematical error, confirming correctness, using a leading mathematical question, showing a worked example, or exposing/redirecting to the Topic Reference.
- First-step mathematical assistance exceeds a `minimal` ceiling even if the student completes the rest independently.
- Exceeding the ceiling contaminates the rep; it must not be converted into weak student performance.
- The live wording `minimal guidance` is too loose. Specialist-facing surfaces should state the ceiling explicitly: response-control cue only; no mathematical hints, steps, corrections, or correctness confirmation.
- This global meaning aligns Clarity Light Apply with the approved Controlled Discomfort support taxonomy and the new `actualSupportUsed` evidence contract.

Assessment review reference: Clarity Light Apply review.

### Inherited-layer evidence is supplemental and progression-gating

Approved product contract. Implementation requires the new versioned evidence contract and deterministic verification routing before freeze.

- Later-phase reps may capture supplemental inherited-layer observations when an earlier capability is visibly tested by the active condition.
- Supplemental inherited evidence is stored at rep level separately from the current phase's scored dimensions.
- It reuses canonical earlier-phase dimension identities such as `clarity.method`, `execution.independence`, `execution.step_discipline`, or `difficulty.rescue_dependence` rather than inventing a second taxonomy.
- `actualSupportUsed` and inherited student behavior remain separate facts. A Specialist may preserve a no-support condition while the student still shows rescue-seeking or another inherited-layer weakness.
- Supplemental inherited evidence does not alter or get silently weighted into the current phase's numeric score.
- A material inherited-layer break cannot be ignored merely because the current-phase score is strong.
- A material inherited-layer break blocks advancement / High-Maintenance qualification from that evidence and requires RI-OS to route deterministic earlier-layer verification.
- The triggering later-phase rep remains part of the evidence history; the inherited signal is not forced into an unrelated current-phase field.
- The Specialist records the observable inherited-layer evidence but never manually rephases the topic.

Assessment review reference: Time Pressure Stability item 24 and the inherited-layer review.

### Inherited-layer verification uses a hold before any cross-phase regression

Approved product contract. Implementation requires a deterministic verification-hold state/flag and cross-phase consequence routing before freeze.

- A material inherited-layer break does not immediately regress the topic to an earlier phase.
- RI-OS creates an `inherited_verification_required` hold targeting the earliest visibly broken earlier layer. This is a workflow hold, not a fifth stability state.
- The triggering current-phase drill is still processed conservatively: a downward stability result may apply and a `remain` result remains, but any positive movement is withheld while inherited verification is unresolved.
- RI-OS runs the existing verification mode at the suspected earlier phase to test whether that capability still holds in its native condition.
- Verification `60-100` clears the inherited hold with no cross-phase regression. The topic returns to its current phase at the current-phase stability that survived the triggering drill, and a fresh current-phase rep is required before any upward movement can occur. The earlier positive movement is not restored retroactively.
- Verification `40-59` confirms that the earlier capability has weakened enough to require regression. The topic moves to that earlier phase at `High` so the previously established capability is rebuilt toward High Maintenance rather than treated as a brand-new Low state.
- Verification `0-39` is too weak for a simple maintenance regression. RI-OS starts targeted adaptive re-diagnosis beginning at that earlier phase, and adaptive diagnosis determines whether the topic belongs there or must step farther backward.
- A strong earlier-phase verification can show that the earlier capability still exists in its native condition even though it broke under the later condition. In that case, the topic remains in the later phase and resumes training there.
- Specialists record the evidence and run the directed verification; they never choose the regression destination or restore withheld progression manually.

Approved example: a Controlled Discomfort / High Maintenance topic that scores strongly but shows repeated rescue-seeking is held for Structured Execution verification. Strong Structured Execution verification keeps the topic in Controlled Discomfort and requires fresh Controlled Discomfort evidence; middling verification regresses the topic to Structured Execution / High; very weak verification starts targeted adaptive re-diagnosis from Structured Execution.

### TPS timer contract is prepared before TPS and remains fixed for the TPS epoch

Approved product contract and runtime implementation completed on the proof branch. The pure Timer Contract V1, deterministic tests, V2 timing evidence, server routes, Specialist runner countdown/calibration flow, append-only persistence schema, and proof-database migration are now wired together.

- RI-OS begins passively recording elapsed time on scored training reps in Structured Execution and continues measuring reps through Controlled Discomfort. Passive measurement is not time pressure because the student is never shown a countdown, deadline, or time target in those phases.
- Clarity is not part of the Timer Contract V1 baseline dataset. Recognition and mental-map formation are not comparable execution-time conditions.
- Controlled Discomfort timing is retained as useful longitudinal evidence, but it is not Timer Contract V1 baseline evidence because the phase deliberately adds difficulty/uncertainty. Using those durations would mix mathematical difficulty with the time variable TPS is meant to isolate.
- A TPS historical baseline therefore uses the latest three eligible Structured Execution reps for the same student and topic.
- An eligible Structured Execution baseline rep must be `pressureLevel: none`, `variationLevel: same_form`, `difficultyLevel: normal`, `actualSupportUsed: none`, technically valid, and a structurally valid completion.
- The baseline is the median elapsed duration of those three reps, rounded to whole seconds.
- The normal path is that the contract is already derivable before TPS entry. When Controlled Discomfort is ready to progress into TPS, RI-OS checks for a valid Timer Contract before activating TPS Low.
- If three eligible historical Structured Execution reps do not exist, the transition into TPS is held and RI-OS runs a three-rep **pre-TPS calibration** under normal difficulty, same form, no support, and no visible countdown. Calibration is non-scored, cannot change phase or stability, and is not itself a TPS rep.
- TPS is activated only after a valid Timer Contract exists. There is no normal flow in which the topic first enters TPS and then runs untimed baseline reps.
- Timer Contract V1 assigns Structure Under Timer to `100%` of baseline, Repeated Timed Execution to the same `100%` baseline duration on every rep, and Full Constraint to `85%` of baseline.
- The `85%` Full Constraint factor is a versioned V1 constant. Specialists cannot change it.
- A Timer Contract is minted once for a student/topic TPS conditioning epoch and remains immutable throughout that epoch, across sessions, TPS stability changes, High Maintenance, and legitimate Specialist handovers.
- New untimed evidence does not silently recalculate an active Timer Contract.
- Leaving TPS and later earning re-entry, or an explicit system-owned re-diagnosis/reset that starts a new conditioning lineage, creates a new TPS epoch and a new contract from then-current eligible evidence or pre-TPS calibration.
- If an approved evidence correction later invalidates baseline lineage used by an active contract, the original contract remains historical but is superseded. TPS progression is held, RI-OS reconstructs a valid contract from eligible evidence or calibration, and fresh TPS evidence is required. Prior timed attempts remain factual history but cannot continue authorizing progression from a condition later proven invalid.
- High Maintenance does not continually tighten or re-baseline the timer. Any future progressive re-baselining would require an explicit later Timer Contract version.
- The runner is the sole timer authority once TPS begins. Specialists do not choose a duration or substitute a phone timer or stopwatch.
- Each timed rep must persist the timer-contract version, baseline duration, prescribed duration, actual elapsed duration, start/end timestamps, whether completion occurred before expiry, pressure level, baseline source, and technical validity.
- A technical timer failure is `timing_invalid_technical`: it remains in history, is not student weakness, does not score or move state, is never manually estimated, and requires a linked replacement rep under the same timer contract.
- Scored TPS cannot start without a valid timer contract. There is no Specialist fallback duration.
- TPS keeps mathematics at normal difficulty, same form, and no support. Time is the controlled variable.

Implementation note: passive timings may accumulate even when a rep is not baseline-eligible. Eligibility is determined from the complete condition and actual support used, not from elapsed time alone.

Assessment review references: Time Pressure Stability 4, original 38, original 41, and original 44; subsequent product-decision review.

## Open product decisions and implementation gaps to resolve before final freeze

### TPS timer runtime wiring remains before TPS freeze

The timer formula and baseline timing semantics are no longer product ambiguities, but the live runner and server do not yet execute the whole contract. Before TPS freezes:

- the runner must passively time scored Structured Execution and Controlled Discomfort reps without displaying time pressure to the student; Clarity must not contribute Timer Contract V1 baseline data
- V2 rep evidence must capture `actualSupportUsed`, timing metadata, and inherited evidence without rewriting the published V1 contract
- timing records must persist in the authoritative drill evidence lineage
- the server must retain pre-TPS timing history while selecting only the latest three eligible comparable Structured Execution reps for the V1 baseline
- the Controlled Discomfort -> TPS transition must refuse TPS activation until a valid Timer Contract exists
- the fallback calibration lane must run before TPS activation when historical eligibility is insufficient, remain non-scored, and mint the contract before TPS Low begins
- the persisted contract must carry conditioning-epoch lineage so it remains immutable across sessions, stability movement, High Maintenance, and handovers, while allowing an explicit new epoch after TPS exit/re-entry or system-owned reset
- evidence-correction replay must be able to supersede a contract whose baseline lineage becomes invalid and require reconstructed timing plus fresh TPS evidence
- TPS runner UI must load the Timer Contract, display and run the prescribed countdown, and prevent Specialist duration edits
- Repeated Timed Execution must preserve the exact same prescribed duration across its reps
- Full Constraint must use the versioned 85% duration
- technical timer failures must persist as invalid attempts and generate linked replacement reps without student scoring or state movement
- a missing or invalid Timer Contract must lock scored TPS rather than inviting a Specialist fallback

The pure deterministic contract and automated tests are already implemented; this section tracks runtime wiring, not an unresolved timer policy.

### TPS final-state next action must not imply cross-topic phase transfer

Raised during Time Pressure Stability review item 43.

The core model is topic-specific: each topic has its own phase and stability, and a new topic gets its own state from its own diagnosis/activation evidence. A topic reaching Time Pressure Stability / High Maintenance does not transfer that phase or stability to a different topic.

Current next-action and parent-copy language still includes phrases such as `Begin cross-topic conditioning`, `Prepare for transfer to new topics`, and `expanding transfer across related topics`. That wording is inconsistent with the topic-specific state model unless a separate cross-topic capability product is deliberately designed later.

Before freeze, synchronize this language so that:

- the mastered topic remains in its own TPS maintenance state
- any newly activated topic gets its own independent state from its own evidence
- no phase or stability is inherited merely because another topic reached TPS High Maintenance

The replacement TPS item 43 tests this topic-specific-state boundary and was approved.

## Final sweep rule

Before any V2R8 bank is frozen/imported:

1. Review this register against all human-review annotations and approved questions.
2. Resolve every item that changes product meaning, evidence validity, drill conditions, or Specialist authority.
3. Update canonical implementation documentation, live Deep Dives, code/contracts, and tests together where the decision affects them.
4. Do not rewrite historical evidence contracts in place when a versioned change is required.
5. Only then complete the bank's final source, coverage, duplicate, and answer-position audit.
