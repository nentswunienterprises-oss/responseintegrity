# Battle Testing Certification Integrity Specification

Status: Proposed implementation contract  
Date: 2026-08-31

## 1. Decision

Battle Tests will be rebuilt as an evidence-backed judgment assessment for Response Integrity Specialists.

They will no longer certify recall of phase definitions or rely on an assessor's undocumented impression. A completed Battle Test must show what the Specialist said, how that answer was scored, which operating boundary was being tested, and why any critical failure was triggered.

This change preserves the existing eleven-deep-dive pathway:

- Transformation Phases: Topic Conditioning, Clarity, Structured Execution, Controlled Discomfort, and Time Pressure Stability.
- Session Infrastructure: Intro Session Structure, Logging System, Session Flow Control, Drill Library, Handover Verification, and Tools Required.

Evidence Integrity is a cross-cutting competency inside those eleven deep dives. It is not a twelfth completion gate.

## 2. Certification outcome

A Battle Test must determine whether the Specialist can reason like a trustworthy Response Integrity operator.

The Specialist must be able to:

1. identify the capability target of the current phase;
2. explain why the assigned drill is appropriate;
3. explain what the active set isolates;
4. explain what another repetition is meant to reveal;
5. preserve the active support, difficulty, variation, and time constraints;
6. distinguish observed behaviour from psychological inference;
7. record the evidence that actually occurred;
8. recognise when assistance has contaminated a rep;
9. understand that the system, not the Specialist, determines state movement; and
10. recognise that recorded evidence may become a system decision and a claim shown to a parent.

The operating chain assessed by the banks is:

**Phase purpose -> Drill purpose -> Set purpose -> Rep purpose -> Active constraint -> Observable response -> Evidence -> System decision**

## 3. Separation of training gates

The pathway keeps four distinct proofs:

- Training content asks: Does the Specialist understand the system?
- Battle Tests ask: Can the Specialist reason like the system?
- Sandbox asks: Can the Specialist execute the system?
- Trial asks: Can the Specialist preserve it repeatedly with real students and trustworthy evidence?

Battle Test completion can progress a Specialist through preparation. It cannot directly issue Certified Live status. Trial certification remains a separate gate.

## 4. Canonical question contract

Every scored question must include:

- a stable question key;
- the competency or section being assessed;
- an application or judgment prompt;
- the expected operating answer;
- explicit fail indicators;
- question-level Clear, Partial, and Fail scoring guidance;
- an automatic critical-fail reason when the question tests a non-negotiable integrity boundary; and
- a prompt form identifier when the question is part of a rotating bank form.

The question bank shown to an assessor must never depend on a three-question fallback. Every one of the eleven deep dives must resolve to its own complete canonical bank of fifteen questions.

The fifteen-question unit is the individual deep dive audit. It is not a shared fifteen-question audit spread across all eleven deep dives.

## 5. Answer evidence contract

Every question requires an `answerEvidence` entry containing the Specialist's actual answer or a faithful concise capture of it.

The assessor's Clear, Partial, or Fail selection is not evidence by itself.

For every rep, the audit record must preserve:

- the prompt form that was asked;
- the Specialist's answer evidence;
- the expected answer;
- the question-level scoring guide;
- the selected score;
- the assessor's clarification note, when needed; and
- the automatic or manually escalated critical-fail result.

Historical audit review must display the Specialist answer before the expected answer and assessor note so another reviewer can inspect whether the score was defensible.

## 6. Scoring standard

Each assigned deep dive audit uses its own fifteen-question point model:

- Clear = 1 point
- Partial = 0.5 points
- Fail = 0 points

The assessor applies these meanings at question level:

- **Clear:** the answer identifies the correct decision and preserves every material boundary named in the scoring guide.
- **Partial:** the answer is directionally correct but omits or blurs a material purpose, constraint, evidence distinction, or authority boundary.
- **Fail:** the answer contradicts the methodology, substitutes tutor instinct, permits contamination, invents evidence, or cannot identify the required action.

Deep-dive health remains:

- below 90: Fail / Drift
- 90 to below 95: Watchlist
- 95 and above: Locked for the attempt

Deep-dive preparation completion remains three consecutive scores of 96 or above without an active critical fail.

## 7. Critical-fail standard

Automatic critical failures are reserved for answers that would corrupt the transformation, the evidence trail, or operator authority. They are attached to concrete protocol scenarios, not generic final-definition questions.

Automatic critical-fail categories are:

- deliberate or accepted rescue where the set prohibits it;
- treating assisted performance as independent evidence;
- logging an inference or desired outcome as though it were observed fact;
- falsifying, softening, or retrospectively manufacturing a rep log;
- manually advancing, placing, or overriding topic state against the system result;
- replacing an assigned drill condition with tutor preference;
- treating speed as success after structure has collapsed;
- bypassing handover verification or erasing inherited state; and
- running a live session without the compulsory delivery conditions required to observe and communicate the work.

A critical fail forces the run state to Fail regardless of the numeric score. The saved reason must identify the violated operating boundary.

Manual critical escalation remains available for an unanticipated severe response, but it requires a written assessor reason.

## 8. Bank content standard

Each deep-dive bank must contain fifteen questions and cover all relevant layers of operator cognition.

### Transformation-phase banks

Each phase bank must test:

- capability target;
- live training sets and their distinct purposes;
- support, pressure, difficulty, and variation constraints;
- repetition as another evidence opportunity;
- the phase-specific observation fields;
- at least one observation-versus-inference distinction;
- contamination recognition;
- accurate evidence capture; and
- system authority over movement.

Clarity must distinguish the unscored Modeling preparation from scored Identification and Light Apply evidence.

Structured Execution must distinguish minimal support in Required Structure from no support in Independent Execution and Variation Control.

Controlled Discomfort must distinguish minimal support in Controlled Entry, first-step-only support in No Rescue, and no support in Repeat Exposure.

Time Pressure Stability must distinguish light timer, repeated timer, and full constraint while preserving method over speed.

### Session-infrastructure banks

The six banks must test the current live operating model:

- Intro Session Structure: topic-entry placement through adaptive diagnosis and adjacent movement.
- Logging System: raw observation, rep/set lineage, evidence integrity, scoring, system output, and downstream claims.
- Session Flow Control: the distinction between session context and drill type across Intro, Active Training, and Handover Verification.
- Drill Library: Diagnosis, Training, and Verification modes; four phase lanes; prep; set purpose; rep purpose; and constraints.
- Handover Verification: inherited topic, phase, and stability; short continuity verification; hold, tighten, or targeted re-verification; and reopening normal training only after clearance.
- Tools Required: compulsory smartphone, mini ring light, and earphones; clear top-down handwritten delivery; optional gooseneck holder; and pre-session visibility/audio checks.

## 9. Rotating forms

Every deep dive has three deterministic fifteen-question prompt forms: A, B, and C.

The form is assigned from the number of prior attempts on that deep dive:

- attempt 1 uses Form A;
- attempt 2 uses Form B;
- attempt 3 uses Form C;
- later attempts repeat the rotation.

Stable competency keys remain the same so longitudinal reporting is preserved, while the concrete scenario wording changes. The server validates the assigned form and stores it with each rep. Repeated completion therefore tests the same operating judgment without presenting an identical script three times in succession.

## 10. Training Mode assignment

The system-selected next Battle Tests are the run assignment.

When the TD opens a Training Mode audit:

- all highest-priority recommended deep dives are preselected;
- manual substitution is disabled for that assigned run;
- the correct form is materialised from each deep dive's prior-attempt count; and
- all fifteen questions in every assigned deep dive must be answered before submission.

Training Mode may assign more than one deep dive in a sitting, but each assigned deep dive remains a separate fifteen-question audit bank inside that run. For example, two assigned deep dives produce thirty questions; three assigned deep dives produce forty-five questions.

Manual bank selection remains available only when no system assignment exists or when an authorised non-training audit explicitly calls for it.

## 11. Mode-appropriate outcomes

Run action text must not assume every subject already has live responsibility.

- Fail: block progression or pause live responsibility as applicable; recondition before the next operating step.
- Watchlist: correct the identified drift and retest before treating the deep dive as locked.
- Locked: continue only if the remaining training, sandbox, trial, and operating gates are also satisfied.

## 12. Acceptance tests

The upgrade is complete only when automated checks prove that:

1. all eleven canonical tutor banks exist and each materialised deep dive form contains exactly fifteen questions;
2. no active bank uses a fallback definition;
3. every question has an expected answer, fail indicators, and Clear/Partial/Fail guidance;
4. every deep dive includes application, evidence-integrity, contamination, and system-authority coverage where relevant;
5. every materialised form includes at least one concrete automatic critical-fail scenario;
6. Forms A, B, and C differ while retaining stable competency keys;
7. the server rejects missing answer evidence, duplicate answers, unknown questions, and a stale or invalid form;
8. stored rep logs include answer evidence, scoring guidance, form key, and critical-fail reason;
9. the Training Mode runner opens all system-assigned deep dives in fixed mode;
10. history review displays the answer evidence needed to audit the assessor's score;
11. a critical fail overrides the numeric outcome;
12. the fifteen-question point resolution can produce Locked, Watchlist, and Fail outcomes; and
13. the complete TypeScript check and focused Battle Test suite pass.

## 13. Source-of-truth rule

The live drill registry and current Response Integrity OS implementation remain authoritative for phase names, set names, constraints, observation fields, diagnosis movement, and system authority.

If a Battle Test source conflicts with the live registry, the bank is invalid and must fail semantic integrity tests before release.
