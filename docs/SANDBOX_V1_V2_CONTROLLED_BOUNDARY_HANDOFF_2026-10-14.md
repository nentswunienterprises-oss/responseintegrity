# Sandbox Student 1 — controlled V1 to V2 boundary transition

**Authorization:** Founder approved a controlled transition on 2026-10-14.
**Scope:** Capability Proof only. No Production DB or main-branch changes.

## Recorded operating truth at authorization

- Synthetic student: `828a5609-462c-4772-841a-0590ceb6a84e` (Sandbox Student 1).
- Trajectory: `85965869-0d56-4b9d-99a6-1dac13b381ed`.
- Tutor assignment: `836a839f-2f29-45c7-b8c2-aa501c95e1b0`.
- Active topic: `geometry`; phase: Time Pressure Stability; stability: High.
- Historical behavior model: **V1**. Accepted reps: **26**. Completed evaluations: **3**.
- Current Session 4: **8/9 reps accepted**. The ninth, unsubmitted rep displayed an explicitly rejected fictional task-display glitch. **Do not submit or fabricate this rep.**

## Code correction (development branch only)

- Future, **unsubmitted** V1 reps can no longer select the retired fictional patterns 7 or 8. Stored V1 rows are untouched.
- V1 form identity includes a retired-exception revision. Previously displayed pre-correction forms must be reloaded; stale submissions fail closed.
- The approved V1-to-V2 upgrade requires a private, explicit authorization and can activate **only after** all nine Session 4 reps, their matching private outcome truth, the Session 4 evaluation, and the exact completed/consumed Sandbox training booking exist.
- Activation preserves the same persistent trajectory, topic lanes, phase/stability, previous Specialist state, and all historical rows. It updates only the current model version and writes a private receipt recording the historical V1 boundary, rep/session counts, and stored row fingerprints.
- If the protected table or approval is unavailable, no upgrade occurs. A new session or model cannot be fabricated to satisfy the gate.

## Protected database prerequisite: currently NOT APPLIED

The new private transition authority has a **Proof-only proposal**:
`docs/migration-proposals/20261014122500_sandbox_v1_v2_boundary_transition.sql`.

The connector's DDL action was **blocked by platform safety checks**. Do not bypass it through an unreviewed SQL or deployment route. Have the authorized DB operator apply and independently verify this proposal through the approved protected Capability Proof migration process. This migration is intentionally **not** registered as an authorized Production migration.

After the authorized migration, stage the approved, narrowly scoped transition **before** the final rep, only if the snapshot still matches:

```sql
WITH eligible AS (
  SELECT t.id,t.tutor_assignment_id,t.tutor_id,t.student_id
  FROM public.specialist_sandbox_trajectories t
  JOIN private.specialist_sandbox_trajectory_truth truth ON truth.trajectory_id=t.id
  WHERE t.id='85965869-0d56-4b9d-99a6-1dac13b381ed'
    AND t.student_id='828a5609-462c-4772-841a-0590ceb6a84e'
    AND t.tutor_assignment_id='836a839f-2f29-45c7-b8c2-aa501c95e1b0'
    AND t.status='active' AND t.session_number=4 AND t.completed_rep_count=26
    AND t.active_topic_key='geometry' AND truth.behavior_model_version=1
    AND (SELECT COUNT(*) FROM public.specialist_sandbox_rep_events e
         WHERE e.trajectory_id=t.id AND e.session_number=4)=8
    AND (SELECT COUNT(*) FROM public.specialist_sandbox_session_evaluations ev
         WHERE ev.trajectory_id=t.id)=3
    AND NOT EXISTS (
       SELECT 1 FROM public.specialist_sandbox_session_evaluations ev
       WHERE ev.trajectory_id=t.id AND ev.session_number=4
    )
)
INSERT INTO private.specialist_sandbox_behavior_model_transitions (
  trajectory_id,tutor_assignment_id,tutor_id,student_id,
  from_version,to_version,completing_session_number,
  accepted_rep_count_at_approval,expected_rep_count_at_boundary,
  status,authorization_reason
)
SELECT id,tutor_assignment_id,tutor_id,student_id,
       1,2,4,26,27,'pending',
       'Founder approved evidence-preserving V1 to V2 transition at Session 4 completion (2026-10-14).'
FROM eligible
ON CONFLICT (trajectory_id) DO NOTHING
RETURNING trajectory_id,status,completing_session_number,
          accepted_rep_count_at_approval,expected_rep_count_at_boundary;
```

**Expected result:** exactly one row, status `pending`. If zero rows, stop and investigate drift instead of changing the expected counts.

## Acceptance sequence

1. Deploy matching development runtime to Capability Proof and ensure the private table/approval are available. Production remains unchanged.
2. Reload the currently unsubmitted final rep; verify the display glitch wording has disappeared and a genuine student response is visible. Do **not** reclassify, delete, or repair the first 26 rows.
3. The Specialist must genuinely observe and confirm Rep 9 under the existing Session 4 booking. No agent should submit evidence on their behalf.
4. The normal finalizer must persist Session 4 evaluation and retire the actual confirmed booking, producing rep count 27, evaluation count 4, and next session 5.
5. The next authenticated Sandbox read applies the transition exactly once, using the same finalizer advisory lock. It verifies the final rep's outcome is ordinary (patterns 1–6), no rep exists in Session 5, and the booked completion was recorded.
6. Read back the private receipt and recompute the historical V1 rep/truth/evaluation fingerprints. Confirm current truth version 2, Session 5, same trajectory and geometry topic, and no lost rows. Refresh the next rep and verify a V2-authored response.
7. Negative tests: premature call at 8/9 does not upgrade; no booked completion, evaluation, truth, or approved authorization cannot upgrade; replaying stale legacy form fails; any attempt to overwrite historical evidence remains disallowed.

**Do not claim activated until Step 6 is independently verified.**
