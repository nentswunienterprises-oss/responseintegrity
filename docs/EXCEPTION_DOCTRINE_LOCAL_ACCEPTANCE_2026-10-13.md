# Exception doctrine: local acceptance and release boundary

Base: `fb9b0884628282e090c56b6070b0b464388a7a52`, `fix/preview-training-session-authority`.

## Implemented locally

- Reconciled all 44 staged content changes in nine banks against prompts, accepted answers, feedback and explanations. Corrected nine items, including reversed prompt polarity, duplicated wording, preservation of clean dimensions and separate intervention/reference lineage. Seven new inactive bank copies are proposed; no historical bank or attempt is edited.
- Replaced the stale total-only audit with exact item identities, pinned predecessor/successor versions, unchanged configuration authority and SHA-256 fingerprints of reviewed content. Full private bank exports are excluded from the patch.
- Identified and repaired one separate pre-existing Transfer critical-metadata omission in the proposed successor: `ost2_training_purpose_01`, `training_purpose.no_stop_at_clarity`, existing wrong option `e`. Correct answers remain `a,c`; historical outcomes remain untouched.
- Pinned all nine editorial pass-continuity paths to the reviewed successors. Failed attempts, unrelated banks, earlier unapproved versions and later unapproved rollovers remain ineligible.
- Audited 20 established lesson routes, the additional Curriculum v2 training-purpose lesson, the introduction, and imported infrastructure formative questions. Current Vite resolution prefers TSX/TS over archived JSX/JS. Corrected yes/no and interpretation answer grammar. Imported formative checks are now audited from their actual shared data, including positive-feedback consistency. Seven imported questions receive distinct alternate valid answers; the unchanged OS-wide 70–90% standard now passes at 32/42 single-choice questions.
- Extended the dedicated workflow trigger and acceptance tests to current lesson sources, imported formative content, earned-pass continuity, Sandbox and Practicals.

## Verified locally

- 82 focused tests passed: lesson module loading, current lesson surfaces, formative authoring, exact editorial continuity, sequencing, V2 Training/Diagnosis/Handover simulation and Practicals V2. Historical V1 replay remains covered.
- Capability suite: 130 tests passed.
- Frontend build, public prerender and backend bundle passed. The npm build wrapper encountered a local tsx IPC `EPERM`; executing the same generation/prerender scripts with `node --import tsx` completed successfully.
- All nine proposed banks passed the full audit against read-only Capability Proof connector snapshots: 443 items, 44 content changes, canonical Blueprint coverage, option parity, feedback, preserved configuration/answer authority and the explicitly named critical metadata repair. This was a local dry run of proposed inactive copies, not a database write or live acceptance receipt.
- A deliberately altered correct-answer key was rejected by the audit. No approval gate was weakened.

## Not completed

- No remote commit/ref update succeeded. Automatic approval review rejected the attempted GitHub tree write, treating public-repository disclosure as insufficiently authorized. The revised manifest now exports hashes rather than full private-bank content; the SQL contains only nine new authored item corrections and the separate metadata repair.
- No new Proof copies have been applied from this patch. No Production banks, attempts, Specialist records or progression were changed.
- Exact-head dedicated CI, authenticated final Sandbox/lesson acceptance, protected bank promotion, merge and deployed Specialist readback remain required. Local simulated-bank validation does not establish those gates.

## Exact continuation

1. Publish this bounded patch to the existing branch with an expected-head lease; preserve unrelated branch work.
2. Apply the source-controlled `docs/migration-proposals/20261013_exception_semantic_acceptance_proof.sql` only in Capability Proof, then run the dedicated nine-bank audit on actual readback. Refuse unexpected bank/version/content drift.
3. Prove final current lesson and rare worked-example behavior through a controlled authenticated Proof Specialist route. Do not manufacture real qualification evidence.
4. Prepare a hash-pinned promotion through the protected repository release procedure. Preserve the exact historical pass continuity; never use direct Production SQL as a substitute for the protected promotion path.
5. Release only after CI and controlled acceptance pass. Confirm deployed lesson/bank authority and unchanged earned progression before closing OS-wide cleanup.
