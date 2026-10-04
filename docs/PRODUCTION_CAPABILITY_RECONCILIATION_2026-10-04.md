# Production Capability Reconciliation - 4 October 2026

**Production project:** The Hub (`yzcnavucvwgmulcxgxvw`)  
**Proof project:** Response Integrity Capability Proof (`jftlxeacphvbnhbsbpxc`)  
**Status:** **COMPLETE FOR THE CURRENTLY FOUNDER-APPROVED TRANSFORMATION CAPABILITY SURFACE**

## Scope

This reconciliation intentionally separates three concerns:

1. application code;
2. application-owned schema;
3. private Capability bank content.

Operational/user data is **not** copied from Proof to Production. Proof fixtures, test users, and other environment-specific data are expected to differ.

## Code

The complete `fix/preview-training-session-authority` branch was merged into `main` through PR #126.

Merge commit:

`999b1617bfd0c3543fdcb63546cbe15517e19316`

The post-merge branch-to-main comparison showed zero file differences.

## Production schema authority

The Hub production migration ledger confirms the four previously managed post-baseline migrations were already promoted:

- `migrations/20260927_diagnosis_activity_context_separation.sql`
- `migrations/2026-09-28_capability_interactive_feedback.sql`
- `migrations/20261001_tps_handover_timing_lineage.sql`
- `migrations/2026-10-02_add_capability_review_mode.sql`

The current repository also contains:

- `migrations/2026-10-03_guard_capability_critical_boundary_requires_fail.sql`

That migration was present in code but was not yet listed in the production authority manifest. This reconciliation adds it to `managedMigrations` as an additive change.

It was applied through the manual **Production DB Promotion** workflow on 4 October 2026 and recorded in the production migration ledger. The live The Hub read-back confirms the constraint is present with the same `NOT VALID` definition as Proof.

## Founder-approved Transformation Mastery content

The following five approved banks were promoted from Proof into The Hub and activated with Review Mode off:

| Assessment | Version | Items | Verified content hash |
| --- | ---: | ---: | --- |
| `topic_conditioning_mastery_v1` | 17 | 45 | `9acaff00d62682c253efc8b1135499a8` |
| `clarity_mastery_v1` | 15 | 45 | `bfffce48eb0dbcbbf1cb2252c4f68002` |
| `structured_execution_mastery_v1` | 14 | 45 | `0cf0b0c9b1efd23ae4ad513bc73db7ab` |
| `controlled_discomfort_mastery_v1` | 14 | 45 | `e9beee970421ac9b15a51bc177f153d4` |
| `time_pressure_stability_mastery_v1` | 14 | 45 | `12247270d809a85722cad3681c98f10a` |

Post-promotion verification confirmed for both Proof and Production:

- 45 items per bank;
- 45 active items per bank;
- 45 distinct item keys per bank;
- 0 critical-boundary items missing a critical-fail option;
- identical content hashes for all five banks;
- active config;
- Review Mode off.

## Deliberately not promoted

The rest of the Proof Capability estate was **not** copied to Production merely for environment parity.

In particular, the cumulative Transformation banks remain outside this promotion until they complete their own Founder review:

- `transformation_phases_retrieval_v1`
- `transformation_state_transfer_v1`

Other unapproved Mastery banks remain governed by the broader Capability Review checkpoint.

## Proof-only schema is not production authority

A direct schema comparison shows Proof contains additional historical/candidate/simulation structures and environment-specific schema drift that are not automatically production authority.

Therefore the target is not a byte-for-byte clone of the Proof database.

The target is:

> same approved application code + same approved application-owned schema + same approved static/private content, while preserving environment-specific operational data and excluding Proof-only experiments.

## Final production verification

The manual **Production DB Promotion** workflow completed successfully.

The Hub production ledger records:

- migration: `migrations/2026-10-03_guard_capability_critical_boundary_requires_fail.sql`
- source commit: `d1d4e48cf410718f39a75cde1ad3c4f876f56209`
- kind: `migration`
- applied by: `github:nentswunienterprises-oss`
- applied at: `2026-10-04 00:25:09 UTC`

Live read-back confirms the constraint exists on:

`private.specialist_capability_assessment_items`

Constraint:

`specialist_capability_boundary_requires_critical_fail`

Its definition matches Proof exactly and remains intentionally `NOT VALID`, so it enforces future inserts and updates without retroactively validating historical retired content.

A final Proof versus Production read-back also reconfirmed all five Founder-approved Transformation Mastery banks have identical content hashes, 45/45 active items, unique item keys, Review Mode off, and zero critical-boundary items missing a critical-fail option.

The currently Founder-approved Transformation Capability surface is therefore reconciled between Proof and Production.
