# Capability Engine Sprint 16 - Shadow Cutover Comparison

## Objective

Prove how the Capability Engine compares with the current authoritative Battle Test / Sandbox pathway without changing authority.

## Rules

- current Battle Test and Sandbox Mock Gate remain authoritative
- Capability Engine remains `authoritative: false`
- no automatic certification, Trial opening, operational-mode mutation, or student-state mutation
- no Supabase write or migration application during branch development
- no merge to `main`

## Target proof

Build a deterministic, read-only comparison that can answer for a Specialist:

1. What does the current authoritative pathway say?
2. What does the Capability Engine shadow evidence say?
3. Where do they agree?
4. Where do they disagree?
5. Is the disagreement caused by missing evidence, version drift, integrity escalation, or a substantive readiness mismatch?
6. What evidence would be needed before any future cutover decision could be justified?

The comparison must never turn disagreement into an automatic authority change.
