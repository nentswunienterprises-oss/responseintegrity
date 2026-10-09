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

## Founder-approved responsive Execute upgrade (v2)

A rehearsed video alone cannot satisfy Execute. After the assigned TD approves Sandbox-to-Practicals readiness, the Specialist must start a **server-assigned adaptive three-turn challenge**. The system never allows the Specialist to choose the scenario, reset an unfinished attempt, revise saved turns, skip ahead, or see a future simulated response.

- The opening uses random server entropy; the second student response is drawn from the **active private stateful Sandbox outcome bank** (student-facing behaviour only) and branches on the actual first intervention. The final turn tests evidence truth during an observability interruption. Canonical answer and private future outcome remain hidden.
- Every turn persists the visible simulated behaviour, student-facing Specialist response, intervention, observed facts, evidence status, independence claim, next action, rationale, timestamp and machine-detected contradiction flags.
- The recording must show the assigned challenge reference and the actual exercise. The TD compares the recording with the immutable server trace before judging every current-version anchored rubric criterion.
- A positive Execute v1 video review cannot satisfy Execute v2. Current-version v2 requires exactly three persisted challenge turns linked once to the same evidence attempt. The database validates this link independently of the Express route.
- Contradictory independence or claims of observing unseen work **cannot be approved or downgraded to ordinary repeat**. They require an integrity-critical Fail and the system-derived integrity-review outcome. Other weak observed behaviours remain TD-judged, not pre-scored as pass.
- The challenge does not create student records, change parent billing, modify actual response state, open Trial or certify. It stays a synthetic, pre-live qualification event.

Acceptance additionally requires an actual controlled Specialist/TD exercise proving assigned bank retrieval, challenge start/resume, all three turn saves, protected future outcome, retry and record immutability, recording-to-transcript TD concordance, private truth non-leakage, and invalid-assignment/early/duplicate submission denial. Focused unit and bundling CI are necessary, not substitutes for persisted live-route acceptance.
