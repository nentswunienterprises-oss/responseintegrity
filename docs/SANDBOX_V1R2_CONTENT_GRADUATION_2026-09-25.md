> Superseded for graduation/content authority by [Sandbox V1R3 — Stateful RI Practice Environment](./SANDBOX_V1R3_STATEFUL_ENVIRONMENT_2026-09-25.md). V1R2 remains the mechanism/proof foundation only. Its 2-scenarios-per-phase / 90% candidate rule is retired and must not be used as the permanent Sandbox graduation gate.

# Sandbox V1R2 — Content and Graduation Architecture

Date: 2026-09-25

## Stage boundary

Current Specialist pathway:

**Application → Training → Sandbox → Practicals → Trial → Certification → Certified Live**

Sandbox proves that a Specialist can read predefined student behaviour and operate the real Response Integrity evidence system without contaminating live student truth.

Practicals are the next stage. Sandbox does not jump directly to Trial.

## Graduation model

Sandbox graduation is evidence-based and bank-versioned.

The engine supports a private graduation policy with:

- minimum observation fidelity;
- required RI system-outcome agreement;
- required **distinct** scenario passes by phase;
- explicit policy status: `candidate` or `approved`;
- next stage fixed to `practicals`.

A candidate policy can prove whether the evidence standard works without granting progression.
Only an approved policy can mark a Specialist `practicalsReady`.

Even then, the engine does **not** mutate lifecycle mode automatically. Stage control remains explicit.

## Current candidate standard for Proof validation

The candidate private bank is designed around two distinct scenarios in each RI phase:

- Clarity: 2
- Structured Execution: 2
- Controlled Discomfort: 2
- Time Pressure Stability: 2

Candidate minimum observation fidelity: **90%**.
System outcome must match canonical RI outcome.

This is a validation standard, not yet a Founder-approved permanent policy.

## Content rule

Canonical simulated observations remain private.

The public repository may contain:
- schema;
- evaluator;
- policy engine;
- aggregate readiness logic;
- tests using synthetic fixtures.

It must not contain the private production/Proof scenario answer record.

## What this replaces

The old six-sandbox-account / weekly-report / monthly-report Sandbox framework belongs to an earlier Sandbox concept and must not be used as the graduation authority for the deterministic simulation stage.

Reporting load, concurrency and real delivery execution belong downstream in Practicals / Trial validation rather than being smuggled into Sandbox.
