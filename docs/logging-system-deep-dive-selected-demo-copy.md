# Response Integrity-OS Deep Dive

**Canonical reference**
The single source of truth for live Response Integrity-OS algorithm rules is [Response Integrity-OS Live Implementation Source of Truth](response-integrity-os-implementation-source-of-truth.md).
This file is a logging and runner deep dive, not the canonical implementation spec.
If any shared engine rule here conflicts with the canonical spec or current code, the canonical spec wins and this file must be brought back into alignment.

## Logging System

Evidence capture, score resolution, and system-led output

## What Logging Is For

Tutors do not log opinions. Tutors log what actually happened. The system uses that evidence to decide whether to hold, place, or move.

### Intro diagnosis

Logging supports phase verification and placement.

### Active training

Logging supports continuity, reinforcement, and next-step selection.

### Handover verification

Logging supports continuity checks after Specialist reassignment.

Handover is evidence-driven continuity verification. It is not a fixed rep sequence and it is not a Training drill.

### Handover operating chain

1. Inherit the active topic, phase, stability, evidence history, next action, and constraints.
2. Prepare a small reserve bank of phase-appropriate continuity problems.
3. Present one clean continuity opportunity at a time.
4. Record the concrete behavior that actually happened.
5. Record not-observed or confounded evidence when the behavior cannot be interpreted cleanly.
6. Let the Response Evidence Model decide whether another comparable opportunity is required.
7. Stop when evidence resolves to hold, bounded same-phase stability adjustment, or targeted evidence-complete re-diagnosis.

The reserve problem bank is not a completion quota.

### Handover evidence language

The live Handover runner uses the same canonical behavior contract as Diagnosis:

- breakdown
- conditional
- near-stable
- supported
- not observed
- confounded

The Specialist sees concrete behavior options rather than choosing these state classes directly.

Not-observed and confounded evidence count as neither weakness nor strength.

### Recovery and contradiction

A real breakdown is not erased by one later clean response.

With the current minimum of two valid opportunities, recovery after an earlier breakdown requires three trailing supported comparable opportunities.

Confirmed phase-defining breakdown stops Handover and routes the topic to targeted evidence-complete re-diagnosis.

Persistent conditional evidence can adjust stability only after the bounded verification window closes.

### Handover result screen

The live result is evidence-first and shows:

- inherited state
- resulting state
- evidence reason
- dimension-level evidence decisions
- recovery status
- next action
- active constraint

Compatibility scoring is technical reference only and has no authority over phase, stability, recovery, regression, or re-diagnosis.

### Audit relevance

Evidence integrity is the operating standard:

- do not strengthen an observation beyond what happened;
- do not convert missing evidence into weakness;
- do not use post-help behavior as independent evidence;
- do not add extra Handover opportunities to chase a preferred result;
- do not manually change state against the system decision.

If the observation record is manipulated, the Handover decision and downstream institutional record are compromised.

