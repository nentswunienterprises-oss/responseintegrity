# Capability Engine Sprint 5

Status: implementation complete on feature branch. Not merged to main. No production database migration or deployment.

## Delivered

- Three versioned practical capability proofs: Prepare, Execute, Evidence.
- Proofs require observable sandbox work rather than knowledge-only explanation.
- Prepare and Evidence require screen-based evidence; Execute requires visible operational demonstration.
- Real student, parent and family data is explicitly prohibited from practical recordings.
- Reference-first media architecture: RI stores an HTTPS review link and structured declaration, not video bytes.
- Immutable practical evidence submissions with proof version, attempt number, artifact type, declaration and frozen competency lineage.
- Immutable review decisions stored separately from the Specialist submission.
- Review outcomes are limited to `approved`, `repeat_required`, or `integrity_review`.
- Repeat and integrity outcomes require actionable reviewer feedback.
- TD reviewers are scoped to their assigned pod; COO and HR have the broader authorised review surface in V1.
- Specialist resubmission is blocked while evidence is awaiting review, after approval, or during integrity review. A new attempt is allowed after `repeat_required`.
- Practical evidence is integrated into the capability ledger without being represented as an automated quiz pass.
- Approved practical evidence can support linked competencies; unapproved evidence remains visible but does not create approved capability.
- Specialist practical evidence workspace and human reviewer queue added through the isolated Capability Engine client app.
- Clarity and Structured Execution Deep Dives expose both the digital mastery check and practical evidence workspace to authenticated Specialists.
- Capability automated and practical routes are registered in both the long-running server and Vercel serverless entrypoints.

## Evidence integrity decisions

1. Historical practical competency lineage is frozen on each submission so later proof-definition changes cannot rewrite what an earlier artifact was intended to demonstrate.
2. Reviewer decisions never overwrite Specialist evidence. Submission and review are separate immutable records.
3. Practical review does not modify automated mastery, retrieval, or transfer scores.
4. No practical recording is stored directly by RI in V1, avoiding a new high-egress video pipeline.

## Authority boundary

Capability Engine evidence remains shadow evidence. Existing Battle Test progression remains authoritative until the full replacement journey has been validated and explicitly promoted.

## Verification limitation

GitHub Actions still fails before a runner is allocated (`runner_id: 0`, no runner name, zero executed steps). Sprint 5 therefore has branch diffs and static boundary tests committed, but no successful executable CI signal yet.
