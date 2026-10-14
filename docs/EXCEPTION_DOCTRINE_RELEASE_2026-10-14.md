# Exception doctrine release — 14 October 2026

This branch isolates the approved exception cleanup from the broader development branch, preserving main's approved Google SEO changes. It removes authored missing-observation theatre, retains actual evidence-validity statuses and historical replay, and limits the rare learner confound to a visible worked mathematical example supplying the intended method or step.

## Verified scope

Nine inactive Proof banks contain 443 items, including 44 reviewed content corrections. The version and content authority is pinned in `qualification-content/20261014_evidence_exception_promotion_hashes.json`; the reviewed item inventory contains hashes rather than exported private assessment content. Editorial continuity preserves only explicitly approved prior passes. Failed and unapproved prior attempts cannot qualify. Transfer's existing wrong training-purpose choice is now correctly critical; the correct answer set is unchanged.

The authenticated Proof readback on development runtime `59a5875514941fb228e51e79fce24b41ae962c8a` passed all 21 lesson routes (313 slides), all four ordinary Training forms, the native Begin Rep UI and deterministic Diagnosis/Handover worked-example witnesses. It made no qualification or rep submissions. This is development evidence; the isolated release requires its own exact-SHA authenticated readback.

## Schema prerequisites

The three managed migrations must be promoted with Production DB Promotion before this runtime:

1. `20261014013817_sandbox_topic_state_lanes.sql`: independent topic lanes; historical attribution only from exact immutable session IDs in persisted topic history. Ambiguous or unlinked history remains unattributed.
2. `20261014013826_sandbox_progression_authority.sql`: separates current Sandbox stability from earned exit eligibility. Existing High Maintenance current trajectory labels become High plus exit-confirmation eligibility. Historical evaluations remain unchanged. This includes a justified current-state normalization, not just added columns.
3. `20261014013834_sandbox_behavior_model_v2.sql`: existing trajectories retain V1; new runtime trajectories explicitly elect V2. It never rewrites a historical response.

The integration test verifies unchanged evidence and access, preserved earned checkpoints, ambiguous-topic handling, rejection of invalid states and idempotent reapplication. CI runs it on isolated PostgreSQL 17; local verification uses fresh embedded PostgreSQL. The production runner owns all transaction boundaries.

## Required release gates

- Dedicated release CI, private Proof bank-quality audit, and Production bank read-only plan must pass on the release candidate.
- Run the exact-SHA authenticated preview readback through its protected manual workflow. It rejects another SHA or database target.
- Run Production DB Promotion in plan mode, inspect pending migrations/checksums, then apply through the protected environment. Never use `db:push` or direct Production SQL as a substitute.
- Stage the nine reviewed banks inactive using Evidence Exception Bank Promotion (`stage`, confirmation `THE_HUB_STAGE_EXCEPTIONS`). Recheck all content/config hashes, predecessor versions, item counts and inactive status.
- Deploy the reviewed runtime and separately activate the matching reviewed banks through the approved bank release process. Inactive staging alone is not activation or task completion.
- Read back actual Production runtime, active banks, historical pass continuity and earned Sandbox progression before closing the release.

Production schema application, inactive staging, deployment and bank activation are pending. The broader development PR is not the merge vehicle. GitHub's connected tools support PRs and CI readback but do not expose manual workflow dispatch; the protected workflows still require their normal dispatch mechanism.
