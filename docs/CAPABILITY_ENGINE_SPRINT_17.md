# Capability Engine Sprint 17 - Battle Test Semantic Coverage Audit

## Objective

Before any future decision to retire the current human Battle Test load, prove that the replacement Capability Engine has an explicit evidence path for every substantive requirement currently tested across the 11 tutor Deep Dives.

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
| Applied discernment | 33 | The mastery bank tests the canonical operating competency; cumulative transfer and simulation strengthen contextual evidence without being counted as 33 separate legacy-question replicas. |
| Observable execution | 21 | Must not be claimed from automated evidence alone; mastery supplies semantic coverage while retained human observation remains required, with practical/simulation support where currently implemented. |
| Integrity boundary | 35 | Protected RI boundary. The mastery release contract must represent the canonical critical boundary and targeted human verification remains part of the replacement evidence stack. |

Therefore **56 of 165 requirements remain explicitly human-observable or integrity-sensitive**. Sprint 17 does not pretend those 56 became automated-only judgments.

## Why mastery is the question-level semantic anchor

The current release-grade private-bank validator requires each mastery assessment to:

- cover exactly its declared Deep Dive;
- declare every canonical competency in that Deep Dive;
- provide enough private items for every declared competency slot; and
- represent every canonical critical boundary in the private pool and generated form requirements.

That makes the 11 mastery banks the defensible question-level semantic replacement anchor for the 165 legacy requirements after they are mapped to canonical competency/boundary identities.

This is **not** a claim that the mastery item is the same question as the old Battle Test. It is a claim that the same canonical requirement cannot disappear from the release-grade mastery standard.

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

## Direct question support vs 33-cell reinforcement

Sprint 17 deliberately separates **direct semantic question support** from the Capability Engine's broader 33-cell evidence architecture.

At question level, the currently implemented direct support is:

| Direct evidence channel | Battle Test requirements with current support |
| --- | ---: |
| Release-grade Deep Dive mastery | 165 |
| Practical evidence | 33 |
| Targeted Oral Integrity Defense | 35 |
| Sandbox simulation V1 | 45 |
| Retained human Sandbox Mock | 56 |

Delayed retrieval and transfer are **not** counted as if each cumulative assessment separately re-tested all 165 legacy questions.

Instead, the approved Capability Engine keeps:

- 11 delayed-retrieval evidence cells; and
- 11 transfer evidence cells.

Those are Deep-Dive-level reinforcement signals layered above the 11 mastery anchors. This avoids inflating a 2-bank retrieval layer or 3-bank transfer layer into false 165-question equivalence.

## Current implementation boundaries

`shared/capabilityBattleTestEvidenceAvailability.ts` filters semantic channels against what actually exists today.

Sandbox simulation V1 currently covers:

- Clarity;
- Structured Execution;
- Controlled Discomfort;
- Logging System;
- Session Flow Control.

Sprint 17 therefore does not claim current simulation support for Time Pressure Stability, Topic Conditioning, Intro Session Structure, Drill Library, Handover Verification, or Tools Required.

Practical evidence is claimed only for Deep Dives represented by the current Prepare / Execute / Evidence rubric lineage. It is not claimed for Time Pressure Stability, Intro Session Structure, Drill Library, or Handover Verification.

The retained human Mock remains the direct human channel for every requirement classified as observable execution or integrity-sensitive. The targeted Oral Integrity Defense remains available for the 35 integrity-class requirements.

## Orphan rule

A current Battle Test requirement is an orphan if the exact runtime question exists but the Capability Engine has no currently implemented direct evidence channel for its canonical semantic requirement.

The Sprint 17 contract requires:

- 165 exact runtime questions;
- 165 unique coverage entries;
- no duplicate mappings;
- no stale mappings;
- no missing mappings;
- no auto-critical question without canonical boundary lineage;
- no current requirement with zero direct implemented evidence channels;
- no human-required requirement without an implemented human-verification channel.

The focused tests are written to fail closed if any of these conditions changes.

## What this audit proves

If the tests execute successfully, Sprint 17 establishes structural and semantic coverage:

- every current runtime Battle Test question is known to the replacement model;
- every mapped canonical competency/boundary is anchored in a release-grade mastery requirement;
- every critical human-test boundary has canonical lineage;
- automated semantic coverage is separated from observable/human verification;
- implemented practical/simulation limitations are explicit rather than hidden;
- retrieval and transfer are represented honestly as 11+11 Deep-Dive reinforcement cells rather than 165 direct question replicas;
- no Battle Test question can silently disappear from the replacement map after a future source change.

## What this audit does NOT prove

Semantic coverage is not empirical equivalence.

Sprint 17 does not prove that:

- the new automated banks have the same error rate as trained human Battle Test reviewers;
- Capability Engine READY predicts the same live behavior as Battle Test completion;
- the 96% deterministic assessment threshold is optimally calibrated;
- the practical/oral rubrics have acceptable inter-rater reliability in real reviewers;
- the new pathway should become authoritative;
- Battle Tests should be removed.

Those require shadow cohort comparison and concordance evidence, not another mapping document.

## Recommended next proof boundary

The next cutover question should be empirical:

> For Specialists who complete both pathways in shadow, where do Battle Test outcomes and Capability Engine evidence agree, where do they disagree, and which pathway better predicts Sandbox Mock / Trial execution?

Until that evidence exists, the current Battle Test and human Sandbox Mock remain authoritative.

## Verification contract

Focused tests cover:

- exact runtime bank = 11 Deep Dives x 15 questions = 165;
- exact mapping = 165 unique entries;
- proof-class split = 76 / 33 / 21 / 35;
- 35 current auto-critical questions all carry canonical boundary lineage;
- 56 human-required requirements all retain a human channel;
- all 165 mapped requirements retain direct mastery lineage;
- direct current question-channel counts = 165 mastery / 33 practical / 35 oral / 45 simulation / 56 human Mock;
- retrieval and transfer remain exactly 11+11 Deep-Dive reinforcement cells rather than being counted as direct question replicas;
- no false simulation coverage outside the current simulation Deep Dives;
- no false practical coverage outside current practical-rubric Deep Dives;
- no copied answer keys/private evaluator content;
- exact 165-question runtime bank vs 93-question fallback mismatch is visible;
- audit remains `authoritative: false` with `cutoverDecision: null` and no authority mutation path.

## Deployment state

- no merge to `main`;
- no Supabase write;
- no migration;
- no production deployment;
- no Battle Test source content changed.

Refs #35 #33 #31 #29 #27 #23 #21.
