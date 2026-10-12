# Sandbox student behavioural continuity V2 — review checkpoint

Date: 2026-10-12  
Scope: `fix/preview-training-session-authority`, **Response Integrity Capability Proof only**. This is not a Production approval, not a main merge, and not a declaration of authenticated browser acceptance.

## Why this exists

The original six synthetic student profiles changed weighted response classes but did not make earlier observations constrain later behaviour. The active Proof Training bank contains 264 version-1 authored outcomes; on 12 October, none declared previous-class constraints or required/excluded continuity tags. Storing continuity without consuming it did not prevent a simulated instant recovery.

## Approved bounded implementation

1. **Identity:** The V1 hash-to-profile assignment order is pinned. The same private trajectory seed resolves the same person across Training, Diagnosis, and Handover. V2 selection does not expose the profile or hidden scoring to the Specialist.
2. **Versioning:** New trajectories created by the updated branch receive `behavior_model_version = 2` in `private.specialist_sandbox_trajectory_truth`. Existing trajectories remain V1; their already-issued rep choices are not silently recalculated under V2. Database additive migration: `docs/migration-proposals/20261012_sandbox_behavior_model_v2.sql`.
3. **Evidence-constrained recovery:** V2 rejects an immediate clean `supported` response after `breakdown`. An intervening `not_observed` or `confounded` outcome while `recent_breakdown` remains is not recovery. Observed `near_stable` or `conditional` response permits subsequent clean recovery.
4. **Observable signatures:** Audited V1 scenario patterns receive profile-specific weighting where the natural vignette actually displays the tendency: weak Clarity interpretation, reassurance requests under independent execution or difficulty, timed collapse, controlled recovery and steady independence. No student-facing behaviour is rewritten or manufactured for convenience.
5. **Cross-mode safety:** V1 Diagnosis/Handover selection remains unchanged; V2 derives the profile from the private seed, but applies phase-specific tendencies to the **actual diagnosis probe phase**, not the general starting phase. Diagnosis does not use Training's recovery hard gate; it must faithfully observe current evidence across potentially different dimensions.
6. **Boundary:** Student topic authority stays separate from Specialist capability readiness and from real student state. No Sandbox evidence qualifies as Production training evidence. No automatic Practicals transition.

## Verified Proof database state

After the additive migration, readback returned **4 existing trajectories**, all **4 still V1**, with **0 V2 activations**. The existing **55 historical rep events** were not altered. The private truth table has RLS enabled; neither `anon` nor `authenticated` can SELECT it.

## Bank-level deterministic rehearsal (read-only)

Using only non-secret outcome-selection metadata from the 264 active Proof outcomes, reproduced the V2 selector's scoring and continuity rules across **720 synthetic profile/phase runs** and **17,820 simulated rep selections** (all six profiles; all four phases; repeated sets and sessions).

Results:
- Missing eligible candidate pools: **0**
- Immediate clean responses following a breakdown: **0**
- Clean responses treating an unresolved evidence gap as recovery: **0**
- Anomalous not-observed/confounded opportunities retained: **2,905**

This is a **deterministic algorithm rehearsal** of the Proof bank, not a completed authenticated browser/API acceptance. It tests coverage and transition safety, not the quality of live Specialist judgement.

## Automated CI evidence

[Sandbox Simulation CI](https://github.com/nentswunienterprises-oss/responseintegrity/actions/runs/38241671325) completed successfully for the branch commit containing V2 recovery and V1 legacy test coverage. Its workflow runs `npm run test:sandbox`, a Vite frontend build, and the preview API build. Further commits must retain green CI.

## Still required before closure

- Create a genuinely provisioned, controlled **new V2 Sandbox test student** through the supported authenticated workflow (no manually fabricated state).
- Complete normal live-runner opportunities across Diagnosis/Handover/Training and more than one topic; verify selected behaviour, state persistence, repeatability and Specialist observation/evidence boundaries.
- Inspect the resulting student-facing narratives for six distinctly recognisable conduct patterns, especially pressure collapse, reassurance seeking, fast recovery and uneven performance.
- Verify refresh and topic A→B→A maintain the same private student identity and preserve independent topic capability states.
- Record readback and negative-access evidence. Only then request Founder acceptance. Do not promote to main or Production without that evidence.

Tracking: [Issue #184](https://github.com/nentswunienterprises-oss/responseintegrity/issues/184).
