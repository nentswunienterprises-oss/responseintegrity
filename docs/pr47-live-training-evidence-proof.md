# PR #47 Live Training Evidence Authority Proof

Date: 2026-09-21  
PR: #47 - Evidence-complete diagnosis engine  
Branch: `feat/evidence-complete-diagnosis`

## Purpose

This record closes the live mixed-scenario acceptance proof for Training evidence authority.

The acceptance standard was not "the evaluator unit tests pass." The requirement was to drive materially different observation patterns through the deployed Specialist Training UI, submit them through the real Training endpoint, inspect the visible result, and confirm that the persisted student topic state follows the evidence-native decision rather than the retired numeric transition output.

## Proof environment

- Vercel environment: Preview
- Proof Supabase project: `jftlxeacphvbnhbsbpxc`
- Authenticated role: Specialist / tutor
- Sandbox Specialist ID: `77977298-7ac9-41f9-a726-9d5fd634540f`
- Live inventory before proof: 6 sandbox students visible through the authenticated Specialist Pod
- Preview backend authority was explicitly checked before browser execution:
  - `SUPABASE_URL`: present
  - `SUPABASE_ANON_KEY`: present
  - `SUPABASE_SERVICE_ROLE_KEY`: present
  - `DATABASE_URL`: present
  - `SESSION_SECRET`: present

The proof runner used Chromium/Playwright against the deployed branch Preview and clicked the real Training UI controls. It did not replace the UI proof with direct evaluator calls.

## Evidence runs

Primary mixed-scenario run:

- GitHub Actions run: `35640267087`
- Job: `106467601973`
- Artifact: `pr47-live-ui-proof`
- Artifact ID: `10657744353`
- Product scenarios passed in this run: 6 of 7
- The seventh case did not submit because the Playwright harness used an overly strict accessible-name selector for the visible "Timer changed" intervention button.

Targeted untouched-case rerun:

- GitHub Actions run: `35640863439`
- Job: `106469559740`
- Artifact: `pr47-live-ui-proof`
- Artifact ID: `10658116695`
- Scenario rerun: `raw-strong-but-timer-confounded`
- Result: PASS

The selector failure was therefore a proof-harness issue, not a product failure. The failed harness attempt did not submit or mutate that scenario's fixture before the targeted rerun.

## Scenario matrix

| Scenario | Historical numeric output | Evidence observation | Authoritative transition | Persisted result | Result |
| --- | ---: | --- | --- | --- | --- |
| Clean strength from High | 100 | High | `high maintenance entry` | Time Pressure Stability / High Maintenance | PASS |
| Raw strong answers with timer changed on every timed opportunity | 100 | Medium | `stability regress` | Time Pressure Stability / High | PASS |
| Final-phase High Maintenance with clean High evidence | 100 | High | `final maintenance hold` | Time Pressure Stability / High Maintenance | PASS |
| Non-final High Maintenance with clean High evidence | 100 | High | `phase progress` | Time Pressure Stability / Low | PASS |
| Persistent breakdown | 0 | Low | `stability regress` | Controlled Discomfort / High | PASS |
| Conditional / partial evidence | 60 | Medium | `stability regress` | Structured Execution / High | PASS |
| Early breakdown followed by sufficient clean recovery evidence | 93 | High | `high maintenance entry` | Structured Execution / High Maintenance | PASS |

Overall product result: **7 / 7 mixed live UI scenarios passed.**

## Strongest authority proof

The `raw-strong-but-timer-confounded` case intentionally selected the strongest raw behavior option on every timed observation, which produced a historical numeric output of **100 / 100**.

The Specialist also recorded **Timer changed** for every opportunity. The evidence eligibility layer therefore treated the timed observations as contaminated rather than clean capability evidence.

The live outcome was:

- historical numeric output: `100`
- evidence-observed stability: `Medium`
- decision authority: `evidence_native`
- transition: `stability regress`
- persisted state: `Time Pressure Stability / High`

This directly proves that the historical numeric output does not have authority to override behavioral evidence.

## Persistence verification

After the UI submissions, direct Proof-database verification showed the latest student topic records carrying `decisionAuthority: "evidence_native"` and the same phase/stability outcomes displayed by the UI.

Verified final examples included:

- Sandbox Student 1 / Geometry - Structured Execution / High Maintenance after recovery; observed High; historical output 93
- Sandbox Student 2 / Fractions - Controlled Discomfort / High after persistent breakdown; observed Low; historical output 0
- Sandbox Student 3 / Linear equations - Time Pressure Stability / Low after non-final phase progression; observed High; historical output 100
- Sandbox Student 4 / Algebra - Time Pressure Stability / High Maintenance after final maintenance hold; observed High; historical output 100
- Sandbox Student 5 / Ratios - Time Pressure Stability / High after timer-confounded evidence; observed Medium; historical output 100

## Acceptance judgement

The live evidence supports accepting Training evidence-native authority for the state transitions it currently claims to own:

- current-phase stability regression
- current-phase stability hold
- High to High Maintenance entry
- High Maintenance to next-phase progression
- final-phase High Maintenance hold
- conditional evidence
- persistent breakdown
- breakdown followed by sufficient clean recovery
- intervention/confounding exclusion

For these decisions, the tested chain is:

`Specialist observation -> evidence eligibility -> dimension state -> observed stability -> evidence-native transition -> UI result -> persisted topic state`

The historical numeric output is observational only.

## Prerequisite-loss follow-up

The 7 / 7 live UI proof above established Training evidence authority for same-phase decisions, but that proof predates the cross-layer prerequisite sentinel added after founder review.

The current PR head now implements:

- automatic sentinel activation after a clean current-phase breakdown;
- stripped-constraint checks for Structured Execution, Controlled Discomfort, and Time Pressure Stability;
- persisted `targeted re-diagnosis required` authority without backward state mutation;
- automatic next-launch routing into the evidence-complete diagnosis runner;
- clearing of the prerequisite gate only after evidence-native diagnosis completes.

This new authority surface requires its own deployed acceptance proof before merge. The minimum proof cases are:

1. Structured Execution breakdown + Clarity sentinel holds -> ordinary current-phase regression/hold, no re-diagnosis flag.
2. Structured Execution breakdown + Clarity sentinel contradicts -> state frozen, re-diagnosis target = Clarity.
3. Controlled Discomfort breakdown + stripped normal execution contradicts -> state frozen, re-diagnosis target = Structured Execution.
4. Time Pressure breakdown + untimed structure contradicts -> state frozen, re-diagnosis target = Structured Execution.
5. Missing/confounded required sentinel -> no guessed state movement; targeted re-diagnosis required.
6. Next launch opens evidence-complete diagnosis automatically.
7. Completed re-diagnosis clears the prerequisite gate and persists the newly established phase/stability.

Until those deployed cases are proven, the implementation is complete but this new prerequisite-loss authority remains an open merge gate.

## Cleanup

The temporary, fixture-specific Playwright workflow and scripts used to create this proof were removed after evidence capture so future branch pushes cannot replay completed Sandbox fixtures. The immutable GitHub Actions runs and artifacts above remain the proof record.
