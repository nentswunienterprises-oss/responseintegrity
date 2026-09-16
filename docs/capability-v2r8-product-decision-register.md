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

Time Pressure Stability items 41-44 were replaced after review exposed product assumptions that were not implemented. The replacements were approved. The original TPS item 38 was also withdrawn because it assumed timer-failure workflow infrastructure that does not exist; its replacement tests the implemented no-support boundary instead and was approved.

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

Resolved doctrine. Product implementation follow-up remains open below.

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

Resolved doctrine. One live Deep Dive sentence still needs synchronization before freeze.

- TPS does not increase mathematical difficulty while introducing time pressure.
- TPS training keeps `difficultyLevel: normal`, `variationLevel: same_form`, and `supportLevel: none` across Structure Under Timer, Repeated Timed Execution, and Full Constraint.
- What changes across the sequence is the time-pressure condition: light timer -> repeated timer -> full constraint.
- A Specialist may not make the mathematics harder or change the problem form simply because the student looks strong.
- The current Deep Dive phrase `unless the system explicitly directs otherwise` is too loose for this contract and must be removed or rewritten to state the fixed standard clearly.

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

## Open product decisions and implementation gaps to resolve before final freeze

### Record support permitted separately from support actually used

Current evidence stores the set constraint profile, which tells us what support was permitted. That is not the same fact as what support the Specialist actually used on a rep.

The desired evidence distinction is conceptually:

- none used
- response-control cue used
- first-step mathematical support used
- support exceeded the permitted boundary

Do not mutate the published V1 evidence contract casually. If implemented, this should be handled as a deliberate versioned evidence/schema change with migration and compatibility decisions.

### Post-submission inaccurate evidence correction path

Raised during Clarity review item 20.

The doctrine is clear that inaccurate evidence makes resulting movement unreliable, but the authorised product workflow for correcting or escalating already-submitted inaccurate evidence still needs to be explicit before Clarity freezes.

### Topic Reference use during no-support or recognition conditions

Raised during Clarity review items 3, 34, and 42.

The product currently makes the persistent Topic Reference available during Clarity and later phases, while some sets have strict support conditions. Before freeze, define exactly when a Specialist may redirect a student to the Topic Reference, when the student may consult it independently, and when either action would contaminate the evidence condition.

### Exact boundary of `minimal` guidance in Clarity Light Apply

Raised during Clarity review.

Clarify the allowed response-control/instructional boundary so `minimal` cannot quietly become step-by-step mathematical support or hidden rescue.

### Preserve inherited-layer evidence when the current phase does not score that dimension directly

Raised during Time Pressure Stability review item 24.

TPS directly scores start under time, structure under time, pace control, and completion integrity. A student can nevertheless show a meaningful inherited-layer signal such as repeated rescue-seeking while the Specialist correctly preserves the no-support condition.

Before freeze, decide how the product should capture and surface an inherited-layer break that is operationally important but is not one of the current phase's direct scored fields. The product should preserve the distinction between:

- the Specialist gave no rescue, so the no-support condition remained valid
- the student repeatedly sought rescue, which is still meaningful evidence about inherited independence

Do not solve this by silently forcing rescue-seeking into an unrelated TPS field or by pretending it did not happen.

### TPS timer instruction and execution infrastructure is not implemented

Raised during Time Pressure Stability review items 38, 41, and 44.

The current versioned drill registry stores categorical pressure levels (`light_timer`, `repeated_timer`, `full_constraint`) but no timer duration, timer source, or timing formula. The current runner contains qualitative instructions such as `Solve under short timer`, `Same timer`, and `Tighter timer`, but it does not provide an authoritative expected duration or an implemented countdown/timer-control contract.

There is also no implemented authoritative pre-session timer field and no authorised workflow for a missing, contradictory, or failed timer instruction. Therefore Capability questions must not assess a Specialist against a workflow that does not exist.

Before TPS can freeze, decide and implement at least:

- where the timer duration comes from
- whether timing is generated per problem, per set, or from another deterministic input
- which surface is authoritative
- how the Specialist receives and runs the timer
- how the same-timer rule is preserved across Repeated Timed Execution
- what `full_constraint` means in measurable timing terms
- whether actual timer conditions are persisted with evidence
- what happens when the timer instruction is missing, contradictory, or technically fails

The original TPS item 38 and original items 41 and 44 were rejected rather than approved. Their approved replacements do not assume this missing infrastructure.

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
