# Capability Engine Sprint 16 - Pre-Mock Capability Dossier

## Objective

Give the authorised human Sandbox Mock reviewer a factual, current-version Capability Engine evidence dossier immediately beside the existing Mock Gate without changing the authority, criteria, scoring, or transition logic of the Mock itself.

## Authority boundary

The current Battle Test pathway and human Sandbox Mock Readiness Gate remain authoritative.

The dossier is read-only and `authoritative: false`. It cannot:

- pre-mark or infer any of the five Sandbox Mock criteria;
- recommend `passed` or `remediation_required`;
- write a Mock assessment;
- open Trial;
- certify a Specialist;
- change `operational_mode`;
- mutate student state;
- override Battle Test progression.

## Reviewer context

The dossier must show, for the Specialist's single Sandbox assignment:

- 33/33 capability evidence-cell status;
- all 16 approved automated assessment events using active-bank/current-version evidence;
- exact evidence IDs, bank versions, attempts, and timestamps;
- current Prepare / Execute / Evidence practical outcomes, rubric versions, derived counts, and feedback;
- current Oral Integrity Defense V2 outcome, counts, feedback, evidence ID, attempt, and timestamp;
- deterministic Sandbox simulation rehearsal history from the active simulation bank;
- stale, missing, and internally conflicting lineage flags where detectable.

## Human Mock separation

The existing five Mock criteria stay visibly separate and reviewer-owned:

1. system direction followed;
2. phase constraints preserved;
3. evidence captured;
4. student response managed;
5. system result respected.

Capability evidence may inform the human reviewer, but it cannot populate these fields or convert evidence into a Mock recommendation.

## Implementation shape

- one GET-only COO reviewer endpoint;
- read-only aggregation service;
- current-version selection based on the same Capability Engine contracts used by readiness;
- dossier card rendered as a sibling immediately before the existing Mock Gate card;
- explicit advisory/non-authoritative language;
- no database migration required for Sprint 16;
- focused source-boundary and pure-selection tests.

## Branch/deployment state

- stacked on frozen Sprint 15, not `main`;
- no Supabase writes;
- no migration application;
- no production deployment.

Refs #33 #31 #29 #27 #23 #21.
