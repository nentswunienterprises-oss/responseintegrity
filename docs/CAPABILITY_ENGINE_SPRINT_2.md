# Capability Engine Sprint 2

Status: implementation complete on feature branch; not merged to main and not applied to production database.

## Implemented

- Separate `mastery`, `retrieval`, and `transfer` evidence kinds.
- Clarity mastery assessment.
- Delayed Clarity retrieval assessment.
- Structured Execution mastery assessment grounded in the live RI-OS recipe.
- Interleaved Clarity + Structured Execution transfer assessment with question-level Deep Dive lineage.
- Immutable attempt evidence schema for branch deployment.
- Specialist capability ledger that keeps mastery, retrieval, and transfer evidence separate by Deep Dive and competency.
- Authenticated Specialist API boundary and ownership checks.
- Tests for scoring, critical fails, transfer lineage, ledger aggregation, and answer-key projection boundaries.

## Verification limitation

GitHub Actions currently fails before runner steps execute, and the current runtime cannot clone GitHub over outbound DNS. This sprint therefore has static contract review but not a successful executable CI run yet.

## Security follow-up required before rollout

The repository is public. Production assessment answer keys and final item banks must not remain in repository source. Sprint 3 must move the live assessment bank behind a private server/data boundary and treat source-controlled assessment items as non-production fixtures only.

The existing human Battle Test progression remains authoritative. Capability Engine evidence remains shadow evidence until the complete journey is validated and explicitly promoted.
