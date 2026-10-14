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

## Remote progress on 14 October 2026

- Approved patch published at `7102a09ecb1706662f9a08eef082c6c8f486f2cc`. A transfer truncation in the canonical document was restored at `59a5875514941fb228e51e79fce24b41ae962c8a`; the remote blob hash `b0a2ddd4123ece99a83aa0b0d72efee387092e9c` matches the complete local source.
- Seven new inactive Proof copies applied through the committed SQL. The actual readback passed all nine bank content/Blueprint/parity gates in workflow run `38494209603`, attempt 2. Its later source test used the earlier truncated-document head, so that attempt is not a whole-workflow acceptance.
- All nine standard CI workflows passed on the restored `59a58755` head. The dedicated bank-quality workflow is being triggered on the complete current head.

## Remaining release gates

- New copies remain inactive; no Production bank, historical attempt or real Specialist record has changed.
- Exact-head dedicated CI, authenticated final Sandbox/lesson acceptance, protected bank promotion, merge and deployed Specialist readback remain required. Local simulated-bank validation does not establish those gates.

## Exact continuation

1. Publish this bounded patch to the existing branch with an expected-head lease; preserve unrelated branch work.
2. Apply the source-controlled `docs/migration-proposals/20261013_exception_semantic_acceptance_proof.sql` only in Capability Proof, then run the dedicated nine-bank audit on actual readback. Refuse unexpected bank/version/content drift.
3. Prove final current lesson and rare worked-example behavior through a controlled authenticated Proof Specialist route. Do not manufacture real qualification evidence.
4. Prepare a hash-pinned promotion through the protected repository release procedure. Preserve the exact historical pass continuity; never use direct Production SQL as a substitute for the protected promotion path.
5. Release only after CI and controlled acceptance pass. Confirm deployed lesson/bank authority and unchanged earned progression before closing OS-wide cleanup.
