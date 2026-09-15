# Capability Engine Sprint 17 - Battle Test Semantic Coverage Audit

## Objective

Before any future decision to retire the current human Battle Test load, prove that the replacement Capability Engine has an explicit semantic and verification path for every substantive requirement currently tested across the 11 tutor Deep Dives.

This sprint does not modify Battle Test content, scoring, streaks, Sandbox Mock authority, Trial, certification, operational mode, or student state.

## Source-of-truth finding

The repository has two tutor Battle Test definition layers:

1. exact runtime Markdown banks loaded by `server/battleTestingBanks.ts`; and
2. fallback definitions in `shared/battleTesting.ts`.

The exact runtime banks contain:

- 11 tutor Deep Dives;
- 15 questions per Deep Dive;
- 165 current tutor Battle Test questions total.

At the minimum three locked attempts per Deep Dive, this is the 495 human-judgment floor the Capability Engine is intended to replace with a layered evidence system.

The shared fallback does **not** mirror the exact bank. It contains 93 questions total because the five Transformation Phase fallbacks contain 15 questions each while the six Session Infrastructure fallbacks contain only 3 each.

Sprint 17 deliberately audits `TUTOR_BATTLE_TEST_PHASES_EXACT`, not the degraded fallback.

This 165-versus-93 mismatch is recorded as an existing portability/failover risk. Sprint 17 does not rewrite the authoritative Battle Test content to resolve it.

## Public semantic coverage matrix

`shared/capabilityBattleTestCoverage.ts` contains one public metadata mapping for every exact runtime Battle Test question.

The mapping stores only:

- Deep Dive key;
- question key;
- canonical Capability Blueprint competency identities;
- canonical critical-boundary identities where applicable;
- proof class;
- replacement evidence-channel classes;
- whether human verification remains required.

It does **not** copy:

- Battle Test expected answers;
- fail indicators;
- private assessment answer keys;
- private simulation evaluator content;
- oral-defense scenario content.

## Proof classes

The 165 current requirements are classified as:

| Proof class | Questions | Replacement meaning |
| --- | ---: | --- |
| Knowledge | 76 | The canonical competency can be tested directly in the release-grade Deep Dive mastery bank. |
| Applied discernment | 33 | The mastery bank tests the canonical operating competency; transfer/simulation can strengthen contextual application without being counted as 33 separate legacy-question replicas. |
| Observable execution | 21 | Must not be claimed from automated evidence alone; mastery supplies semantic coverage while retained human observation remains required. |
| Integrity boundary | 35 | Protected RI boundary. The mastery release contract must represent the canonical critical boundary and targeted human verification remains part of the replacement stack. |

Therefore **56 of 165 requirements remain explicitly human-observable or integrity-sensitive**. Sprint 17 does not pretend those 56 became automated-only judgments.

## Why mastery is the question-level semantic anchor

The current release-grade private-bank validator requires each mastery assessment to:

- cover exactly its declared Deep Dive;
- declare every canonical competency in that Deep Dive;
- provide enough private items for every declared competency slot; and
- represent every canonical critical boundary in the private pool and generated form requirements.

That makes the 11 mastery banks the defensible question-level semantic replacement anchor for the 165 legacy requirements after they are mapped to canonical competency/boundary identities.

This is **not** a claim that a mastery item is the same question as the old Battle Test. It is a claim that the same canonical requirement cannot disappear from the release-grade mastery standard.

## Critical-boundary lineage

The exact runtime Battle Test currently contains 35 `autoCriticalOnFail` questions.

Every one is mapped to at least one canonical Capability Blueprint critical boundary and is classified as `integrity`.

Examples of protected families include:

- Modeling cannot become independent Clarity evidence;
- Identification cannot become solving;
- material assistance cannot be disguised as independence;
- No Rescue and Repeat Exposure support boundaries;
- speed cannot replace method under time;
- Specialist preference cannot override system movement;
- Intro placement cannot be replaced by teaching, intuition, or parent preference;
- logs cannot invent, rewrite, or retrospectively manufacture evidence;
- system-selected drills and inherited state cannot be manually overridden;
- drill constraints must preserve the capability being tested;
- Handover cannot erase continuity or reopen training through personal judgment;
- unobservable work/audio cannot be scored.

## Direct evidence versus compressed verification

Sprint 17 now keeps three concepts separate.

### 1. Direct semantic anchors

Every one of the 165 mapped Battle Test requirements retains a release-grade Deep Dive mastery anchor.

Practical evidence is counted as direct support **only** when a current Prepare / Execute / Evidence rubric criterion explicitly links the same canonical competency or critical boundary. The audit derives this from `CAPABILITY_PRACTICAL_PROOFS`; it does not grant practical coverage merely because a Deep Dive appears somewhere in a practical.

Delayed retrieval and transfer are not counted as 165 direct re-tests. They remain:

- 11 delayed-retrieval Deep-Dive evidence cells; and
- 11 transfer Deep-Dive evidence cells.

### 2. Targeted/sampled verification

Oral Integrity Defense V2 is a targeted integrity mechanism, not 35 oral Battle Tests.

- The integrity-class universe contains 35 mapped requirements.
- The oral system always issues three baseline probes and can add up to two evidence-risk probes.
- One oral attempt therefore contains 3-5 probes, selected from baseline/risk evidence.
- Sprint 17 records the 35 integrity requirements as **targetable**, not as 35 direct oral re-tests.

### 3. Retained human operating backstop

The Sandbox Mock remains five human-owned criteria:

1. `system_direction_followed`
2. `phase_constraints_preserved`
3. `evidence_captured`
4. `student_response_managed`
5. `system_result_respected`

The 56 human-required legacy requirements are mapped to one or more relevant Mock criteria as a final human operating backstop. This is **not** a claim that the Mock contains 56 question-level checks. The Mock stays a compressed five-criterion live judgment.

This is important: replacing 495 human judgments only works if the new design preserves human verification where it matters without quietly recreating dozens of manual questions under new names.

## Sandbox simulation evidence boundary

The public repository contains `SANDBOX_SIMULATION_DESIGN_FIXTURE_V1`, which has explicit competency and critical-boundary lineage. Sprint 17 may safely use that fixture to prove the simulation architecture can carry canonical RI lineage.

The active simulation bank, however, is private server-side data. Its scenario definitions include answer keys/evaluator content and are deliberately not committed to the public repository.

Therefore Sprint 17 records:

- public design-fixture overlap separately;
- `livePrivateSimulationCoverageAudited: false`;
- no claim that the current active private bank directly covers a particular count of the 165 legacy requirements.

A live private-bank coverage claim must come from an approved non-production/private-bank inspection, not from the public fixture.

## Current implementation boundaries

`shared/capabilityBattleTestEvidenceAvailability.ts` now distinguishes:

- mastery semantic anchors;
- explicit practical-rubric overlaps;
- public simulation design-fixture overlaps;
- oral-defense targetability;
- retained Mock-criterion backstops;
- 11+11 retrieval/transfer reinforcement cells.

This prevents three overclaims:

1. a Deep Dive appearing in one practical criterion does not make every question in that Deep Dive practically proven;
2. a public simulation design fixture does not prove the live private simulation bank has identical coverage;
3. a 3-5 probe oral defense or five-criterion Mock does not become 35 or 56 one-for-one human re-tests.

## Orphan rule

A current Battle Test requirement is a semantic orphan if the exact runtime question exists but no release-grade mastery anchor can retain its canonical competency/boundary requirement.

A human-required requirement has a verification gap if it has no currently defined human route through an explicit practical rubric, targeted Oral Defense capability, or mapped Sandbox Mock criterion.

The Sprint 17 contract requires:

- 165 exact runtime questions;
- 165 unique coverage entries;
- no duplicate mappings;
- no stale mappings;
- no missing mappings;
- no auto-critical question without canonical boundary lineage;
- no semantic requirement without mastery lineage;
- no human-required requirement without a human-verification route;
- no unknown Sandbox Mock criterion reference.

The focused tests are written to fail closed if any of these conditions changes.

## What this audit proves

If the tests execute successfully, Sprint 17 establishes structural and semantic coverage:

- every current runtime Battle Test question is known to the replacement model;
- every mapped canonical competency/boundary is anchored in a release-grade mastery requirement;
- every critical human-test boundary has canonical lineage;
- automated semantic coverage is separated from observable/human verification;
- practical support is tied to actual rubric lineage rather than Deep-Dive presence;
- oral and Mock human verification remain compressed instead of becoming one-for-one Battle Test replacements;
- retrieval and transfer remain honest 11+11 Deep-Dive reinforcement cells;
- public simulation-fixture evidence is separated from uninspected live private-bank evidence;
- no Battle Test question can silently disappear from the replacement map after a future source change.

## What this audit does NOT prove

Semantic coverage is not empirical equivalence.

Sprint 17 does not prove that:

- the new automated banks have the same error rate as trained human Battle Test reviewers;
- Capability Engine READY predicts the same live behavior as Battle Test completion;
- the 96% deterministic assessment threshold is optimally calibrated;
- the practical/oral rubrics have acceptable inter-rater reliability in real reviewers;
- the active private simulation bank covers the same semantic universe as the public design fixture;
- the five Mock criteria are sufficient predictors of Trial success;
- the new pathway should become authoritative;
- Battle Tests should be removed.

Those require shadow cohort comparison and concordance evidence, not another mapping document.

## Recommended next proof boundary

The next cutover question should be empirical:

> For Specialists who complete both pathways in shadow, where do Battle Test outcomes and Capability Engine evidence agree, where do they disagree, and which pathway better predicts Sandbox Mock / Trial execution?

That comparison should preserve the compressed verification architecture. It should not turn the 56 human-required mappings back into 56 manual questions.

Until that evidence exists, the current Battle Test and human Sandbox Mock remain authoritative.

## Verification contract

Focused tests cover:

- exact runtime bank = 11 Deep Dives x 15 questions = 165;
- exact mapping = 165 unique entries;
- proof-class split = 76 / 33 / 21 / 35;
- 35 current auto-critical questions all carry canonical boundary lineage;
- 56 human-required requirements all retain a human-verification route;
- all 165 mapped requirements retain mastery semantic lineage;
- direct practical support is derived from exact current rubric competency/boundary links;
- targeted Oral Defense is represented as a 35-requirement targetable universe, not 35 direct oral re-tests;
- human Mock support is represented as mapped five-criterion backstops, not 56 direct Mock questions;
- public simulation fixture overlap is audited separately from live private-bank coverage;
- live private simulation coverage is explicitly marked not audited from the repository;
- retrieval and transfer remain exactly 11+11 Deep-Dive reinforcement cells rather than being counted as direct question replicas;
- no copied answer keys/private evaluator content;
- exact 165-question runtime bank vs 93-question fallback mismatch is visible;
- audit remains `authoritative: false` with `cutoverDecision: null` and no authority mutation path.

## Verification status in this runtime

The latest Sprint 17 Capability Engine CI run is `34686387089` at head `5bd4f37cab08a5a16ff28eddfbfb45e1941f4ba8`.

Its only job (`103533982057`) completed with:

- `runner_id: 0`;
- empty runner name;
- `steps: []`.

Therefore the GitHub Actions failure happened before runner allocation. Sprint 17 does **not** claim that the focused tests or TypeScript check executed successfully in GitHub Actions.

## Deployment state

- no merge to `main`;
- no Supabase write;
- no migration;
- no production deployment;
- no Battle Test source content changed.

Refs #35 #33 #31 #29 #27 #23 #21.
