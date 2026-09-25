# Sandbox V2 — Stateful RI Practice Environment

Date: 2026-09-25
Status: Founder-approved architecture
Replaces: Sandbox V1R2 static-scenario graduation model as the intended permanent Sandbox design

## 1. Stage boundary

Current Specialist pathway:

**Application → Training → Sandbox → Practicals → Trial → Certification → Certified Live**

Sandbox is a protected RI practice world. It must establish that a Specialist can operate the real Response Integrity evidence system accurately over time before they enter Practicals.

Sandbox does not authorize Trial and never mutates real student state.

## 2. Core operating loop

The permanent Sandbox unit is not a prewritten whole-session scenario.

The operating loop is:

`persistent sandbox student state → prescribed RI phase/set/rep → plausible hidden student response → Specialist observation/evidence capture → canonical-vs-recorded comparison → real RI evidence authority → updated sandbox student state → next prescribed opportunity`

The Specialist should experience the same operational rhythm as live delivery:

1. RI prescribes the current condition.
2. The simulated student responds.
3. The Specialist records what happened.
4. The real RI evidence model evaluates the record.
5. The student's simulated trajectory continues from the resulting state.

## 3. Private phase / set / rep Outcome Matrix

Private Sandbox content is authored at:

`phase → set → rep → plausible outcome pattern`

Every scored Training rep must have a sufficiently broad set of coherent student outcomes.

Target authoring range:
- target approximately 8 outcomes per rep;
- normal acceptable range 6–10;
- no padding to reach a number;
- each outcome must represent a materially distinct, believable evidence condition.

The outcome pool is private. Public code may contain schema, validation, selection logic and synthetic test fixtures, but never the canonical live/Proof outcome answer record.

Each private outcome contains at minimum:
- phase;
- live Training set ID;
- rep number / live rep-purpose identity;
- believable student-behaviour text;
- canonical observation option IDs;
- canonical evidence-status truth;
- continuity tags / compatibility conditions;
- selection weight;
- allowed or causal Specialist intervention context where relevant.

## 4. Constrained shuffle, not unrestricted randomness

The Specialist must not know which student response is coming next.

Outcome selection is deterministic, seeded, replayable and constrained by:
- the simulated student's current phase and stability;
- current set and rep;
- recent canonical behaviour history;
- breakdown / recovery continuity;
- active Specialist intervention context;
- plausibility constraints;
- evidence gaps in the Specialist capability record.

The selector may weight under-observed capability conditions more heavily, but it must never fabricate an impossible or incoherent student.

Two identical seeds and state histories must reproduce the same trajectory for audit.

## 5. Persistent simulated student

A Sandbox student persists across reps and sessions.

The environment must not erase prior behaviour at a scenario boundary because there is no scenario boundary in the permanent model.

The student maintains:
- canonical RI topic phase and stability;
- canonical longitudinal evidence history;
- recent behaviour / continuity tags;
- current session/set/rep position;
- seeded trajectory identity;
- canonical outcome history.

Official RI phase/stability movement continues to use the real evidence-native Training evaluator and its existing breakdown, recovery, High Maintenance, progression and prerequisite-contradiction laws.

A rep may update short-horizon continuity state immediately, while official RI topic movement is authorized only when the applicable live Training evidence contract has enough completed evidence.

## 6. Canonical truth vs Specialist-recorded truth

Sandbox maintains two separate tracks.

### Canonical student truth

What the simulated student actually did, using private canonical observations and the real RI evaluator.

### Specialist-recorded RI truth

What RI concludes from the Specialist's submitted observations and evidence-status/intervention record.

The tracks should remain aligned when the Specialist captures evidence correctly.

Divergence is Specialist evidence. The platform must preserve it rather than silently correcting the Specialist's record.

This allows Sandbox to teach the consequence of poor evidence capture through the real RI authority chain rather than a disconnected quiz score.

## 7. Specialist capability stack

Sandbox graduation is capability-led, not scenario-count-led.

Ordered capability layers:

1. **Condition Integrity**
   - executes the prescribed condition without silently changing the test;
   - records material intervention truthfully.

2. **Observation Integrity**
   - accurately identifies the concrete behaviour that occurred.

3. **Evidence Integrity**
   - preserves decision eligibility;
   - correctly handles support, contamination, confounding and not-observed evidence;
   - does not overclaim capability.

4. **Authority Integrity**
   - Specialist evidence preserves the RI system outcome;
   - does not force movement toward an expected result;
   - canonical and Specialist-derived RI authority remain aligned.

5. **Continuity Integrity**
   - preserves the above across repeated sessions, breakdown, recovery, changed constraints, progression and prerequisite contradictions.

## 8. Evidence-native Specialist readiness

Specialist capability evidence uses the same evidence classes already native to RI:

- `breakdown`
- `conditional`
- `near_stable`
- `supported`
- `not_observed`
- `confounded`

Each capability resolves through temporal evidence and recovery law. A percentage may be stored for diagnostics but must not independently authorize graduation.

The readiness engine identifies the **earliest unsupported Specialist capability layer**.

Further Sandbox exposure should deliberately keep generating valid opportunities capable of establishing that layer without making later-layer evidence authoritative over an earlier unresolved prerequisite.

A genuine capability breakdown requires a stronger later recovery suffix; one isolated clean turn does not erase it.

## 9. Graduation authority

The previous V1R2 candidate gate:

- two distinct scenarios per phase;
- 90% observation fidelity;
- system-outcome match;

is retired as the intended permanent graduation authority.

It remains historical Proof evidence that the V1R2 mechanism worked.

Permanent Sandbox graduation requires:
- all five Specialist capability layers evidence-supported;
- sufficient breadth of phase/set/rep exposure to make those claims defensible;
- at least one meaningful longitudinal trajectory containing changing student state rather than only isolated clean turns;
- no unresolved earlier capability layer;
- approved Sandbox readiness policy;
- explicit stage-control action to open Practicals.

No aggregate score and no raw count alone may graduate a Specialist.

## 10. Reuse of proven V1R2 infrastructure

Keep and reuse:
- private canonical content boundary;
- exact live Training observation option identities;
- real `evaluateTrainingEvidence(...)`;
- real `resolveTrainingEvidenceAuthorityRoute(...)`;
- Sandbox-only evidence scope;
- non-authoritative real-student boundary;
- authenticated Specialist access;
- persisted audit trail;
- readiness UI surface.

Replace:
- whole-session static scenario rotation;
- attempt-number-as-primary progression model;
- distinct-scenario graduation authority;
- static 2-per-phase candidate threshold.

## 11. Proof gate

Before V2 can be treated as complete, Proof must demonstrate:

1. outcome selection at individual rep level;
2. deterministic replay from seed + prior state;
3. no canonical answer leakage;
4. coherent continuity across consecutive reps;
5. canonical and Specialist-derived RI tracks can diverge and later realign through clean recovery;
6. full-session evidence still passes through the live Training evaluator;
7. earliest unsupported Specialist capability is derived from persisted evidence;
8. readiness cannot be opened by score/count shortcuts;
9. simulated student state persists across sessions;
10. no real student state is mutated;
11. Practicals remains an explicit downstream gate.

Production remains untouched until the Proof architecture is closed.
