# Capability Engine V2R8 Reconciliation — 2026-09-24

Status: implementation reconciliation in Proof; private bank activation not yet performed.

## Authoring position

Founder-approved manual V2R8 mastery banks:

1. Clarity — 45/45
2. Structured Execution — 45/45
3. Controlled Discomfort — 45/45
4. Time Pressure Stability — 45/45
5. Topic Conditioning — 45/45
6. Intro Session Structure — 45/45
7. Logging System — 45/45
8. Session Flow Control — 45/45

Total: **360 Founder-approved items across 8 complete mastery banks**.

Authoring is intentionally paused before Drill Library approval. Drill Library draft Items 1–5 are not approved content and must not be activated. Handover Verification and Tools Required remain unauthored.

## Reconciliation boundary

This branch ports only the Training Capability Check machinery from historical PR #45 onto current `main`.

Included:
- private assessment config/item storage;
- deterministic 15-question form generation;
- 96% mastery threshold and critical-fail handling;
- current-bank-version attempt persistence;
- Specialist assessment history and mastery ledger;
- staged 11-bank mastery plan;
- unavailable state for mastery banks whose Founder-approved private bank is not active;
- private-bank import and validation boundaries;
- Specialist Capability Check UI and API routes.

Excluded:
- Sandbox simulation;
- Practicals;
- Oral Defense;
- shadow-cohort tooling;
- historical Capability TPS runtime experiments;
- superseded delivery/evidence-correction work;
- retrieval and transfer assessments until those banks are manually authored and approved.

## Content boundary

Raw V2R8 prompts, options, answer keys and explanations remain outside the public repository.

Older generated V2/V2R7 candidate banks are historical material only. They are not approved content and must not be imported as substitutes for the manually Founder-approved V2R8 banks.

The staged validator accepts only an explicitly declared subset of Founder-approved mastery banks and requires:
- V2R8 bank version;
- exactly 45 items per included bank;
- four options per item;
- 15-question deterministic forms;
- 96% pass threshold;
- three-attempt contract;
- blueprint and critical-boundary coverage;
- unique item keys and prompts.

## Activation boundary

No production database mutation or bank activation is authorized by this reconciliation.

The next content step is to recover/package the eight approved manual banks into a private V2R8 staged bank, validate it, stage it in Proof, and then run authenticated Specialist journey proof before any merge or production activation decision.
