# Capability Engine Sprint 11 - Private Sandbox Bank Manifest

Status: authored and validated outside the public repository.

This file contains metadata only. It must never contain scenario prompts, answer keys, evaluator mappings, explanations, or other private bank content.

## Bank identity

- bank key: `sandbox_foundation`
- bank version: `1`
- title: `Response Integrity Sandbox Foundation Bank V1`
- max attempts: `6`
- retry cooldown: `0 hours`
- private artifact filename: `ri_private_sandbox_simulation_bank_v1.json`
- private artifact SHA-256: `70ed77704f666f2588cb3eee3f9019a3ea13d774ecb25ce03cf7b928831da462`
- private artifact size at freeze: `81,134 bytes`

The hash is the release identity for the authored V1 payload. Any content change requires a new hash and review. A database import must use the reviewed artifact matching this fingerprint.

## Coverage

- fictional scenarios: `13`
- constrained decisions: `65`
- canonical competencies exercised: `36`
- target Deep Dives: `5/5`
  - Clarity
  - Structured Execution
  - Controlled Discomfort
  - Logging System
  - Session Flow Control
- canonical critical boundaries represented: `17/17`
- risk dimensions represented:
  - evidence contamination
  - authority violation
  - escalation failure

Decision distribution at freeze:

- Clarity: `9`
- Structured Execution: `9`
- Controlled Discomfort: `10`
- Logging System: `21`
- Session Flow Control: `16`

Logging and Session Flow intentionally appear across cross-module scenarios because evidence lineage and system authority are cross-cutting execution responsibilities, not isolated quiz topics.

## Source grounding

The bank was authored from the current implemented RI Battle Test source material and canonical Capability Engine blueprint on the Sprint 11 stack, especially:

- Clarity Deep Dive
- Structured Execution Deep Dive
- Controlled Discomfort Deep Dive
- Logging System
- Session Context and Drill Flow
- `server/battleTestingBanks.ts` critical-fail mappings
- `shared/capabilityBlueprint.ts`
- `shared/capabilitySandboxSimulation.ts`
- `shared/capabilitySandboxSimulationBlueprint.ts`

Scenario wording is newly authored for simulation. It does not copy the Battle Test question bank as a live learner-facing bank.

## V1 scenario families

The private bank contains scenario families covering:

1. Clarity first-contact recognition integrity
2. Clarity condition integrity and progression pressure
3. Structured Execution independence
4. Structured Execution variation control
5. Controlled Discomfort No Rescue
6. Controlled Discomfort Repeat Exposure
7. Logging missing-evidence recovery
8. Logging claim pressure
9. Session Flow Intro
10. Session Flow Active Training
11. Session Flow Handover Verification
12. Cross-module parent pressure
13. Cross-module end-of-session integrity

## Integrity guarantees

The private payload has been checked for:

- fictional-only scenario declaration
- unique scenario and decision identities
- valid bank/scenario versions
- valid option references
- no correct-option / critical-fail overlap
- critical-fail actions always carrying RI critical-boundary lineage
- canonical Deep Dive identities only
- canonical competency identities only
- canonical critical-boundary identities only
- all 17 critical boundaries across the five target Deep Dives represented at least once
- all three simulator risk dimensions represented

The first validation pass correctly rejected two authoring mistakes:

- a Logging decision incorrectly referenced a Structured Execution critical boundary
- a Controlled Discomfort decision used a non-existent competency alias

Both were corrected in the private artifact before this manifest was frozen. The validator was not weakened.

## Public-repository leakage controls

Sprint 11 adds explicit `.gitignore` patterns for private Sandbox simulation-bank payloads and a tracked-files boundary test. The public repository may contain schemas, validators, design fixtures, manifests, hashes and importer code. It must not contain the live V1 evaluator payload.

## Authority boundary

This bank remains Sandbox rehearsal content.

Even after later import/activation:

- a simulation pass cannot pass the human Sandbox Mock Readiness Gate
- a simulation pass cannot open Trial
- a simulation pass cannot certify a Specialist
- a simulation pass cannot change `operational_mode`
- a simulation pass cannot change student topic state
- the existing human Mock Readiness Gate remains the authoritative Sandbox exit gate on this stack

## Database status

No database import has occurred.

No Supabase write occurred during Sprint 11 authoring.

The artifact is ready for controlled import only after an explicitly approved database target exists.
