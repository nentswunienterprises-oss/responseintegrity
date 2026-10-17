# Persisted qualification pipeline integration

## Native Preview checkpoint — 16 October 2026

17 October continuation: Preview `18dc794b` is READY and all ten CI workflows pass. The corrected independent normal probe saved seven of seven exact observations with preserved conditions at 05:59:46 UTC. The subsequent recognition opportunity completed native QA Pressure Diagnosis at 06:00:56 UTC, placing the topic at Clarity/Medium from partially recognized vocabulary. The previous in-progress run and its original 5/7 opportunity remain unchanged. A reload starts a new native run rather than resuming the old one; this continuation does not claim otherwise.

`/proof/native-handover` is a controlled Preview-only setup screen, guarded by the existing Specialist gateway and exact Capability Proof project check. It calls the existing authenticated/owned Sandbox fixture endpoint for the single controlled Sandbox Student 1 / Fractions fixture with `restoreCanonicalState: false`. Setup creates a current Handover assignment and confirmed booking, not observations, scores, approval or qualification. It links into the ordinary native Handover runner using the returned authority. Production's proof-environment and fixture endpoints remain unavailable. The setup screen is not part of the Specialist product navigation. Native setup and completed Handover verification remain required.

At 20:35 UTC the controlled TD signed in on deployed Preview `1f215ec1`, opened the assigned Pod and Specialist development record, inspected the coverage and historical dossier (27 sessions, 180 rep records), and recorded a remediation decision through the native UI. Readback showed “Remediation active”, the saved note and timestamp, with Practicals approval disabled. This proves a deployed negative TD review, not positive qualification or stale-approval rejection.

The subsequent QA Pressure native Diagnosis exposed a protocol/scoring contradiction. Its independent normal probe explicitly prohibits eliciting vocabulary or explanation; recording those two dimensions as not observed produced 5/7 canonical matches with intact conditions. Preserve that completed opportunity. The next repeatability response was too generic to distinguish the required dimensions and was left unsubmitted. New native Diagnosis/Handover opportunities now include dimension-specific behavioral detail; independent normal probes keep vocabulary and explanation unresolved. The public form fingerprint includes native protocol version 2 so previously issued forms cannot silently receive changed scoring. Historical rows and the separate stateful re-diagnosis selector remain unchanged. Deployed verification of this correction remains required.

The native Clarity Handover runner exposed a further protocol mismatch: it inherited legacy recognition-only/no-execution rules while requiring immediate application among its four evidence dimensions. Its displayed instruction now reuses the established recognition execution protocol, including the first independent application, without teaching or progressing the student. The inspected opportunity was left unsubmitted; it is not claimed as clean Handover evidence. The corrected protocol must be verified before a fresh delivered opportunity is submitted.

Continuation: the native scheduled-training re-diagnosis completed at 12:16:30 UTC with Clarity/High. Its captured recognition opportunity has four of four exact observations and preserved conditions. Native source status is completed. The Map preparation UI now keeps diagnosis preparation distinct from Training prescriptions, and the Sessions page opens the existing Map for scheduled Sandbox students. Native continuation then exposed an unintended two-hour age filter in the Specialist lesson list: it hid confirmed Sandbox bookings despite Sandbox having no live launch window. Both database paths now retain unfinished owned Sandbox bookings; other modes retain the live time filter. Scheduling, quota and confirmation checks remain in force. Full qualification acceptance remains outstanding.

- The controlled Clarity lesson completed through all six native reps. Persisted observation, evidence and condition checks all pass; session authority and state tracks align. Reopening the completed lesson on the fixed Preview returns its saved response snapshot.
- The scheduled-session UUID binding fix passed the real PostgreSQL contract and all ten PR workflows. The Map-launched targeted re-diagnosis now opens and accepts its first opportunity.
- That first opportunity preceded cross-mode capture activation and has no qualification capture row. Preserve it as native run history; do not count it as captured qualification evidence or backfill it.
- Cross-mode capture is now configured only for this PR's Preview branch (`RI_SANDBOX_CROSSMODE_CAPTURE_V1=true`). A fresh deployment is required before further submissions; unchanged-commit redeploys were skipped by the repository's ignored-build rule.
- The full native development coverage, eight consecutive clean sessions and deployed assigned-TD approval/stale rejection remain unproved. Qualification activation and bank promotion are not established by this checkpoint.

16 October deployed continuation: the controlled Specialist completed one native six-rep Clarity lesson after the persisted Map preparation. All six rows have exact observations/evidence and intact conditions; session authority and state tracks align, with Sandbox-only evidence and no student-authoritative promotion. The next native Map-launched targeted re-diagnosis exposed `operator does not exist: uuid = integer`: scheduled-session lookup interpolated the binding index as a SQL integer. Both explicit-session and latest-kind lookups now bind `$3`; the isolated PostgreSQL contract verifies actual UUID lookup and cross-Specialist denial. Re-deployed native re-diagnosis acceptance remains required. This is not full qualification acceptance.

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
