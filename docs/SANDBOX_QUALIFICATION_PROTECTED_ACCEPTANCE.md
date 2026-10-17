# PR #202 protected acceptance runner

The current runner is scripts/sandboxQualificationProtectedAcceptance.mjs, invoked by
.github/workflows/sandbox-qualification-protected-acceptance.yml.

This is a read-only authentication, authorization, provenance and preparation-prescription
smoke test. It does not submit evidence, approve a Specialist, prove the longitudinal
qualification journey or authorize Production promotion.

Before dispatch, an independent protected-environment reviewer must approve the exact
commit and immutable Preview URL in RI_PROOF_APPROVED_SHA and RI_PROOF_APPROVED_URL.
Keep the capability-proof-acceptance environment protection enabled. Do not use a
pull-request trigger to expose controlled credentials.

Required environment secrets:
- RI_PROOF_SPECIALIST_EMAIL
- RI_PROOF_SPECIALIST_PASSWORD
- RI_PROOF_TD_EMAIL
- RI_PROOF_TD_PASSWORD
- VERCEL_AUTOMATION_BYPASS_SECRET

Required controlled-fixture environment variables:
- RI_PROOF_TUTOR_ID
- RI_PROOF_STUDENT_ID
- RI_PROOF_SESSION_ID
- RI_PROOF_TOPIC

The fixture must be an assigned Sandbox Specialist and its assigned TD, with a valid
scheduled preparation opportunity in Capability Proof. The runner verifies the signed-in
Specialist identity, role, assignment linkage, no qualification readiness, safe preparation
projection and active Proof capture. Capture controls require separate approved Proof
configuration; do not enable Production flags.

Run dependency-free runner regressions with:
`node --test scripts/sandboxQualificationProtectedAcceptance.test.mjs`
These also run in Sandbox CI and before the protected live step.

GitHub registration is a separate gate: workflow_dispatch requires the workflow on the
default branch. Do not merge this feature merely to make its test dispatchable. A separately
reviewed workflow-only registration change or an already registered trusted dispatcher is
needed. The GitHub connector available during this work has no dispatch, environment-secret
configuration or environment-review action.

Last executed protected smoke (38859528302) failed before network because TD email, TD
password and Vercel automation bypass were absent. This historical result does not prove
the current secret configuration. A current authenticated run is required.

After a green smoke, full positive and negative native Specialist-to-TD qualification
acceptance remains mandatory, including cross-student chronology, eight clean sessions
after development coverage, error reset, historical truth, stale sign-off rejection and
former/cross-Pod denials. Keep the PR draft until that evidence exists.
