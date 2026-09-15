# Capability Engine Empirical Proof Report

## Status

- Proof phase: Sprint 19 empirical shadow validation
- Proof environment: Nenterprises RI Proof (`tzgkiaiwnhmnzznvmbfg`)
- Production environment: The Hub (`yzcnavucvwgmulcxgxvw`)
- Proof branch: `proof/capability-engine-shadow-validation`
- Frozen Capability base: `5236b9aafc889090259ef30f94311831755b1bda`
- Report date: 2026-09-13
- Decision: synthetic integration and integrity proof passed; production-derived validation and any cutover decision remain blocked

This report records an empirical integration and concordance proof. It does not establish equivalence, non-inferiority, superiority, predictive validity, or Trial outcome validity. Capability Engine remains advisory and non-authoritative.

## Environment and production-safety boundary

RI Proof is a permanent pre-production database, not a disposable Capability-only environment. It mirrors the production application schema while excluding production Auth users, Storage objects, emergency credentials, and real student or family data by default.

During this proof:

- Capability migrations and synthetic evidence were applied only to RI Proof;
- production was used only for approved read-only measurements;
- no proof assessment, practical, oral-defense, simulation, or cohort rows were written to production;
- no authority transfer, certification cutover, or student-state behavior was changed in production;
- all synthetic identities are namespaced with `proof-*` identifiers.

## Synthetic persisted cohort

The four-assignment fixture exercises agreement, disagreement, missingness, and critical lineage.

| Assignment | Battle Test | Capability | Expected overall classification |
| --- | --- | --- | --- |
| Alpha | Ready | Ready | `agree_ready` |
| Bravo | Ready | Integrity block | `integrity_disagreement` |
| Charlie | Observed but incomplete | 2/33 cells, no practicals or Oral V2 | `missing_comparison_evidence` |
| Delta | Not ready | Ready | `capability_only_ready` |

The reviewer path retains all four candidates in the denominator. The 16-assessment projection may produce 35 source rows for complete assignments because two cells have approved overlapping coverage; the Sprint 19 collapse resolves those rows to 33 unique evidence cells.

## Empirical integrity matrix

| Contract attacked | Runtime observation | Result |
| --- | --- | --- |
| Newer failed digital attempt invalidates an older pass | Alpha remained 33/33 observed but fell to 32/33 satisfied and `battle_test_only_ready` | Pass |
| Active bank rotation invalidates retired-bank credit | Retired-version evidence stopped contributing current credit | Pass |
| Legacy Sprint 1-7 keys cannot mint V2 credit | Initial persisted attack exposed a defect; allowlist fix reduced Charlie from 2/33 to 1/33 during attack; restoration returned the fixture to 2/33 | Fail, fix, pass |
| Newer `repeat_required` practical invalidates older approval | Alpha became Capability Not Ready while digital evidence remained 33/33 | Pass |
| Stale Oral V2 brief is rejected after evidence changes | Previously issued brief returned HTTP 409 after a passing evidence-state change | Pass |
| Cross-pod TD access is rejected | Out-of-scope reviewer failed closed | Pass |
| Missing evidence remains visible and cannot become READY | Charlie remained in the denominator and incomplete | Pass |
| Current critical evidence cannot be hidden by overlapping passing evidence | Bravo remained 33/33 observed, 32/33 satisfied with critical lineage visible | Pass |
| Cohort filters cannot alter headline denominators | Candidate, comparable, and incomplete headline counts remained invariant | Pass |
| Reviewer role and scope boundaries | Specialist and CEO failed closed; COO, HR, and in-scope TD were allowed | Pass |
| Specialist simulation payload excludes evaluator secrets | Owned GET returned HTTP 200 with five decisions and no forbidden evaluator/internal fields | Pass |
| Cross-assignment Specialist access is rejected | Specialist request for Alpha returned HTTP 403 | Pass |

Every temporary destructive attack was restored after observation. The canonical four-assignment fixture remained intact.

## Private Sandbox Simulation bank

The recovered canonical `sandbox_foundation` V1 artifact was accepted only after its source SHA-256 and persisted content were verified.

- SHA-256: `70ed77704f666f2588cb3eee3f9019a3ea13d774ecb25ce03cf7b928831da462`
- scenarios: 13/13 matched recursively
- decisions: 65/65
- maximum attempts: 6
- retry cooldown: 0
- all scenarios: fictional and active

The bank was loaded inactive, verified against the source, and activated only after all checks passed.

## Specialist runtime proof

The dedicated `proof-login-specialist-assignment` fixture was moved to Sandbox mode without modifying Alpha, Bravo, Charlie, or Delta.

The real authenticated Specialist path demonstrated:

- owned simulation GET: HTTP 200;
- deterministic generated form: five decisions;
- forbidden request-payload field scan: empty;
- cross-assignment GET for Alpha: HTTP 403;
- attempt submission: HTTP 201;
- attempt number: 1;
- returned authority flag: `false`;
- forbidden result/history field scan: empty;
- history GET: HTTP 200;
- persisted attempt count: 1;
- persisted simulation form and scenario lineage: present;
- persisted authority flag: `false`.

The forbidden-field scans covered answer keys, critical-fail keys, critical-boundary keys, risk mappings, explanations, internal competency and Deep Dive cues, decision results, critical-fail result keys, boundary results, and covered-Deep-Dive lineage.

Localhost initially failed closed because `CAPABILITY_SIMULATION_SECRET` was absent. A new local-only server secret was generated without printing or committing it. `.env.example` now documents the required server-only configuration.

## Automated verification

At the report checkpoint, PR #45 reported successful Capability Engine, Response Snapshot, Production Link, and Vercel checks. Focused Sandbox Simulation generation, projection, server-boundary, and client-boundary verification passed 17/17 tests after the runtime configuration correction.

Automated tests support but do not replace the persisted HTTP observations above.

## Unresolved evidence boundary

The exact private 895-item Capability assessment corpus has not been recovered and has not been regenerated or falsely labelled canonical.

Known acceptance identities:

- mastery: 11 assessments / 495 items, SHA-256 `59a91cd16fc5723ccc258e17cc314afa558d5b10ae56db2bd00724c8ac751d1c`;
- cumulative: 5 assessments / 400 items, SHA-256 `461fd65dfd7bcfbad3a68c98f933597cbdf80441927ffdd0db270840bca560d2`;
- combined release package: SHA-256 `8ef60b71fe42112eeb91b09051e2ccf96a4cddd5dd10e62d77e6577ea73b5a52`.

Until those exact bytes are recovered and hash-verified, the following remain incomplete:

1. persisted real-HTTP assessment form and result capture against the release-grade private banks;
2. Capability evidence generation or replay for the minimized, de-identified production-derived 14-assignment cohort;
3. paired production-derived concordance analysis;
4. any statistical analysis plan or inference about equivalence, superiority, predictive validity, or cutover.

The 14-assignment production snapshot remains the required analytical denominator: 12 assignments with Battle Test evidence and 2 explicitly incomplete assignments. Critical-signal assignments may not be removed or normalized away.

## Decision boundary

The synthetic proof establishes that the Sprint 19 implementation can preserve current-evidence selection, critical lineage, missingness, reviewer scope, payload secrecy, deterministic simulation persistence, and non-authoritative behavior against isolated persisted data.

It does not justify Capability cutover. The next valid gate is recovery of the exact 895-item private assessment release package, verified against the known hashes. Only then may the release-grade HTTP assessment journey and production-derived 14-assignment replay proceed.
