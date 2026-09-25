# Sandbox V1R1 Reconciliation — 2026-09-25

## Purpose

Build the current Specialist Development Sandbox from current `main` after the Training Capability Engine gate closed.

The current pathway is:

**Application → Training → Sandbox → Practicals → Trial → Certification → Certified Live**

Training Capability Checks prove understanding. Sandbox is a distinct deterministic drill-simulation environment that proves whether a Specialist can observe and operate the RI evidence system against predefined student behaviour.

## Architecture boundary

This implementation does **not** revive the older decision-questionnaire Sandbox simulator.

Sandbox V1R1 instead:

- uses private, versioned simulated student behaviour;
- uses the current live RI Training drill registry for sets, reps, constraints, observation dimensions and option identities;
- asks the Specialist to record what occurred through the same semantic evidence contract used by live Training;
- runs the Specialist record through the current evidence-native Training evaluator;
- compares the Specialist record with the private canonical simulated record;
- compares the resulting RI system outcome, not only individual field selections;
- never mutates a real student topic state;
- stores Sandbox evidence separately from live student evidence.

## Initial proof scope

The first proof bank is intentionally small. It is sufficient when it proves:

1. private scenario truth is not exposed to the Specialist;
2. a deterministic scenario loads only for a Specialist in Sandbox mode;
3. simulated behaviour is presented rep-by-rep inside real RI set/rep structure;
4. the Specialist can record every live RI observation dimension;
5. exact observation fidelity is computed against canonical truth;
6. the Specialist's submitted record is evaluated by the real RI evidence engine;
7. the resulting system outcome is compared against the canonical outcome;
8. the immutable Sandbox attempt persists;
9. the simulation cannot change real student state;
10. the next attempt deterministically rotates to the next scenario.

Scenario-library expansion, full Sandbox graduation criteria and Practicals are separate gates after this mechanism is proven.
