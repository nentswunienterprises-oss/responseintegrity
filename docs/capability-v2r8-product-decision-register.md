# Capability V2R8 Product Decision Register

Status: active during manual human authoring and pre-freeze review
Scope: proof/capability-engine-shadow-validation only

## Purpose

This register captures every question raised during Capability V2R8 human review that requires a doctrine, product, evidence-contract, or workflow decision before the affected bank is frozen.

It does not contain the private assessment corpus. Question numbers are included only as review references.

The rule for the final pre-freeze sweep is simple: no question that exposed a real product ambiguity is allowed to disappear just because the assessment wording was approved.

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

Assessment review references: Controlled Discomfort 6, 12, 13, 30.

## Open product decisions to resolve before final freeze

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

## Final sweep rule

Before any V2R8 bank is frozen/imported:

1. Review this register against all human-review annotations and approved questions.
2. Resolve every item that changes product meaning, evidence validity, drill conditions, or Specialist authority.
3. Update canonical implementation documentation, live Deep Dives, code/contracts, and tests together where the decision affects them.
4. Do not rewrite historical evidence contracts in place when a versioned change is required.
5. Only then complete the bank's final source, coverage, duplicate, and answer-position audit.
