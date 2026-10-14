# Practicals: common-case, video-observed operating examination
Founder approved the governing principles on 11 October 2026: video as primary performance evidence, multiple comparable system-issued situations, real setup/tools, and uninterrupted recording. In the subsequent clarification, **doing plus walking through the actual RI-OS flow** became a mandatory release condition. Every case must persist actual isolated operations using the same drill/evidence contracts as Sandbox; spoken explanation alone is insufficient. The current three cases per Practical remain provisional, subject to actual complete demonstrations and TD review. Proposed minute bands are calibration hypotheses only, not pass/fail limits. Not live qualification authority until governed release and authenticated proof. See [executable contract](PRACTICALS_EXECUTABLE_WORKFLOW_CONTRACT_2026-10-11.md).

## What is being assessed
Practicals proves actual Specialist **preparation, delivery conduct and evidence judgement**, rather than an essay, polished demonstration or isolated correct answer. The primary evidence is the **original, full-length video**: Specialist face, voice, shared application and relevant work surface must be sufficiently observable. The system assigns the conditions, and the TD judges the observed performance.

## Common benchmark bank (v1)
Each Specialist faces the **same fixed, versioned three cases per Practical**, one recording per Practical:
| Practical | Shared cases | Phase coverage | Required original recording |
|---|---|---|---|
| Prepare | Clarity entry, Structured Execution independent drill, TPS missing baseline | Clarity / SE / TPS | Full video; measured duration, no minute cap |
| Execute | Clarity ambiguity, Controlled Discomfort no-rescue, TPS timing/observation interruption | Clarity / CD / TPS | Full video; measured duration, no minute cap |
| Evidence | assisted-as-independent claim, unobserved/confounded responses, mixed TPS phase-exit | SE / CD / TPS | Full video; measured duration, no minute cap |

**Executable case contract:** the server provisions an immutable versioned workflow plan for each case. The Specialist configures real training sets, interacts with system-revealed simulated students, records rep observations using the current RI drill registry and logs decisions in a separate, protected Practicals action ledger. For live preparation/execution reps, the system records a separate begin-rep event before revealing the rep. Every action is ordered and append-only. Case progression is refused if a required operation is missing, even if the Specialist submits a video and lengthy explanation. TD views both per-case operations and the original video to assess real conduct. This simulation does not modify real students, commercial packages, Sandbox, Trial or certification.

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
- Database stores immutable case reveals and actual case operations, attempted version, proof-to-case link, Specialist's measured duration, TD-observed duration and case-level review.
- Server guards deny missing or out-of-sequence operating steps, premature/skipped/reversed cases, and video submission without three completed, durable case execution trails.
- Video duration declarations, event timestamps and TD observations are mutually checked. There are no automatic minimum or maximum minute caps during calibration, but missing footage, case operations or continuity still prevent approval.
- **External URL evidence cannot prove cryptographic uneditedness.** The implemented version relies on honest Specialist declarations, TD inspection and server-visible case sequencing. Real native recording, secure private media storage, capture provenance/hash and automated tamper/continuity checks are later enhancements and cannot be claimed to exist merely because these rules are active.
- Camera should show only the Specialist and relevant working tools; never require a tour of the home, other people, real student records or visible credentials. Access to recordings is restricted to the Specialist and assigned TD, and further retention/access rules require privacy review before expanding capture.
- Comparisons should use pseudonymous/role-limited reporting. Video must never become a public gallery of Specialists or their homes.

## Protected release gates
- New production database migration through existing manual `Production DB Promotion` **plan → authorised apply → ledger/RLS/constraints/trigger readback**, before matching app code.
- Exact-source CI must pass all nine executable case plans, true registry evidence choices, action append/immutability, future-case secrecy, click-through/skip/replay denial, safe durations, TD case/continuity rules, unauthorized routes, and existing Practicals/Trial tests.
- Run an authenticated synthetic Specialist → TD acceptance using genuine Sandbox evidence and approved current bank/policy signoff. **Candidate** Sandbox policy cannot issue real Practicals entry; no tests may fabricate it in Production.
- Real pre-live flow can advance only after TD-approved Prepare, Execute and Evidence under the approved version, followed by the separate TD Practicals decision.
