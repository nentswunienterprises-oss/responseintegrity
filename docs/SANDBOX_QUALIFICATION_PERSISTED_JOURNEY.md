# Persisted qualification pipeline integration

`scripts/sandboxQualificationJourneyIntegration.ts` runs after the protected schema contract
in the ephemeral PostgreSQL 17 GitHub service. It refuses a non-loopback host or a database
other than `sandbox_qualification_ci`, creates a separate synthetic-only database, and
executes the real historical evidence loader, qualification evaluator and TD review handler.

Its authored storage fixtures test:
- Exact phase set/rep contracts, preparation-to-first-rep lineage, native completed
  Diagnosis and Handover source joins, targeted re-diagnosis, closure and continuity.
- Observed development coverage across all six profiles and eight subsequent clean
  phase-balanced sessions.
- Missing truth, a consequential error on another student, incomplete native Diagnosis,
  mismatched native Handover, preparation tampering and absent observed profile coverage.
- Assigned-TD inspection, former-Pod and Specialist denial, anonymous denial and default-off
  qualification activation.

These are synthetic source records seeded inside an ephemeral database. They are not
evidence of a human Specialist's competence and do not prove the deployed UI or native
runner submission paths. No Proof/Production data, credentials, policy activation,
real TD sign-off or stage transition is changed.

The deployed native journey remains a separate gate. At the 16 October preflight,
the controlled Proof Specialist had 25 Training evaluations, zero preparation receipts
and zero captured cross-mode simulation turns. The Proof bank capability policy still
read `candidate`. Existing evaluations cannot substitute for absent native coverage.

Do not dispatch the historical V2 longitudinal workflow unchanged: it pins an older
deployment, uses hardcoded historical fixtures and chooses the first observation option
without proving observation correctness. Its technical disposition PASS cannot establish
the approved zero-divergence qualification standard.

Live acceptance must use new bounded synthetic opportunities through Map preparation,
native Diagnosis/Training/Handover/re-diagnosis and actual evidence submissions; preserve
all prior records. Evaluate actual observed responses, not private future answer keys.
Only independently reviewed proof can support later bank/policy activation and TD
readiness decisions.

## Evidence-bound TD approval acceptance

The same entry loader used by the application is exercised against persisted synthetic
TD assessment rows. Tests establish positive assigned-TD approval for current evidence,
former-TD exclusion (including a newer row), ownership denial, TD reassignment denial,
stale evidence rejection while the expanded evidence still qualifies, refreshed approval,
latest remediation precedence, wrong-bank denial and subsequent material-error denial.
Historical assessment rows remain intact and the assignment remains in Sandbox.

The server fingerprint now binds every qualification-event field, including phase,
profile, opportunity identity, observed status, canonical presence and condition integrity.
It normalizes query/object/tag order. Fingerprint format version 2 deliberately invalidates
any earlier fingerprint: an old TD approval must be reviewed again against current evidence.
This is isolated persisted approval-consumption proof, not a deployed TD submission PASS.
