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

Founder approval closes the manual-authoring pass for those items. It does **not** by itself freeze a bank for release. The private package still requires source-truth reconciliation, metadata/coverage audit, duplicate and option-quality audit, deterministic-form validation, and private package integrity checks before import.

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

## Blueprint V2 source reconciliation

The historical PR #45 blueprint was not treated as doctrine authority. It was compared against the current live Deep Dives and evidence contracts before private-bank staging.

Blueprint V2 preserves the still-valid Clarity, Structured Execution, Controlled Discomfort, and Topic Conditioning ownership while reconciling four materially changed areas:

### Time Pressure Stability

Capability now includes:
- Structured Execution timing baseline authority;
- the immutable system-owned Timer Contract;
- structure, pace, and completion under the defined timer;
- technical-failure lineage;
- a fresh pre-prepared equivalent reserve only after objective technical timing/runtime/device failure.

Student timeout, panic, wrong method, incomplete work, or weak performance remains real evidence and never authorizes a replacement attempt.

### Intro Session Structure

The retired fixed phase-block / score-band / adjacent-movement model is not Capability authority.

Intro now tests evidence-complete Diagnosis:
- starting signal as first-probe hypothesis, never placement;
- named evidence-question routing;
- constraint stripping;
- observed / not-observed / confounded evidence;
- intervention separation;
- evidence-justified repetition only;
- topic-scoped durable resume;
- Low / Medium / High placement;
- High Maintenance as Training-earned only.

### Logging System

Logging now tests source truth:
- concrete behavior;
- evidence eligibility;
- intervention as a separate fact;
- condition integrity;
- source lineage;
- recovery history;
- downstream claim integrity;
- system interpretation without Specialist-authored state strengthening.

### Session Flow Control

Session Flow now distinguishes:
- Intro Diagnosis;
- Active Training;
- Handover Verification;
- targeted evidence-complete re-diagnosis.

Missing prerequisite or timing authority cannot be repaired through hidden calibration side reps, and one context cannot borrow another context's authority.

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
- Blueprint V2 and critical-boundary coverage;
- unique item keys and prompts.

The manual corpus must be re-tagged/audited against Blueprint V2 where source doctrine changed. Metadata may be corrected during this release audit; approved question wording, answer choices, keyed answer, or explanation must not be silently rewritten and treated as previously Founder-approved.

## Activation boundary

No production database mutation or bank activation is authorized by this reconciliation.

The next content step is to recover/package the eight approved manual banks into a private V2R8 staged bank, run the source-truth and metadata audit against Blueprint V2, validate the package, stage only passing banks in Proof, and then run authenticated Specialist journey proof before any merge or production activation decision.
