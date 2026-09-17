# Capability Private Assessment Bank V2 Rebuild Contract

## Decision

The lost Sprint 12/13 private assessment payload remains the historical bank-version-1 release. Its known hashes are retained only as historical identity checks. No newly authored payload may use those hashes, be described as recovered V1 content, or be imported as bank version 1.

The replacement release will:

- keep the 16 assessment keys in `CAPABILITY_MVP_ASSESSMENT_PLAN_V1` unchanged;
- use `bankVersion: 2` for every assessment;
- receive new per-assessment and combined-package SHA-256 identities;
- carry a reproducible provenance manifest;
- remain private and outside the public repository;
- be imported into RI Proof inactive first;
- require explicit validation and review before activation;
- never be applied directly to Production.

Assessment-key identity represents the approved evidence event. Bank-version identity represents the private content release used to deliver that event.

## Required release shape

| Bank family | Assessments | Items per assessment | Total items | Form size |
| --- | ---: | ---: | ---: | ---: |
| Mastery | 11 | 45 | 495 | 15 |
| Delayed retrieval | 2 | 80 | 160 | 20 |
| Interleaved transfer | 3 | 80 | 240 | 20 |
| Complete release | 16 | - | 895 | - |

All assessments retain:

- 96% pass threshold;
- three attempts per active bank version;
- zero-hour bank retry cooldown;
- sequencing delays from the existing Capability Assessment Plan;
- binary deterministic scoring;
- private evaluator keys, explanations, critical-fail mappings and internal lineage.

## Sources of authority

Authoring must be grounded in:

1. `shared/capabilityBlueprint.ts` for operating capabilities, competencies, critical boundaries, required evidence kinds and transfer relationships;
2. `shared/capabilityAssessmentPlan.ts` for assessment membership, form sizes, delays, coverage modes and pass thresholds;
3. the 11 Battle Testing Deep Dive source documents listed in the Sprint 12 manifest;
4. `shared/capabilityBankCoverage.ts` and `shared/capabilityCriticalCoverage.ts` for fail-closed release coverage;
5. `server/capabilityFormGeneration.ts` for issued-form feasibility and deterministic selection;
6. `scripts/import-private-capability-bank.ts` for the accepted private payload schema.

Test/design fixtures are not release content and may not be expanded into the private bank by paraphrase alone.

## Provenance manifest

The private release directory must contain:

- the complete import payload;
- deterministic authoring/build source;
- a machine-readable manifest;
- a validation report;
- a human-review ledger;
- per-assessment SHA-256 values;
- one combined-package SHA-256 value;
- generator/source revision identity;
- blueprint version and frozen repository commit;
- creation timestamp and release status.

The manifest must label the release `candidate` until every automated and human gate passes. Hashes become canonical only when the candidate is frozen as `approved_for_proof`.

## Automated acceptance gates

The candidate fails closed unless all of the following pass:

### Structure

- exactly 16 approved assessment keys;
- `bankVersion: 2` on all assessments;
- exactly 495 mastery and 400 cumulative items;
- unique assessment and item identities;
- valid question kinds and option references;
- no correct/critical option overlap;
- no empty prompts, labels or explanations.

### Capability coverage

- 11/11 Deep Dives;
- 33/33 required evidence cells;
- every declared mastery competency represented;
- at least two competency identities per covered Deep Dive in cumulative banks;
- 34/34 canonical critical boundaries represented in each applicable pool;
- every boundary-tagged item carries real critical-fail semantics;
- critical-boundary reservation remains feasible inside issued-form competency quotas;
- transfer banks contain a declared transfer relationship and remain label-blind.

### Form and retry behavior

- every sampled issued form has the planned size and competency allocation;
- every sampled form satisfies its required critical-boundary coverage mode;
- attempts 1-3 provide meaningful item diversity without changing the capability surface;
- deterministic generation reproduces the same form for the same identity, bank version and attempt;
- different assignment identities do not collapse to one presentation pattern.

### Adversarial content QA

- no exact duplicate prompt within an assessment;
- cross-bank exact duplicates are reported and justified or removed;
- near-duplicate clusters are measured and reviewed;
- answer position and answer-length distributions do not create a usable shortcut;
- repeated option labels are measured and capped;
- formal Deep Dive and competency labels do not leak in transfer prompts;
- distractors remain plausible without becoming trick questions;
- no item rewards generic tutoring instincts where the RI operating rule differs;
- critical-fail choices represent actual integrity violations, not merely weak answers.

## Human review gates

Automated structural validity is not sufficient to activate the bank. Human review must confirm:

- doctrinal accuracy against the cited Deep Dive source;
- one defensible answer set for each item;
- explanation alignment with the selected answer and RI boundary;
- realistic fictional context;
- absence of accidental clues or ambiguous qualifiers;
- appropriate distinction between ordinary incorrect and critical-fail options;
- transfer validity rather than surface vocabulary matching;
- no unsupported psychological or student-performance claims.

Every rejected or corrected item must remain traceable in the review ledger. A generator rerun invalidates prior item-level approval unless stable item identity and unchanged semantic content are demonstrated.

## Private handling boundary

The 895-item payload, generator content templates and human-review ledger contain evaluator material and must not be committed to the public repository. Public commits may contain only the non-secret contract, aggregate validation results, release hashes and proof outcomes.

The public leakage-boundary tests must run before any branch update containing bank-related work.

## RI Proof import and activation sequence

1. Verify the target project reference is Nenterprises RI Proof and reject the Production reference.
2. Validate the complete package offline with `--require-mvp-coverage` and without `--apply`.
3. Record the candidate hashes before database access.
4. Import all bank-version-2 configs and items inactive.
5. Compare persisted counts, keys and semantic hashes with the frozen private artifact.
6. Execute database security and leakage checks.
7. Activate bank version 2 only after the entire package passes; do not activate assessment-by-assessment during an incomplete import.
8. Verify bank version 1 evidence becomes historical and cannot mint current V2 credit.
9. Run the authenticated Specialist assessment GET, POST and history paths.
10. Run stale-form, retry, critical-fail, result-projection and cross-assignment attacks.
11. Keep Production untouched until a separately reviewed promotion decision.

## Exit condition

The rebuild is complete only when the newly authored private package has:

- 895 accepted items across all 16 assessment keys;
- complete automated validation evidence;
- completed human review evidence;
- frozen new hashes and provenance;
- exact inactive Proof persistence verification;
- explicit activation approval;
- passing real HTTP assessment journeys and integrity attacks;
- no private evaluator content committed to the public repository;
- no Production writes.
