# RI Capability Stability and Progression Authority Separation

Status: Founder approved 2026-10-10. **Implementation staged; not Production-authorized.**

## Locked meaning

- **Stability** is one of `Low`, `Medium`, `High`. It describes the phase-critical capability currently supported by qualifying evidence.
- **Progression authority** is independent:
  - `building`: repeatability/phase-exit eligibility has not yet been established.
  - `exit_confirmation_eligible`: a later qualifying session while already High has separately established sustained evidence. This is the function historically encoded as `High Maintenance`. It **does not** authorize phase exit.
  - `transfer_maintenance`: valid only in final phase Time Pressure Stability after a further, separate qualifying exit/transfer-maintenance confirmation. It does not create a fifth phase.
- A qualifying session first establishes High; a **later** qualifying session may establish exit eligibility; a **further** qualifying session may authorize exit. None of these may be minted by the same submission.
- At phase exit, the next phase begins Low with progression `building`. Entry/exit evidence requirements, invalid observations, support/confounding and targeted re-diagnosis gates remain unchanged.
- On weakening, the progression checkpoint is cleared. From prior High + `building`, an observed Low/Medium results in Medium. From prior High + `exit_confirmation_eligible`, observed Low/Medium results in High plus `building` (matching the historical cautious single-session regression). A later session can lower further.
- `not_observed` and `confounded` do not create negative evidence or eligibility.
- Historical `High Maintenance` maps to High + `exit_confirmation_eligible`; no qualification is retroactively granted from a score.
- History, immutable evidence and historical API snapshots must retain original values. Read-compatible projections may interpret legacy state; **do not rewrite historical evidence**.

## Implementation authority

The canonical pure function is `transitionCapabilityProgression` in `shared/capabilityProgressionAuthority.ts`. The evidence evaluator exposes an independent `progressionTransition` and retains `predictedTransition` as legacy interop.

The Sandbox Specialist and private canonical truth tracks persist **separate columns** for stability and progression. Frontend display uses Low/Medium/High and a separate status/confirmation badge. Legacy score-based transition code remains a historical compatibility path and is not authority to mint progression from numeric scores.

## Release gates

1. Approve the schema-first migration proposal `docs/migration-proposals/20261010_separate_sandbox_progression_authority.sql` for the intended Proof database (never The Hub by accident).
2. Apply and verify the columns, constraints, backfill and legacy checkpoint readback; confirm all previously eligible records preserve their status, and all non-High progression combinations are rejected.
3. Release matching code only after the schema is ready; check that existing Sandbox trajectories continue and new sessions preserve independent Specialist/hidden canonical progression state.
4. Prove three distinct qualifying sessions: High, exit eligible, exit confirmed. Confirm lower evidence clears the gate and targeted re-diagnosis holds both fields.
5. Verify parent, Specialist, Student, Map, Response Snapshot and Sandbox output all reflect the same dual authority without leaking private canonical truth.
6. Keep Production DB migration authority closed until The Hub-specific approval, migration registration, readbacks and negative-access verification.

No migration has been applied by adding this document or code branch. No readiness gate is considered proven solely from CI.
