# Capability Engine Sprint 8

## Status

Branch-only architecture sprint.

- Branch: `feat/capability-engine-sprint-8`
- Base: `feat/capability-engine-sprint-7`
- No main merge
- No production migration
- No production deployment
- No paid Supabase development branch

## Objective

Move the Capability Engine from the initial Clarity + Structured Execution proof slice to an explicit capability contract covering all 11 currently implemented Specialist Battle Test Deep Dives.

The target is not to reproduce the old 33 live human Battle Tests digitally. The target is to preserve repeated evidence of capability while allowing cumulative digital assessments to carry multiple evidence cells.

## Canonical Capability Scope

### Transformation Phases

1. Topic Conditioning
2. Clarity
3. Structured Execution
4. Controlled Discomfort
5. Time Pressure Stability

### Session Infrastructure

6. Intro Session Structure
7. Logging System
8. Session Flow Control
9. Drill Library
10. Handover Verification
11. Tools Required

Evidence Integrity remains cross-cutting. It is not a twelfth Deep Dive.

## Capability Blueprint

`shared/capabilityBlueprint.ts` now defines public, non-secret metadata for every Deep Dive:

- operating capability
- competency identities
- critical integrity boundaries
- required evidence classes
- transfer relationships

Every Deep Dive requires three evidence classes:

- mastery
- delayed retrieval
- interleaved transfer

This creates 33 capability evidence cells.

A cell is a proof requirement, not an instruction to create a separate assessment.

## MVP Assessment Plan

`shared/capabilityAssessmentPlan.ts` defines the V1 execution plan:

### 11 mastery checks

One automated mastery assessment per Deep Dive.

- 15 questions per issued form
- minimum private item pool target: 30 per mastery assessment
- 96% deterministic pass threshold
- critical-fail override remains available through private item metadata

### 2 delayed cumulative retrieval checks

- Transformation Phases Delayed Retrieval
- Session Infrastructure Delayed Retrieval

Each cumulative assessment can satisfy retrieval evidence for several Deep Dives in one event.

MVP spacing floor: 24 hours after the relevant prerequisite evidence. This is a calibration parameter, not a permanent learning-science claim.

### 3 interleaved transfer checks

- Transformation State Interleaved Transfer
- Session Operation Interleaved Transfer
- Continuity and Delivery Integrity Transfer

The Specialist is not told which Deep Dive principle should govern each scenario. The purpose is to test recognition and transfer across operating boundaries rather than memorized module labels.

## Assessment Event Count

Old minimum human model:

- 11 Deep Dives x 3 qualifying live Battle Tests
- 33 live human Battle Test runs per Specialist
- 495 human question-level judgments per Specialist before retakes

Capability MVP digital plan:

- 11 mastery events
- 2 cumulative retrieval events
- 3 cumulative transfer events
- 16 automated assessment events total

The 16-event plan covers all 33 capability evidence cells.

Human effort is reserved for:

- asynchronous practical evidence review
- targeted Oral Integrity Defense
- Sandbox Mock Gate
- exceptions / integrity escalation
- real-world Trial evidence

## Readiness V2

`CAPABILITY_MVP_SHADOW_GATE_V2` now requires:

- all 33 Deep Dive evidence cells
- Prepare practical approved
- Execute practical approved
- Evidence practical approved
- Oral Integrity Defense approved

Total requirements: 37.

The gate remains explicitly non-authoritative. It cannot change:

- Battle Test progression
- Sandbox Mock Gate
- Trial
- certification status
- operational mode

The existing `getFoundationCapabilityReadiness` server service name is preserved for route compatibility, but on Sprint 8 it evaluates the full V2 capability gate.

## Evidence Selection Integrity

A passed assessment grants an evidence cell only when:

1. it is the latest attempt for that assessment;
2. it passed;
3. its bank version is still the active version; and
4. the submitted result actually contained questions from that Deep Dive.

This means a cumulative assessment cannot claim coverage for a Deep Dive that was absent from the issued form.

A newer failed attempt invalidates the older pass. A retired bank version invalidates stale evidence.

## Private Bank Authoring Boundary

`shared/capabilityBankCoverage.ts` validates assessment metadata against the public blueprint.

It rejects:

- unknown Deep Dives
- unknown competencies
- mastery forms spanning more than their declared Deep Dive
- transfer forms containing fewer than two Deep Dives
- transfer forms without a declared transfer relationship
- competency blueprints that request more matching private items than exist

Cross-cutting evidence/system competencies may appear inside any relevant Deep Dive assessment.

## Offline Validation

`scripts/import-private-capability-bank.ts` no longer imports `server/db` at startup.

Default execution is validation-only and opens no database connection.

It now:

1. parses the private bank;
2. validates every assessment against the public capability blueprint;
3. validates deterministic form generation;
4. reports covered and missing evidence cells;
5. exits without touching a database.

`--require-mvp-coverage` fails if the supplied private bank does not cover all 33 evidence cells.

`--apply` remains the only path that dynamically imports the database and performs writes. It must only be used against an explicitly approved target.

## Current Bank Coverage

The original public design fixtures remain non-production and cover only the initial Capability Engine slice:

- Clarity mastery
- Clarity retrieval
- Clarity transfer
- Structured Execution mastery
- Structured Execution transfer

Current fixture coverage: 5 / 33 evidence cells.

Missing: 28 / 33.

This is expected. Sprint 8 defines the full architecture; it does not pretend the remaining private item banks have already been authored.

## Verification

Direct plan-coverage calculation in this development session:

- planned automated assessment events: 16
- required evidence cells: 33
- unique cells covered by the plan: 33
- missing cells: 0
- extra cells: 0

GitHub Actions remains an infrastructure blocker. Capability Engine jobs continue to fail before runner allocation with zero executed steps, so a red Actions result is not being represented as a code-test failure.

## Next Sprint

Sprint 9 should make critical-boundary coverage mechanically guaranteed in issued forms and implement data-driven assessment availability / sequencing from the 16-check plan.

No live bank expansion should be exposed to Specialists until the relevant private bank version exists and passes offline blueprint validation.
