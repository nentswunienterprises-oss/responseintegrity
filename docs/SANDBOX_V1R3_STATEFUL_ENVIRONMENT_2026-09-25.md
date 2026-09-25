# Sandbox V1R3 — Stateful RI Practice Environment

Date: 2026-09-25
Status: Approved architecture, implementation in progress

## Founder decision

Sandbox is not a bank of once-off prewritten scenarios.

It is a persistent simulated Response Integrity environment in which a Specialist operates the real RI flow against a hidden simulated student state:

`student state -> phase -> set -> rep -> plausible student response -> Specialist evidence capture -> RI authority -> updated state -> next condition`

The simulated student may break down, recover, remain unstable, progress, expose prerequisite contradictions, or hold under pressure. The Specialist does not know the hidden answer record and cannot choose the student outcome.

## Outcome matrix

The private content unit is a **rep outcome**, not a full scenario.

Each scored RI rep can have multiple plausible whole-rep behavior outcomes. The default authoring target is roughly 6–10 materially distinct outcomes per rep, with about 8 as a useful center point. This is not a fixed quota: no outcome is added merely to hit a number.

Every private outcome defines:

- the RI phase, set, and rep where it is valid;
- believable simulated student behavior;
- the canonical RI evidence record for that behavior;
- the canonical intervention / evidence-eligibility truth;
- the prior student stability states for which the outcome is plausible;
- the Specialist capabilities the opportunity can expose;
- a base selection weight.

Canonical observations remain private and are never projected into Specialist payloads or committed as public bank content.

## Constrained shuffle

The Specialist should experience uncertainty; the engine must not generate nonsense.

Outcome selection is deterministic and replayable from a private seed, but constrained by:

- current canonical student phase and stability;
- the RI phase/set/rep being prescribed;
- recent outcomes, to avoid trivial repetition;
- plausibility for the hidden student state;
- unresolved Specialist capability evidence.

Weights may favor opportunities that expose the earliest unsupported Specialist capability, but they may never select an implausible student response merely to manufacture a test.

## Two state tracks

Sandbox persists two separate state tracks:

1. **Canonical simulated student truth** — what the fictional student behavior actually earns under RI.
2. **Specialist-recorded RI state** — what RI concludes from the evidence the Specialist submitted.

When capture is accurate, the tracks remain aligned.

When the Specialist misobserves, overclaims evidence, mishandles support/confounding, or otherwise corrupts the evidence record, the tracks may diverge. That divergence is itself Specialist evidence.

Neither track is authoritative to any real student. Sandbox evidence remains `student_state_authoritative=false` and `evidence_scope='sandbox'`.

## Specialist capability stack

Sandbox graduation is evidence-native and ordered.

The capability layers are:

1. **Condition Integrity** — preserve the prescribed RI condition without quietly changing the test.
2. **Observation Integrity** — perceive and record the concrete behavior that actually occurred.
3. **Evidence Integrity** — preserve evidence eligibility, intervention truth, confounding, and not-observed truth.
4. **Authority Integrity** — allow the evidence record to preserve the canonical RI authority outcome rather than forcing the expected answer.
5. **Continuity Integrity** — keep RI truth intact longitudinally through breakdown, recovery, progression, prerequisite contradiction, and changing conditions.

Later layers cannot authorize readiness while an earlier layer remains unsupported.

A real breakdown requires stronger recovery evidence; one isolated clean rep cannot erase it. The same evidence-resolution law used by RI student evidence is reused for Specialist capability evidence.

## Graduation law

Sandbox does **not** graduate a Specialist because they:

- completed X scenarios;
- achieved an average score;
- hit a percentage once;
- reached a particular student phase;
- forced a simulated student to progress.

Sandbox graduation asks:

> What Specialist capabilities has the evidence actually established?

The readiness engine identifies the earliest unsupported capability and keeps Sandbox exposure capable of establishing or recovering that layer.

Final Practicals readiness requires:

- every required Specialist capability layer to be supported;
- the required RI phase breadth to have been represented;
- longitudinal evidence across a persistent trajectory;
- an **approved** capability policy.

Even then, Sandbox never changes lifecycle mode automatically. Practicals is opened explicitly.

## V1R2 disposition

V1R2 remains valuable proof of:

- the private canonical boundary;
- live RI semantic evidence reuse;
- canonical-vs-Specialist comparison;
- persisted non-authoritative Sandbox evidence;
- Specialist readiness UI mechanics;
- authenticated Proof execution.

Its temporary candidate rule of **2 scenarios per phase + 90% observation fidelity + system-outcome match** is retired as the intended graduation design.

Observation fidelity may remain an analytics descriptor. It is not graduation authority.

## Stage boundary

Current Specialist pathway:

**Application -> Training -> Sandbox -> Practicals -> Trial -> Certification -> Certified Live**

Sandbox proves evidence-safe RI operation in a controlled simulated world.

Practicals proves operational execution under realistic delivery conditions.

Trial proves repeated real-world delivery with live families.
