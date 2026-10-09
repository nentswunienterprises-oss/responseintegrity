# Practicals acceptance — 9 October 2026

STATUS: Engineering branch only. The Hub migration has not been applied. No real Specialist progressed. Production acceptance not claimed.

Pathway: Application -> Training -> Sandbox -> Practicals -> Trial -> Certification -> Certified Live.

Practicals entry requires current Sandbox capability readiness AND the latest assigned-TD Sandbox-readiness signoff. The stage does not itself permit live families.

Three immutable demonstrations, simulated data only:
- Prepare: case state, system-selected work, observability, escalation.
- Execute: session conduct, phase constraints, support and evidence integrity.
- Evidence: actual behavior, rep lineage, assistance contamination, no invented recovery.

Review rule: Each criterion has frozen Clear, Partial, Fail anchors. Only all Clear gives approved; Partial or ordinary Fail means repeat_required; integrity-critical Fail means integrity_review. No reviewer-selected final outcome. Repeats are new submissions.

Final Practicals completion must record a distinct assigned-TD decision after current-version approval of all three demonstrations; operating permission remains unchanged.

Required acceptance proof:
- [ ] Managed Hub migration succeeds; table, RLS and server grants verified
- [ ] Current Sandbox readiness, preparation, TD signoff verified with persisted evidence
- [ ] Unauthorized, early and cross-Pod submissions and reviews rejected
- [ ] Three test Specialist submissions with permitted fake data and immutable rubric versions
- [ ] Partial, Fail, critical-Fail, retry and duplicate review boundaries exercised
- [ ] TD completion decision persisted, frozen evidence IDs checked and read back
- [ ] Trial creation rejected until authoritative Practicals completion
- [ ] Specialist and TD pages render and submit successfully; production build green
- [ ] No mutation to live Specialist, family or certification permissions

DOWNSTREAM: Trial runtime contains a superseded 14-day policy; approved latest normal cap is 35 days from first Trial session, 2 families x 9 qualifying sessions, with COO exceptions. Correct in separate downstream gate. 65 legacy RLS-disabled tables in The Hub need a scoped security migration rather than unsafe blanket changes.

No production proof or CI pass asserted.