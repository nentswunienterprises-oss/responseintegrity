# Capability Engine Sprint 14 - Practical Evidence Rubrics and Reviewer Calibration

## Decision

Prepare, Execute, and Evidence practicals are no longer reviewed through a free-form reviewer-selected overall outcome.

The reviewer records criterion-level observable evidence. The system derives the outcome from the frozen rubric.

This keeps human review where human observation is valuable while removing avoidable reviewer discretion from the final result.

## V1 outcome rule

Every practical rubric uses explicit `Clear`, `Partial`, and `Fail` judgments.

The deterministic outcome rule is:

- every criterion Clear -> `approved`
- any Partial or non-critical Fail -> `repeat_required`
- any Fail on an integrity-critical criterion -> `integrity_review`

The reviewer cannot directly submit `approved`, `repeat_required`, or `integrity_review` as the decision.

## Evidence standard

Reviewers judge what the recording demonstrates, not what they believe the Specialist intended.

Rules:

1. Every criterion must be judged explicitly. Nothing defaults to Clear.
2. Clear means the observable Clear anchor is demonstrated.
3. Partial means some capability is visible but the criterion is not yet reliably Clear.
4. Fail means the observable Fail anchor is demonstrated or the required capability is materially absent.
5. Partial and Fail require a criterion-specific observation note of at least 20 characters.
6. Do not infer motive, intention, confidence, carelessness, or character where the recording does not establish it.
7. Do not average a weak criterion into a strong overall impression.
8. An integrity-critical Fail means the demonstrated behavior crossed a canonical RI integrity boundary. It pauses the evidence for integrity review. It is not, by itself, a claim about dishonest motive.
9. `repeat_required` and `integrity_review` require an actionable reviewer summary of at least 20 characters so the Specialist knows what must change or be resolved.
10. Approved may have an optional reviewer summary because the full criterion record is already Clear.

## Rubric lineage

The exact rubric is frozen when the Specialist submits the practical evidence.

The submission stores:

- proof key/version
- competency lineage
- rubric version
- full rubric snapshot
- artifact reference
- declaration
- submission attempt

The review stores:

- reviewer and reviewer role
- rubric version
- outcome-rule version
- exact criterion judgments
- criterion observation notes
- Clear/Partial/Fail counts
- integrity-critical Fail count and criterion keys
- system-derived outcome and reason code
- reviewer summary

Neither the submission nor the review is updated in place. Repeats create new evidence attempts.

## Reviewer calibration

All reviewers use the same anchors shown in the review workspace.

Calibration should compare reviewers against the same sample recordings and examine disagreement at the criterion level, not just overall outcome.

Recommended pilot telemetry:

- agreement rate by criterion
- disagreement rate: Clear vs Partial, Partial vs Fail, Clear vs Fail
- integrity-critical disagreement rate
- median review minutes per practical
- percentage of reviews requiring repeat
- percentage entering integrity review
- most common weak criteria by proof
- repeat-to-approval conversion rate

Do not set permanent reviewer capacity assumptions until actual review-duration telemetry exists.

## Specialist transparency

The Specialist sees the same observable standard and Clear/Partial/Fail anchors before recording the practical.

This is intentional. Practical evidence is not a hidden-answer examination. The purpose is to train and verify correct operating behavior against a recipe-clear standard.

Internal competency and critical-boundary identities remain implementation lineage, not learner-facing scoring instructions.

## Relationship to Sandbox Mock Gate

The three practical rubrics collectively prepare all five existing human Sandbox Mock criteria:

- system direction followed
- phase constraints preserved
- evidence captured
- student response managed
- system result respected

Practical approval does not pass the Sandbox Mock Gate.

The Mock Gate remains the authoritative human Sandbox exit decision in the current stack.

## Authority unchanged

Sprint 14 does not:

- certify a Specialist
- open Trial
- alter operational mode
- replace the Sandbox Mock Gate
- change student state
- change automated mastery/retrieval/transfer evidence

## Database status

An additive migration is included for rubric lineage and criterion-level review evidence.

It has not been applied to Supabase or any production database.

## Verification limits

Capability Engine GitHub Actions remains affected by the existing runner-allocation issue where jobs are created but execute zero steps. A red zero-step run is not treated as a code-level failure or pass.

No main merge. No Supabase write. No production deployment.