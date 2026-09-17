# Capability Engine Sprint 6

Status: shadow implementation only. Stacked on `feat/capability-engine-sprint-5`.

This sprint adds the scarce human-verification layer and a non-authoritative readiness calculation. It does not change existing Battle Test progression, Sandbox Mock Gate authority, Trial, certification status, or Specialist operational mode.

## Implemented

### Shadow readiness gate

`FOUNDATION_CAPABILITY_SHADOW_GATE_V1` requires the current evidence stack:

- Clarity mastery
- delayed Clarity retrieval
- Structured Execution mastery
- Clarity + Structured Execution interleaved transfer
- Prepare practical approved
- Execute practical approved
- Evidence practical approved
- Oral Integrity Defense approved

Readiness returns `READY` or `NOT_READY` plus exact machine-readable missing requirement codes. `authoritative` is hard-coded `false`.

Server readiness is version-sensitive:

- only the latest assessment attempt can satisfy a requirement
- the latest assessment must belong to the currently active private bank version
- only the latest practical attempt can satisfy a practical requirement
- the practical must use the current practical definition version
- only the latest Oral Integrity Defense can satisfy the oral requirement
- the oral defense must use the current defense version

A stale historical pass therefore cannot silently keep a Specialist ready after newer evidence or a version change.

### Targeted Oral Integrity Defense

Human review opens only after every non-oral shadow requirement is satisfied. The candidate queue therefore reserves reviewer time for Specialists whose automated and practical evidence is already complete.

Each defense contains 3-5 probes:

- three integrity baselines covering system authority, evidence contamination, and escalation boundaries
- up to two additional evidence-risk probes
- historical critical-boundary misses and incorrect digital responses raise probe priority
- historical practical `repeat_required` or `integrity_review` decisions also raise linked competency priority
- known assessment items are not reused in the oral defense

The reviewer records the fictional scenario actually used, the Specialist response actually observed, an explicit `clear` / `partial` / `fail` judgment, and any integrity concern. No probe defaults to Clear.

Outcome is deterministic:

- all probes Clear and no integrity concern -> `approved`
- any Partial or Fail without integrity concern -> `repeat_required`
- any integrity concern -> `integrity_review`

Non-approved outcomes require actionable reviewer feedback.

### Evidence-state binding

An issued oral-defense brief contains a deterministic `briefId` derived from:

- Specialist assignment
- defense version
- oral attempt number
- an evidence fingerprint of assessment and practical history
- the issued probe set

If evidence changes after the reviewer opens the brief, completion fails closed and a fresh brief is required. The exact brief snapshot and completed probes are persisted with the immutable defense record.

### Access and privacy

- TD review access is limited by the existing `pods.td_id` relationship
- COO and HR are authorised review roles in this shadow V1
- oral probes must use fictional or sandbox scenarios
- real student, parent, or family data is not permitted
- Specialist-facing status exposes readiness, oral outcome, and reviewer feedback only
- assessment answer keys, option keys, explanations, and stored item wording are not exposed through the oral-review UI

### Human surfaces

- Specialist practical workspace now shows the complete shadow readiness stack and latest oral-defense feedback
- reviewer Oral Integrity Defense workspace lists only pre-oral-ready Specialists
- reviewer brief is generated from current evidence state
- every probe requires explicit judgment before submission
- the UI previews the deterministic outcome rather than allowing a discretionary outcome selection

## Explicitly not changed

Sprint 6 does not:

- update `tutor_assignments`
- change `certification_status`
- change `operational_mode`
- advance Sandbox Mock Gate state
- open Trial
- certify a Specialist
- replace existing Battle Test progression
- apply a production database migration
- deploy to production
- merge into `main`

## Verification state

Static branch review and boundary tests cover:

- current-version/latest-evidence readiness semantics
- exact missing requirement codes
- 3-5 oral probe bounds
- evidence-risk targeting without answer-key exposure
- historical practical-risk targeting
- stale brief/evidence-state rejection
- immutable oral-defense persistence
- sandbox-only oral evidence
- TD pod scope and reviewer role boundaries
- non-authoritative readiness
- Specialist status/feedback surface
- explicit reviewer judgments
- server and Vercel route registration

GitHub Actions remains unavailable as an executable signal. The latest Capability Engine CI job on this branch completed with zero executed steps, consistent with the existing runner-allocation failure. Therefore this sprint is not represented as CI-passed.

## Review boundary

Review Sprint 6 against `feat/capability-engine-sprint-5`, not against `main`.
