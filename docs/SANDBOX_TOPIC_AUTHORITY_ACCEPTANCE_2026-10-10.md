# Sandbox selected-topic authority acceptance

Date: 2026-10-10
Scope: Proof and local Specialist Sandbox; **not Production or The Hub**.

## Reproduced discrepancy

On Sandbox Student 1, the Specialist selected **Geometry / Time Pressure Stability / High** through Start Session, but Sandbox session 4 rendered **Training Drill – Clarity**, including Clarity sets.

The launch URL and UI were correctly routed; the server's `planNextRep` used the *student-wide canonical_phase* rather than the selected topic's recorded state.

Proof confirmed:
- Geometry: TPS / High, with persisted topic history.
- Linear Equatins (historical spelling): Clarity / High with separately earned exit-confirmation eligibility.
- The three previously completed Sandbox sessions belong to Linear Equatins, determined by matching their immutable session evaluation IDs to recorded topic history.
- Session 4 had no rep submissions at repair time.
- Current Sandbox outcome bank includes 72 active TPS outcomes across three sets.

## Corrected state boundaries

1. A Sandbox synthetic student keeps **one** longitudinal trajectory and one Specialist capability record.
2. Each **topic** has an independent Specialist state and **private** canonical simulated-student state.
3. A selected topic starts at its own previously observed state. The server never trusts a client URL's requested phase or stability as state authority.
4. All topic switches are atomic and preserve the outgoing phase, stability, progression gate, rediagnosis route, and private simulation continuity. Returning to that topic restores those values.
5. Topic switches are prohibited after a rep of the current scheduled session has begun. A stale or mismatched rep submission is rejected.
6. Unobserved topics and prerequisite-contradicted topics must take the appropriate diagnosis route, not an invented Training placement.
7. Completed Sandbox sessions and reps are attributed to the topic they actually trained. Specialist capability evidence remains cumulative across a simulated student's opportunities; topic stability does not.
8. The previously approved **Low / Medium / High + independent progression eligibility** remains the only new-state representation. No transfer claim or phase exit is created by selecting a topic.

## Proof migration

The additive proposal `docs/migration-proposals/20261010_sandbox_topic_state_lanes.sql` was applied to **Response Integrity Capability Proof** (`jftlxeacphvbnhbsbpxc`) as `proof_sandbox_topic_scoped_lanes_20261010`.

Confirmed readback:
- The existing Student 1 trajectory was preserved at session 4; the active topic was attributed to `linear equatins`.
- Its three completed sessions now carry that topic's provenance. Session 4 still has zero completed reps.
- The Specialist and private canonical lanes have separate JSONB state containers with validated object constraints.
- Both private and public trajectory/evidence tables retain RLS and deny direct anon/authenticated reads and writes.
- No completed session status, billing ledger, historical stability decision or immutable rep evidence was changed.

## Local acceptance

Pull the feature branch, run the local dev app against **Proof only**, and open the same confirmed scheduled training session for Geometry.

Expected:
- **Training Drill – Time Pressure Stability**; **Geometry**; **Sandbox session 4**; **0/9 reps**, assuming the TPS form's three sets of three reps.
- No Clarity rule, prompt, or rep set appears for Geometry.
- Historical Sandbox sessions 1–3 remain labelled Linear Equatins / Clarity and retain their prior authority.
- Re-selecting an observed Linear Equatins session *before* session 4 starts restores the Clarity / High / exit-confirmation-eligible lane.
- Switching topics after the first rep is blocked, rather than silently changing the simulated condition.
- Session completion persists Geometry evidence and current topic state without consuming or rewriting Linear Equatins evidence.

These are acceptance checks to run in the authenticated local app. **GitHub CI and database readbacks are not substitutes for that browser/API session.**

Vercel has reported its daily deployment limit; the newest change is not yet in the hosted preview.
