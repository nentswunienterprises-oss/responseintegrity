# Capability Engine Sprint 16 - Pre-Mock Capability Dossier

## Decision

The first cutover-evidence surface is not a replacement readiness verdict. It is a factual, read-only dossier displayed to the existing human Sandbox Mock reviewer immediately beside the authoritative Mock Gate.

This preserves the separation between:

- Capability Engine evidence: automated, practical, oral and simulation evidence gathered before the Mock; and
- Sandbox Mock authority: the five human criteria and the explicit COO decision that alone can open Trial.

## Authority contract

The dossier always returns:

- `authoritative: false`
- `mockRecommendation: null`

Dossier code contains no write route and cannot:

- populate or infer Mock checklist values;
- choose `passed` or `remediation_required`;
- record a Sandbox Mock assessment;
- open Trial;
- certify;
- update `operational_mode`;
- update student state;
- override Battle Test progression.

The existing Mock card remains the only human decision surface.

## Scope

The dossier is available only on the COO Sandbox Mock reviewer surface and only for a Specialist with one unambiguous assignment whose `operational_mode` is `sandbox`.

Zero Sandbox assignments fails closed.

More than one Sandbox assignment also fails closed rather than guessing which assignment should be reviewed.

## Pure selection core

`shared/capabilityMockDossier.ts` owns the read-only evidence-selection rules independently of the database.

The core:

- filters assessment evidence to the active bank version before selecting latest attempt;
- filters practical evidence to the current proof version before selecting latest attempt;
- filters Oral Defense evidence to the current Oral Defense version before selecting latest attempt;
- filters Sandbox simulation rehearsal to the active simulation bank;
- preserves retired-version counts as stale lineage;
- calculates the 33 evidence-cell status supplied by current Capability readiness;
- detects missing, stale and internally conflicting lineage.

This prevents an old attempt with a higher attempt number from outranking a valid attempt on a new current version.

## 16 automated checks

The dossier follows the approved `CAPABILITY_MVP_ASSESSMENT_PLAN_V1` rather than discovering arbitrary assessment keys.

For every planned assessment it exposes:

- assessment key and title;
- evidence kind;
- covered Deep Dives;
- active private bank version;
- current status;
- latest current-version evidence ID;
- bank version;
- attempt number;
- score;
- critical-fail flag;
- completion timestamp;
- retired-version attempt count.

## 33 evidence cells

All canonical required mastery / retrieval / transfer evidence cells are returned individually and displayed individually.

The dossier also cross-checks cell selection against current planned assessment support. Where detectable it flags:

- a cell marked satisfied without any supporting current planned assessment pass; or
- a cell marked unsatisfied despite a supporting current planned assessment pass.

These are lineage conflicts, not Mock recommendations.

## Practical evidence

Prepare / Execute / Evidence use the current proof versions from `CAPABILITY_PRACTICAL_PROOFS`.

The dossier shows:

- evidence ID;
- proof/rubric version;
- attempt number;
- derived outcome/reason;
- Clear / Partial / Fail / critical-Fail counts;
- submitted/reviewed timestamps;
- reviewer feedback;
- stale historical attempt count.

## Oral Integrity Defense V2

The dossier uses `ORAL_DEFENSE_VERSION` and reads the semantic V2 `critical_fail_count` lineage introduced in Sprint 15.

It does not read or expose V1's reviewer-selected `integrity_concern_count` vocabulary as current V2 evidence.

It shows:

- evidence ID;
- defense version;
- attempt number;
- derived outcome;
- Clear / Partial / Fail / critical-Fail counts;
- feedback;
- completion timestamp;
- stale older-version count.

## Sandbox simulation rehearsal

Simulation remains explicitly `authoritative: false`.

The dossier shows only attempts from the active simulation bank as current rehearsal evidence and separately reports retired-bank history.

For each current attempt it exposes:

- evidence ID;
- bank/scenario version;
- attempt number;
- score;
- rehearsal pass/fail;
- critical-fail flag;
- contamination / authority / escalation counts;
- completion timestamp.

No simulation outcome is converted into a Mock criterion.

## Lineage flags

Flags are factual and typed as:

- `missing`
- `stale`
- `conflict`

Examples include:

- missing active assessment bank;
- no attempt on the active bank;
- retired assessment history;
- missing current practical;
- old practical version history;
- missing current Oral Defense V2;
- old Oral Defense history;
- missing or duplicate active simulation bank;
- stale simulation history;
- impossible assessment `passed + critical fail` state;
- evidence-cell selection mismatch.

A lineage flag never becomes a Mock pass/fail recommendation.

## UI separation

`CapabilityMockDossierCard` is a sibling rendered immediately before `SandboxMockGateCard`'s existing authoritative card.

The dossier has no mutation hook, no checkbox, no Mock decision state and no Mock POST request.

The existing Mock component still owns:

- `SANDBOX_MOCK_CRITERIA`;
- the five checkboxes;
- COO evidence note;
- Remediation required;
- Pass Mock;
- the `sandbox-mock-assessment` POST.

The authoritative Mock component itself is intentionally changed only minimally for the sibling insertion.

## Verification

Sprint 16 includes:

- pure tests for active-version-first selection;
- V1 vs V2 Oral attempt selection;
- missing/stale/conflict classification;
- duplicate active-bank detection;
- evidence-cell consistency checks;
- simulation non-authority;
- server source boundaries proving GET-only/read-only behavior;
- V2 Oral semantic lineage assertions;
- no Mock writer invocation;
- no authority-state mutation vocabulary;
- UI boundaries proving no checklist or decision controls exist in the dossier;
- CI path/test coverage for the sandbox dossier boundary tests.

## Database / deployment

Sprint 16 adds no migration.

It depends only on the prior Capability Engine stack, including Sprint 14 practical rubric lineage and Sprint 15 Oral V2 semantic critical-Fail lineage.

No database write has been made. No migration has been applied. Nothing has been deployed. Nothing is merged to `main`.

Refs #33 #31 #29 #27 #23 #21.
