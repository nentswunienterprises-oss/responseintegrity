# Practicals: common-case, video-observed operating examination
Approved by Founder: 11 October 2026. Implementation candidate; not live qualification authority until governed release and authenticated proof.

## What is being assessed
Practicals proves actual Specialist **preparation, delivery conduct and evidence judgement**, rather than an essay, polished demonstration or isolated correct answer. The primary evidence is the **original, full-length video**: Specialist face, voice, shared application and relevant work surface must be sufficiently observable. The system assigns the conditions, and the TD judges the observed performance.

## Common benchmark bank (v1)
Each Specialist faces the **same fixed, versioned three cases per Practical**, one recording per Practical:
| Practical | Shared cases | Phase coverage | Required original recording |
|---|---|---|---|
| Prepare | Clarity entry, Structured Execution independent drill, TPS missing baseline | Clarity / SE / TPS | 10–18 minutes |
| Execute | Clarity ambiguity, Controlled Discomfort no-rescue, TPS timing/observation interruption | Clarity / CD / TPS | 12–22 minutes |
| Evidence | assisted-as-independent claim, unobserved/confounded responses, mixed TPS phase-exit | SE / CD / TPS | 10–18 minutes |

**Comparable assessment** means stable case IDs, case texts, case versions, delivery conditions, rubrics and TD case-level observations. Specialists cannot choose, reshuffle, skip or request a new case to avoid difficulty. The server reveals each case only during the current recorded session, persists each issued snapshot once, and keeps future situations undisclosed.

The Execute CD case additionally launches the responsive **three-turn adaptive student**. Its opening and canonical private outcome matrix are shared across Specialists in the same bank version, while the follow-up student response branches on what the Specialist **actually did**. Cross-Specialist comparisons must separate common starting conditions from naturally different response-dependent branches.

### Known limitation: case leakage
A benchmark reused across Specialists can eventually become known through collusion or disclosure. A video started before the on-screen reveal cannot by itself prove that the case has never been seen. Protect issuance, use controlled cohorts, alert on leakage, and rotate/reapprove a *whole* fixed bank version if compromised. Do not silently replace one Specialist's case while comparing against another bank. Comparison cohorts must remain version-specific.

## Continuous video protocol
1. Specialist begins external screen+webcam+microphone recording **before any case is revealed**, including the tool/environment preflight. Use a single uninterrupted original video for all three issued cases in that Practical.
2. Show functional delivery workspace and real operating tools: visible student work surface, correct screen view, camera/microphone, task material and preflight of what can actually be observed. No aesthetic judgement or income-based assessment of a Specialist's home.
3. Obtain a protected server-issued attempt reference during recording, then work cases 1, 2 and 3 in their issued order. Video must show the case references/prompts as they appear and capture live speech, timing and conduct.
4. No pauses, cuts, editing, splicing, speed changes or missing assessed intervals. End recording only after system confirmation of the final case.
5. Submit the original privately accessible HTTPS video link, exact recording duration, true no-cuts/pre-reveal/tools declarations and the written supporting responses.
6. The TD verifies every issued case on the video, screen, face, speech and the real operating preflight, video continuity, duration, and system-issued timestamps. The TD records an observable Clear/Partial/Fail judgment and 30+ character note **for each case**, as well as the fixed proof rubric.
7. Suspected cuts or manipulation => integrity-critical Fail and integrity review. Unintentional recording interruptions, missing case footage or unusable audio/view => no approval; use repeat or governed recovery, not fabricated evidence.
8. Only after all three proof videos pass every criterion can the **assigned TD** record a separate immutable Practicals-completion decision. Practicals completion is not itself Trial or Certified Live permission.

### Integrity controls and honest limitations
- Database stores immutable case reveals, attempted version, proof-to-case link, Specialist's duration declarations, TD-observed duration and case-level review.
- Server guards deny premature, skipped, duplicate or reversed cases and prevent video submission without all three completed cases.
- Video metadata declarations, recorded event timestamps and TD's observations are mutually checked; durations outside the assigned band cannot be approved.
- **External URL evidence cannot prove cryptographic uneditedness.** The implemented version relies on honest Specialist declarations, TD inspection and server-visible case sequencing. Real native recording, secure private media storage, capture provenance/hash and automated tamper/continuity checks are later enhancements and cannot be claimed to exist merely because these rules are active.
- Camera should show only the Specialist and relevant working tools; never require a tour of the home, other people, real student records or visible credentials. Access to recordings is restricted to the Specialist and assigned TD, and further retention/access rules require privacy review before expanding capture.
- Comparisons should use pseudonymous/role-limited reporting. Video must never become a public gallery of Specialists or their homes.

## Protected release gates
- New production database migration through existing manual `Production DB Promotion` **plan → authorised apply → ledger/RLS/constraints/trigger readback**, before matching app code.
- Exact-source CI must pass benchmark bank/content, private future-case leakage prevention, race/skip/reset/duplicate controls, initial bank secrecy, declared vs actual video duration, TD case/continuity rules, unauthorized routes, and existing Practicals/Trial tests.
- Run an authenticated synthetic Specialist → TD acceptance using genuine Sandbox evidence and approved current bank/policy signoff. **Candidate** Sandbox policy cannot issue real Practicals entry; no tests may fabricate it in Production.
- Real pre-live flow can advance only after TD-approved Prepare, Execute and Evidence under the approved version, followed by the separate TD Practicals decision.
