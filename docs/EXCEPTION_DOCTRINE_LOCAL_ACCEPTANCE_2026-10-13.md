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

## Protected release preparation and authenticated readback

- Dedicated Evidence Exception Bank Quality run `38494615279`: complete workflow **PASS**, including actual nine-bank readback and lesson/simulation/continuity tests.
- Protected Evidence Exception Bank Promotion Plan run `38495508183`: **PASS**. All nine active Production predecessors match the Proof predecessor hashes; all nine proposed Production successors are absent. The workflow supports only a read-only plan or separately dispatched inactive stage; it cannot activate banks.
- Authenticated readback run `38495942394`: **PASS**. Exact runtime SHA `59a5875514941fb228e51e79fce24b41ae962c8a`, all 21 lessons and 313 slides, ordinary Training forms in all four phases, the actual native Training runner, and deterministic rare worked-example witnesses in Diagnosis and Handover. Zero rep or qualification submissions. Existing synthetic history remained unchanged. Private assignment/student identifiers are resolved at runtime rather than embedded in the current script.
- Preview protection credentials are available through the existing `production-db` environment; no protection setting was disabled and no new bypass credential was exposed.
- The separately approved Google identity fix on main is incorporated in development. Its brittle metadata assertion now accepts valid multiline HTML while retaining the exact identity requirement.

## Remaining release gates

- New copies remain inactive; no Production bank, historical attempt or real Specialist record has changed.
- Protected inactive Production staging, a bounded matching application release, bank activation and deployed Specialist readback remain required. The application release must include earned-pass continuity before activating corrected banks.
- The GitHub connector supports workflow reads and retries but exposes no workflow-dispatch action. Do not replace protected promotion with direct Production SQL or an apply-on-push shortcut.

## Exact continuation

1. Publish this bounded patch to the existing branch with an expected-head lease; preserve unrelated branch work.
2. Apply the source-controlled `docs/migration-proposals/20261013_exception_semantic_acceptance_proof.sql` only in Capability Proof, then run the dedicated nine-bank audit on actual readback. Refuse unexpected bank/version/content drift.
3. Prove final current lesson and rare worked-example behavior through a controlled authenticated Proof Specialist route. Do not manufacture real qualification evidence.
4. Prepare a hash-pinned promotion through the protected repository release procedure. Preserve the exact historical pass continuity; never use direct Production SQL as a substitute for the protected promotion path.
5. Release only after CI and controlled acceptance pass. Confirm deployed lesson/bank authority and unchanged earned progression before closing OS-wide cleanup.
