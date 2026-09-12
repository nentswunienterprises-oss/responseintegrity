# Capability Engine Sprint 15 - Oral Integrity Defense V2

## Objective

Make the targeted Oral Integrity Defense repeatable and auditable without turning it into another full examination or giving the reviewer a free-form integrity-escalation switch.

Sprint 15 remains branch-only and shadow/advisory. It does not change the authority of the existing Sandbox Mock Readiness Gate.

## Core decision

Criticality belongs to the issued Oral Defense standard, not to a reviewer checkbox.

The reviewer records only observable evidence:

- the fictional scenario used;
- what the Specialist actually reasoned, preserved, changed, or proposed;
- Clear / Partial / Fail.

The system derives the outcome from the frozen issued rubric.

## Deterministic outcome rule

- all issued probes Clear -> `approved`
- any Partial or ordinary Fail -> `repeat_required`
- any Fail on an issued integrity-critical probe -> `integrity_review`

There is no reviewer-selectable `integrityConcern` field and no reviewer-selectable final outcome.

## Oral Defense V2

`ORAL_DEFENSE_VERSION = 2`.

The prior V1 decision cannot satisfy the current shadow readiness standard. Attempt numbers are selected inside the current defense version so an older V1 attempt number cannot outrank V2 evidence.

## Probe shape

Every issued probe carries a frozen observable rubric:

- observable standard;
- Clear anchor;
- Partial anchor;
- Fail anchor;
- `criticalOnFail`;
- criticality source;
- canonical critical-boundary lineage where applicable.

No probe defaults to Clear.

The defense remains bounded to 3-5 probes:

- three permanent integrity baselines;
- up to two evidence-targeted probes selected from stored assessment/practical risk.

## Permanent integrity baselines

### System authority

Tests whether the Specialist preserves evidence-based system authority when personal judgment would prefer a different state/progression decision.

Canonical lineage includes:

- `clarity.no_manual_progression`
- `topic_conditioning.no_manual_override`

### Evidence contamination

Tests whether materially assisted performance remains visibly assisted rather than being defended as independent capability.

Canonical lineage includes:

- `clarity.modeling_not_independent_evidence`
- `structured_execution.no_disguised_assistance`

### Discernment / escalation boundary

Tests whether an unfamiliar condition is contained, recorded and escalated instead of converted into invented Specialist authority.

Canonical lineage includes:

- `topic_conditioning.no_manual_override`
- `session_flow_control.no_manual_drill_override`

## Evidence-targeted probe criticality

A targeted risk probe is integrity-critical on Fail only when the stored evidence that elevated that focus contains a prior critical signal:

- a digital assessment critical fail; or
- a practical `integrity_review` outcome.

An ordinary historical miss or practical repeat can still target the defense, but it remains an ordinary capability probe. Failing it requires a repeat rather than automatically creating an integrity escalation.

Targeted probes are restricted to canonical RI competency identities. Unknown or stale competency identities fail brief generation rather than creating an improvised oral standard.

## Stale-brief protection

The issued `briefId` is now bound to:

- Specialist assignment;
- Oral Defense version;
- current-version attempt number;
- capability evidence fingerprint;
- issued probe identity/source;
- exact issued rubric contract.

A change in the evidence state or the Oral Defense standard makes an open brief stale and requires a fresh brief.

## Observation discipline

Oral Defense anchors are calibrated against observable behavior and reasoning only.

Reviewer guidance must not infer motive, intent, honesty, character or psychology from the response. An integrity-critical Fail means the observed action crosses a protected RI boundary. It is not an accusation about why the Specialist crossed it.

## API boundary

The completion API accepts only:

- `briefId`
- `defenseVersion`
- `attemptNumber`
- 3-5 strict probe observations
  - `focusKey`
  - `deepDiveKey`
  - `scenarioSummary`
  - `observedResponseSummary`
  - `judgment`
- reviewer feedback
- explicit sandbox-only confirmation

The schemas are strict. `integrityConcern`, `outcome` and other undeclared reviewer controls are rejected.

The server re-creates the current brief and independently derives the outcome.

## Remediation

Any non-approved defense requires at least 20 characters of actionable reviewer feedback. Approved defenses may omit the summary.

## Immutable evidence

The existing immutable Oral Defense row continues to preserve:

- frozen brief snapshot;
- exact probe observations;
- counts;
- derived outcome;
- reviewer identity/role;
- sandbox-only confirmation;
- completion timestamp.

V1 used the database column `integrity_concern_count` for the reviewer-selected concern count. V2 has no reviewer-selected integrity flag. For backward-compatible storage, the runtime places the **system-derived V2 critical-Fail count** into that existing numeric slot.

The additive Sprint 15 migration introduces a generated semantic column, `critical_fail_count`:

- V2+ rows project the derived count from the compatibility slot;
- V1 rows expose `NULL` in the new semantic column;
- V1 history is not rewritten;
- no trigger or second mutable write path is introduced.

The migration is branch-only and has not been applied to any database.

## Authority boundary

Sprint 15 cannot:

- pass or alter the human Sandbox Mock Readiness Gate;
- open Trial;
- certify a Specialist;
- change `operational_mode`;
- change student state;
- override Battle Test progression.

The capability readiness signal remains `authoritative: false`.

## Compatibility

The foundation-selector tests still contain V1 examples intentionally because they verify generic version-selection behavior and historical Sprint 1-7 compatibility. Current product readiness imports `ORAL_DEFENSE_VERSION` and therefore requires V2.

## Verification contract

Focused tests now cover:

- deterministic approval/repeat/integrity outcomes;
- ordinary Fail vs critical Fail;
- historical critical-signal targeting;
- canonical capability identity validation;
- 3-5 probe bounds;
- duplicate/mismatched/weak probe evidence rejection;
- rubric-bound brief identity;
- evidence-change stale-brief behavior;
- no reviewer-selected integrity/outcome fields;
- current-version Oral Defense selection;
- no default Clear;
- observable-not-motive calibration;
- actionable non-approved feedback;
- generated V2 critical-Fail storage lineage without rewriting V1 history;
- immutable/sandbox-only evidence;
- non-authoritative authority boundary.

Capability Engine CI includes root operational capability boundary tests as well as tutor boundary tests.

GitHub Actions has repeatedly failed before runner allocation with zero executed steps on this stack. A red workflow under that condition is not treated as a code-level test verdict.

## Deployment state

- no merge to `main`
- no Supabase write
- no migration applied
- no production deployment
