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
| Knowledge | 76 | Can be proven through automated mastery, delayed retrieval and transfer evidence. |
| Applied discernment | 33 | Requires choosing the correct operating response in context; automated transfer is central and simulation may add evidence where implemented. |
| Observable execution | 21 | Must not be claimed from quiz performance alone; current evidence includes automated transfer plus retained human observation, with practical/simulation support where implemented. |
| Integrity boundary | 35 | Protected RI boundary. Automated transfer/critical semantics are combined with targeted human verification rather than replaced by a score alone. |

Therefore **56 of 165 requirements remain explicitly human-observable or integrity-sensitive**. Sprint 17 does not pretend those 56 became automated-only judgments.

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

## Semantic channels vs implemented channels

The coverage matrix names the evidence channels that can contribute to proving each semantic requirement.

`shared/capabilityBattleTestEvidenceAvailability.ts` then filters those channels against the Capability Engine that actually exists today.

Current implemented coverage is intentionally conservative:

| Evidence channel | Battle Test requirements with current support |
| --- | ---: |
| Mastery | 130 |
| Delayed retrieval | 109 |
| Transfer | 165 |
| Practical evidence | 33 |
| Targeted Oral Integrity Defense | 35 |
| Sandbox simulation V1 | 45 |
| Retained human Sandbox Mock | 56 |

The asymmetry is intentional. For example, Sandbox simulation V1 currently covers Clarity, Structured Execution, Controlled Discomfort, Logging System and Session Flow Control. Sprint 17 does not claim simulation coverage for Handover, Tools, Intro, Drill Library, Topic Conditioning or Time Pressure Stability when the current private simulation bank does not implement those Deep Dives.

Similarly, practical coverage is claimed only for Deep Dives represented by the current Prepare / Execute / Evidence rubrics.

## Orphan rule

A current Battle Test requirement is an orphan if the exact runtime question exists but the Capability Engine has no implemented replacement evidence channel for its semantic requirement.

The Sprint 17 contract requires:

- 165 exact runtime questions;
- 165 unique coverage entries;
- no duplicate mappings;
- no stale mappings;
- no missing mappings;
- no auto-critical question without canonical boundary lineage;
- no current requirement with zero implemented evidence channels;
- no human-required requirement without an implemented human-verification channel.

The focused tests are written to fail closed if any of these conditions changes.

## What this audit proves

If the tests execute successfully, Sprint 17 establishes structural and semantic coverage:

- every current runtime Battle Test question is known to the replacement model;
- every critical human-test boundary has canonical lineage;
- automated-only claims are separated from observable/human claims;
- implemented evidence-channel limitations are explicit rather than hidden;
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
- implemented channel counts = 130 mastery / 109 retrieval / 165 transfer / 33 practical / 35 oral / 45 simulation / 56 human Mock;
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
