# Capability Engine Sprint 9

## Status

Branch-only enforcement sprint.

- Branch: `feat/capability-engine-sprint-9`
- Base: `feat/capability-engine-sprint-8`
- Stacked diff at freeze: 34 commits ahead, 0 behind
- No main merge
- No production migration
- No production deployment
- No Supabase writes

## Objective

Make the Sprint 8 Capability MVP architecture enforceable rather than descriptive.

Sprint 9 adds two mechanical guarantees:

1. critical integrity boundaries cannot disappear from an issued assessment form;
2. Specialists cannot open assessments before the approved capability sequence says they are available.

The existing Battle Test, Sandbox Mock Gate, Trial, certification status and operational mode remain authoritative. Capability Engine remains shadow infrastructure.

## Critical-Boundary Architecture

The public capability blueprint defines the identity and meaning of each critical boundary. Live question content, options, answer keys and explanations remain private.

Private assessment items may carry `criticalBoundaryKeys`. Those keys identify which public integrity boundary the private item tests.

Boundary lineage flows through:

1. private JSON bank authoring;
2. blueprint/release validation;
3. private `critical_boundary_keys` storage;
4. runtime private-bank loading;
5. deterministic form selection.

Boundary lineage is deliberately omitted from the Specialist-safe public form and result projections.

## Form Coverage Rules

### Mastery

Every mastery form must include evidence for every declared critical boundary of that Deep Dive.

The generator reserves critical-boundary items first, then fills remaining competency quotas.

### Cumulative Retrieval and Transfer

Every cumulative retrieval or transfer form must include at least one critical-boundary scenario from every Deep Dive covered by that assessment.

The exact boundary chosen for a cumulative Deep Dive is deterministic per issued form seed, so forms can rotate while preserving the minimum boundary guarantee.

### Fail Closed

Generation fails if the private item pool cannot satisfy critical-boundary requirements and ordinary competency quotas at the same time.

Boundary coverage is not best effort.

## Critical-Fail Semantics

A boundary tag is not enough by itself.

For release-grade private banks:

- a boundary-tagged item must define at least one `criticalFailOptionKey`;
- the critical-fail option cannot also be a correct option;
- V1 boundary-tagged questions must use single-choice or multi-select semantics;
- sequence questions cannot carry option-based critical-fail semantics in V1 because a sequence response contains every option key and would make the current option-trigger model ambiguous.

The runtime form generator repeats these safety checks even if a malformed bank bypasses the import script.

## Private-Bank Release Standard

The Sprint 8 plan remains:

- mastery: 15-question issued form, minimum private pool target 30;
- cumulative retrieval/transfer: 20-question issued form, minimum private pool target 40;
- deterministic pass threshold: 96%;
- immutable bank versions.

Sprint 9 strengthens release validation.

### Mastery breadth

A release-grade mastery blueprint must sample every declared competency for that Deep Dive at least once in the issued form blueprint.

A large bank cannot pass release validation merely by containing many variants of one competency.

### Cumulative breadth

Each Deep Dive included in a cumulative retrieval/transfer assessment must contribute at least two distinct competencies to the form blueprint.

### Plan fidelity

For an assessment in the approved 16-event MVP plan, release validation also requires:

- evidence kind matches the plan;
- covered Deep Dives match the plan;
- form size matches the plan;
- pass threshold matches the plan;
- private pool meets the minimum item count;
- critical-boundary representation satisfies the plan.

The public design fixtures remain intentionally smaller non-production fixtures. They receive vocabulary validation but are not allowed to masquerade as release-grade private banks.

## Assessment Sequencing

`shared/capabilitySequencing.ts` defines four states:

- `unavailable`
- `locked`
- `available`
- `complete`

And explicit reasons:

- `bank_unavailable`
- `prerequisite_missing`
- `spacing_window`
- `attempt_limit`
- `retry_cooldown`

### Mastery

A mastery assessment has no prior Capability Engine evidence prerequisite.

It is available only when its private bank is active and its current mastery evidence cell is incomplete.

### Delayed Retrieval

A retrieval assessment unlocks only when every covered Deep Dive has current mastery evidence and the configured spacing floor has elapsed.

Current V1 spacing floor: 24 hours from the latest required mastery evidence timestamp.

This is a pilot calibration parameter, not a permanent learning-science claim.

### Interleaved Transfer

A transfer assessment requires both:

- current mastery evidence; and
- current retrieval evidence

for every covered Deep Dive.

The spacing floor then runs from the latest required prerequisite timestamp.

This deliberately prevents stale retrieval evidence from bypassing a newly-invalidated mastery standard.

## Attempt Budgets and Bank Rotation

Attempt limits and retry cooldowns are now calculated only against attempts from the currently active immutable bank version.

If a bank rotates from v1 to v2:

- historical v1 attempts remain preserved;
- v1 evidence becomes stale for current readiness;
- v1 attempts do not consume v2's attempt allowance;
- v2 attempt numbering begins a new current-version attempt budget.

No historical evidence is deleted.

## Evidence Selection Fix

A bank-rotation bug was identified during this sprint.

Incorrect ordering could choose the highest attempt number across all versions before checking the active version. A retired v1 attempt 3 could therefore outrank a current v2 attempt 1.

The selector now:

1. filters to the active bank version first;
2. then chooses the latest attempt inside that version.

Current v2 evidence therefore always wins over retired v1 evidence regardless of attempt-number reset.

## Approved-Plan Boundary

Sprint 1-7 shadow assessments remain historically readable for earlier proof work.

They do not automatically become part of the Sprint 8/9 Capability MVP standard.

V2 readiness and sequencing now pass the approved 16-event assessment-key set into evidence selection. Only those approved plan assessments can mint V2 capability evidence cells.

This prevents legacy shadow banks from accidentally satisfying the 33-cell gate.

## Runtime API Enforcement

A Specialist-facing plan endpoint now exposes assessment availability:

`GET /api/tutor/capability-plan?tutorAssignmentId=...`

Sequencing is enforced before both:

- form issuance;
- attempt submission.

The UI is therefore not the security boundary. Typing a planned assessment URL directly or POSTing an attempt cannot bypass `locked` or `unavailable` status.

## Specialist Experience

A dedicated Capability Plan workspace displays all 16 planned automated checks grouped as:

- 11 Deep Dive mastery checks;
- 2 delayed cumulative retrieval checks;
- 3 interleaved transfer checks.

The plan shows:

- bank unavailable;
- prerequisite lock;
- spacing/cooldown unlock time;
- attempt-limit review state;
- available;
- complete.

Only `available` renders an active `Take assessment` action.

All 11 implemented RI-OS Deep Dive routes now map to their planned mastery assessment. A missing private bank is visible but inert.

The page explicitly states that Capability Engine remains shadow evidence and cannot certify a Specialist, change operational mode, open Trial or replace the current Sandbox Mock Gate.

## Bugs Found and Fixed in Sprint 9

1. **Old-bank attempts consumed new-bank attempt limits.**
   - Fixed by scoping attempt state to active `bank_version`.

2. **Retired higher attempt number could outrank current lower attempt number.**
   - Fixed by filtering to active bank version before latest-attempt selection.

3. **Transfer could remain unlockable after current mastery disappeared if retrieval still existed.**
   - Fixed by requiring both current mastery and current retrieval before transfer.

4. **Legacy Sprint 1-7 shadow assessments could potentially mint V2 evidence cells.**
   - Fixed by restricting V2 evidence selection to approved 16-event plan keys.

5. **A private item could claim critical-boundary coverage without real critical-fail semantics.**
   - Fixed by requiring a real critical-fail option and rejecting correct/critical overlap.

6. **Sequence items could create ambiguous option-based critical-fail behavior.**
   - Fixed by rejecting option-based critical-fail semantics on sequence items in V1.

7. **A large bank could still be shallow across competencies.**
   - Fixed by mastery-wide competency breadth and cumulative per-Deep-Dive breadth requirements.

## Calibration Flag - 96% With Binary Digital Scoring

This sprint does not silently change the approved 96% threshold.

However, current automated assessment scoring is binary per question.

Therefore:

- on a 15-question form, 14/15 = 93.33%, so 96% requires 15/15;
- on a 20-question form, 19/20 = 95%, so 96% requires 20/20.

The current digital 96% standard is therefore effectively perfect performance on both planned form sizes.

This differs from the old human Clear/Partial/Fail Battle Test where partial credit could produce values between whole-question percentages.

This is explicitly a pilot calibration item. Sprint 9 preserves the standard rather than changing it without evidence.

Future calibration options include keeping effective-perfect digital performance intentionally, increasing form size so one miss can still produce 96%, or introducing deterministic partial-credit rules where valid. None is approved by this sprint.

## Verification

The branch contains focused tests for:

- critical-boundary quota derivation;
- mastery all-boundary selection;
- cumulative one-boundary-per-Deep-Dive selection;
- fail-closed boundary/competency conflicts;
- release-grade bank breadth;
- critical-fail semantic integrity;
- boundary secrecy in public projections;
- active-bank evidence ordering;
- current-bank attempt budgets;
- prerequisite/spacing/cooldown sequencing;
- downstream locks after mastery invalidation;
- V2 exclusion of legacy shadow assessment keys;
- direct API sequencing enforcement;
- all 11 Deep Dive mastery route mappings;
- available-only UI launch behavior.

An isolated TypeScript compile of the exact sequencing module succeeded against minimal compatible stubs. The smoke runner itself did not execute because the local harness emitted to an unexpected path, so this is not represented as a runtime pass.

GitHub Actions remains blocked before runner allocation. The latest Sprint 9 Capability Engine job again contains zero executed steps. A red Actions status is therefore not being represented as a test failure.

No database/staging integration has been run because the user declined the paid Supabase development branch and production is intentionally untouched.

## Next Sprint

Sprint 10 should build the deterministic Sandbox Simulation Engine foundation.

The next proof question is no longer only whether a Specialist can choose correct operating judgments. It is whether the Specialist can preserve RI behavior across a multi-step simulated session before human Mock Gate.

Sprint 10 should remain branch-only, use synthetic/public fixtures only, keep live scenario decision graphs private, and remain non-authoritative until separately proven.