# Capability V2R8 Manual Authoring Checkpoint — 2026-09-17

Status: INTRO SESSION STRUCTURE AUTHORING RESUMED — 2026-09-22
Branch: `proof/capability-engine-shadow-validation`
PR: #45 `Capability Engine shadow validation`
Production: untouched
Proof activation/import: not authorized by this checkpoint

## Why this checkpoint exists

This file is the recovery point for the current Capability V2R8 manual-authoring effort. It is intentionally detailed enough that a new reviewer can understand what has been completed, what quality standard was established, where authoring stopped, why it stopped, and what must be true before authoring resumes.

The private assessment corpus itself must remain outside the public repository. This file records status, reasoning, review standards, bank ownership, product decisions exposed by review, and restart instructions. It does not publish evaluator prompts, answer keys, explanations, or private review ledgers.

## Current authoring position

V2R8 is no longer being treated as a generated 895-item content rebuild. The current approach is manual human authoring bank by bank. Scripts may validate structure later, but they do not write prompts, options, correct answers, or explanations.

Five mastery banks have now completed manual item-level authoring and human approval:

| Bank | Status | Approved items |
| --- | --- | ---: |
| Clarity | manually authored and human-approved | 45/45 |
| Structured Execution | manually authored and human-approved | 45/45 |
| Controlled Discomfort | manually authored and human-approved | 45/45 |
| Time Pressure Stability | manually authored and human-approved | 45/45 |
| Topic Conditioning | manually authored and human-approved | 45/45 |

Total currently approved mastery content: **225 items across 5 banks**.

These banks are **approved for the current human-authoring stage, not frozen for release**. Final source, coverage, duplicate, critical-boundary, answer-position, distractor-quality, option-parity, and package-integrity audits still happen after the complete bank set is authored.

The remaining mastery order is:

1. Intro Session Structure
2. Logging System
3. Session Flow Control
4. Drill Library
5. Handover Verification
6. Tools Required

Only after those six mastery banks are complete should V2R8 proceed to the cumulative Retrieval/Transfer banks.


## Resume update — 2026-09-22

The Intro authoring freeze has been lifted for content work after re-verifying PR #47 against its current evidence-complete diagnosis runtime.

The restart gate is now treated as satisfied for authoring because the live PR #47 path has the evidence-complete Specialist runner, server-authoritative replay, durable partial-run persistence, concrete behavior observation matrix, contamination handling, topic-scoped multi-topic operation, evidence-ledger explanation, behavior-derived Low/Medium/High placement, targeted re-diagnosis integration, and green core CI/proof evidence. The only remaining PR #47 acceptance item is the Founder's final merge decision.

A source drift was found during restart review: the live `Intro Session Structure` Deep Dive still described the retired fixed phase-block / numeric score-band workflow even though the actual runtime had moved to evidence-complete diagnosis. That Deep Dive was reconciled on PR #47 at commit `e2c79687af322eb83341791a1c9bc0bab7470fe9` before authoring resumed. The new Deep Dive now reflects evidence-complete diagnosis, concrete behavior recording, not-observed/confounded outcomes, intervention separation, constraint stripping, evidence-justified repetition, categorical stability, multi-topic diagnosis, completion explanation, and the boundary that High Maintenance is training-earned.

Therefore the authoring rule from this point is: use the final PR #47 runtime + the reconciled Intro Deep Dive as the source of truth. Do not reuse the withdrawn old Intro items 3-5 or any fixed-score-band logic.

## Exact stop point: Intro Session Structure

Intro Session Structure was opened as Bank 6. The first five draft items were reviewed against the then-live Intro Deep Dive.

The authoring session is now intentionally frozen before continuing because the live diagnosis architecture is being replaced by PR #47, `Evidence-complete diagnosis engine`, on branch `feat/evidence-complete-diagnosis`.

### Intro items retained conceptually

Only the first two draft concepts remain provisionally useful:

- **Intro item 1 concept:** Intro exists to establish the correct training entry point inside a real topic. Intro is not a full teaching/training cycle.
- **Intro item 2 concept:** A recommended starting phase is a starting hypothesis, not the final answer. Placement must be verified from the student's actual response evidence.

Even these two must be re-read against the final live Specialist experience after PR #47 is integrated. Their concepts are retained; their exact wording is not frozen.

### Intro items withdrawn

Draft Intro items 3, 4, and 5 are withdrawn from V2R8 authoring because they depend on the current fixed phase-block / score-band diagnosis experience:

- moving through adjacent phase blocks from an 80-100 band;
- locking placement from a 45-79 band;
- the rule that Intro uses one completed phase verification block at a time.

Those mechanics are specifically being superseded by the evidence-complete diagnosis architecture. They must not be treated as reusable canonical assessment content.

## Diagnosis redesign that blocks Intro authoring

PR #47 is a draft from `main`. Its architecture materially changes what a truthful Intro Session Structure bank must test.

The new diagnosis contract establishes:

- diagnosis is **evidence-complete, not rep-complete**;
- every diagnostic opportunity exists to answer a named evidence question;
- one student response may generate valid evidence across multiple response layers;
- strong higher-constraint evidence may support directly observed lower layers;
- failure under a higher constraint does not automatically condemn lower layers;
- the engine strips constraints to isolate the earliest unsupported or unresolved response layer;
- repetition exists only when the unresolved evidence itself requires repeatability, recovery, consistency, or conflict resolution;
- teaching, first-step intervention, rescue, or mathematical cueing cannot silently remain clean baseline diagnosis evidence;
- diagnosis may place a topic at Low, Medium, or High;
- diagnosis cannot mint High Maintenance;
- the Specialist is a guided observer, not the placement engine;
- the system selects the next probe from evidence, not Specialist intuition;
- diagnosis is topic-scoped and the same law applies whether a session diagnoses one topic or several;
- the server must independently reproduce the client decision from durable evidence;
- early stop must persist honestly without fake missing reps.

The current PR #47 foundation includes the deterministic engine, probe catalog, contamination rules, constraint stripping, starting-stability logic, invariant tests, and the canonical evidence-complete diagnosis contract.

### PR #47 is not yet the live Specialist experience

At this checkpoint PR #47 remains draft. The architecture foundation is built, but the live `IntroSessionDrillRunner`, server submission validation, Response Snapshot, and durable evidence-ledger persistence still use the old fixed phase-block payload.

Therefore V2R8 Intro authoring stays paused until the actual Specialist flow, server contract, persistence, and live Deep Dive are migrated and validated. We will author against the truthful implemented experience, not against either an old design or an unfinished new design.

## Restart gate for Intro Session Structure

Do not resume Intro authoring merely because PR #47 has more code. Resume only after all of the following are true:

1. named diagnosis probes are wired through the Specialist UI;
2. Specialist observation capture maps cleanly to the new evidence dimensions;
3. the client cannot choose arbitrary next probes;
4. the server independently recomputes the diagnosis decision;
5. early completion persists without fake repetitions;
6. contaminated/tutoring-assisted attempts cannot determine baseline placement;
7. Low, Medium, and High starting placements are reachable as designed;
8. multi-topic diagnosis keeps independent topic evidence state;
9. Response Snapshot / evidence ledger can explain why each opportunity ran and why diagnosis stopped;
10. the live Intro Deep Dive and Specialist-facing copy describe the new experience accurately;
11. CI and end-to-end proof are green for the migrated path;
12. the old fixed-block assumptions are no longer presented as the canonical Intro workflow.

After that gate, re-read the live Intro Session Structure source first. Revalidate the retained concepts for items 1 and 2, discard the old 3-5 mechanics, then restart Intro as a fresh 45-item manual bank in 9 passes of 5.

## V2R8 manual-authoring doctrine

The authoring process is now itself part of the quality contract.

### 1. Manual writing, automation only for QA

Every prompt, option, correct answer, and explanation is consciously authored. Metadata follows the item; metadata does not generate the item.

Scripts may later verify:

- exact item count;
- unique keys;
- four valid options;
- one keyed answer;
- source and competency coverage;
- critical-boundary coverage;
- exact and near duplicates;
- answer-position distribution;
- deterministic form feasibility;
- hash and import integrity.

Scripts do not write the assessment language.

### 2. Each bank needs hard ownership

All eleven banks belong to one operating system, so some conceptual overlap is unavoidable. But a question belongs in a bank only when removing it would weaken that bank's unique capability test.

Examples established during Topic Conditioning review:

- observable fact vs inferred psychology -> Logging;
- support-boundary mechanics -> relevant phase / Drill Library / cumulative transfer;
- post-submit evidence correction -> Logging / evidence integrity;
- set counts and phase ownership -> Drill Library;
- live sequence control -> Session Flow Control;
- topic as arena, Topic x Phase x Stability, topic-specific state, and interpreting where response breaks inside a topic -> Topic Conditioning.

Several initially good Topic Conditioning items were explicitly removed because they were good questions in the wrong bank. Bank distinctness is more important than preserving a drafted item.

### 3. Capability should be tested across five lenses

Where appropriate, a bank should expose whether the Specialist possesses:

- **Presence / structure:** knows what exists, where it belongs, counts, sets, conditions, and operating structure;
- **Meaning / vocabulary:** distinguishes concepts correctly;
- **Method:** can execute the system correctly;
- **Reason:** understands why the rule exists and what it protects;
- **Discernment:** can choose correctly among several nearby, plausible RI actions.

A Specialist should not pass by memorizing labels while failing to understand the capability being built.

### 4. Distractors must be genuinely dangerous

A distractor should represent something a reasonable but insufficiently trained Specialist might actually believe.

The preferred distractor is often **mostly legitimate RI reasoning with one decisive error**: wrong sequence, wrong evidence source, wrong inference, wrong boundary, wrong capability, wrong ownership, or a valid rule applied in the wrong place.

Do not use obvious killers such as:

- `move on when the Specialist feels satisfied`;
- `choose whichever drill feels right`;
- exaggeratedly careless or anti-system behavior that no trained Specialist would select.

If an option can be eliminated because it sounds unserious rather than because its reasoning is wrong, rewrite it.

### 5. Option parity is a psychological assessment requirement

The correct answer must not reveal itself through writing quality.

Across A-D, aim for comparable:

- grammatical polish;
- conceptual density;
- professionalism;
- confidence;
- explanatory depth;
- sentence length where practical;
- relationship to legitimate RI concepts.

A reviewer should not be able to scan the options and identify the polished, sensible sentence before actually reasoning about the doctrine.

### 6. Avoid answer-cue stems

Do not put the phase name or the decisive clue directly into the stem when the capability is what the student must identify.

Example already established during TPS review: instead of saying `under a timer`, a stem can describe a `fixed completion window` and make the Specialist infer that the response is breaking when execution must fit within that window.

### 7. Name the real capability when cross-system reasoning naturally appears

Do not hide behind generic phrases such as `the next response capability` when the question naturally benefits from naming what is actually being conditioned.

Example established in Topic Conditioning: movement from Clarity into Structured Execution should expose that the next capability is **independent, ordered, repeatable execution of the known method without being carried by the Specialist**.

This strengthens cross-system fluency without turning every item into a duplicate of the phase bank.

### 8. Evidence is the reason; the OS is not an object of obedience

Avoid language that teaches `do this because the system says so`.

The causal story should be:

**student response -> recorded evidence -> consistent interpretation -> next conditioning action**

The system exists to preserve evidence integrity and interpret evidence consistently. The student's actual response is the reason a placement, hold, next action, or progression is warranted.

During the final all-bank audit, explicitly search for wording such as `because the OS says`, `the system decided`, or `the rules require` and verify that the item teaches the evidence underneath the decision.

### 9. Explanations must teach, not merely restate

A correct-answer explanation should explain the distinction that makes the answer correct and the competing reasoning wrong. It should make the assessment itself a training instrument.

### 10. Scenarios must reflect implemented product truth

A bank cannot certify a Specialist against a workflow the product does not actually support. If review exposes that the assessment is testing an imagined product rule, stop authoring, resolve the product truth, update the live experience, then return to the bank.

The current Intro pause exists because this rule is being followed.

## Topic Conditioning — completed bank checkpoint

Topic Conditioning is now 45/45 manually authored and human-approved.

Its distinct ownership was clarified during review:

- a **topic is the arena**;
- Topic + Phase + Stability is the conditioning map;
- phase describes the response capability currently being conditioned inside that topic;
- stability describes how reliably that capability is holding;
- a student has topic-specific state, not one global mathematics phase;
- evidence from one topic does not automatically move another topic;
- a parent signal, school mark, confidence report, hesitation, freezing, or classroom behavior is context or a starting signal, not automatically a phase diagnosis;
- the Specialist must locate the capability that actually holds or breaks inside that topic;
- strong school performance may coexist with a response breakdown under changed form, uncertainty, independence, or pressure;
- good teaching and genuine understanding can establish strong Clarity without proving that the response is conditioned through later phases;
- one-to-one conditioning is valuable because the Specialist can observe the learner's individual response and pace without assuming that group pace reveals every learner's needs;
- these one-to-one advantages are capabilities RI can provide, not claims that every learner is embarrassed, hidden, slow, or mismatched to classroom pace;
- Topic Conditioning is not ordinary content completion, and it is not racing a topic through all four phases;
- evidence, not generic impressions of `going well`, determines what the topic is ready for next.

### Topic Conditioning review decisions worth preserving

The final bank was improved by several important review corrections:

- six drafted items were pulled because they belonged to Logging, support integrity, broader phase mechanics, or correction workflow rather than Topic Conditioning;
- the bank was rebuilt around map literacy, topic selection, topic-specific state, parent/school signals, cross-phase diagnosis inside a topic, cadence/repetition, and the distinction between understanding and conditioned response;
- a distractor that ended with `when the Specialist is satisfied` was rewritten because it was an obvious elimination cue;
- options were extended to include their reasoning so that the assessment tests the logic behind the choice rather than recognition of a short slogan;
- vague system-authority wording was replaced with evidence-led language;
- when Structured Execution was referenced, the actual capability was named instead of saying only `the next response capability`;
- a distractor that sounded casual beside a polished correct answer was rewritten to match the correct answer's sophistication;
- a cross-topic transfer distractor was strengthened by naming the actual Structured Execution capability the student had demonstrated in the other topic.

This bank is the current benchmark for distractor quality and bank distinctness.

## Relationship to the older generated V2 candidate

The earlier 16-bank generated candidate remains historical evidence of structural work. It is not the current content source of truth for V2R8 manual authoring.

Do not copy old generated prompts merely because they already exist. Historical banks may be consulted for coverage, competency names, critical boundaries, or product questions, but the current questions must be manually authored against live doctrine and implemented product truth.

The old `CAPABILITY_PRIVATE_BANK_V2_AUTHORING_CHECKPOINT.md` therefore describes a historical generated-candidate state and must not be mistaken for the current V2R8 manual-authoring checkpoint.

## Private-content boundary

Do not commit the raw manually authored assessment corpus, answer keys, evaluator explanations, or private review ledger to the public repository.

The public branch may contain:

- authoring contracts;
- aggregate status;
- product decision registers;
- non-secret source/coverage metadata;
- review principles;
- hashes after a private artifact is deliberately frozen;
- proof outcomes and release gates.

The exact private evaluator corpus must remain in the approved private artifact path until a deliberate private-bank freeze/import step.

## Specialist Development pathway context

The current Specialist Development architecture is:

**Application → Training → Sandbox → Practicals → Trial → Certification → Certified Live**

These are separate capability stages and should not be allowed to overlap conceptually in future implementation or assessment authoring.

### Application

Application is selection and eligibility only. It determines whether the person meets requirements and should enter Specialist Development. It is not a training or capability-validation stage.

### Training

Training is where the Specialist learns and demonstrates understanding of the Response Integrity operating system.

Training includes:

- the live Deep Dives;
- repeated study and reference;
- interactive Capability Checks;
- scenario-based application of doctrine;
- deterministic feedback and evaluation;
- mastery evidence across the required capabilities.

**The Capability Engine belongs in Training.** The interactive Capability work already built on this proof branch remains useful, but older descriptions that call those checks `Sandbox`, `simulations`, or Sandbox-style validation are stale architecture and should be reconciled.

This is also the intended answer to the old auditor-burden problem: as much repeated mastery validation as is safely possible should happen deterministically and independently during Training, while human judgment is concentrated later where observation of actual conduct adds more value.

### Sandbox

Sandbox is not another knowledge assessment. It is a deterministic simulation environment for practising **observation, discernment, and operation of the real RI delivery system**.

A simulation should provide predefined, versioned student behaviour across realistic drill situations. The Specialist observes the simulated response and logs what they believe happened using the same evidence logic used in delivery. The system can then compare:

**canonical simulated student behaviour**

against

**the Specialist's interpretation and recorded evidence**.

This makes patterns such as over-crediting late recovery, missing earlier weak responses, or misclassifying observable behaviour detectable before real-family exposure.

The MVP should remain deterministic and inexpensive. A bounded starting proof may use one phase, one drill type, a small scenario matrix, predefined rep outcomes, persistent simulation evidence, evaluator visibility, and the real RI drill/state machinery wherever practical rather than a separate toy workflow.

### Practicals

Practicals are a separate visible-execution stage between Sandbox and Trial.

Training can establish understanding. Sandbox can establish simulated observation and operation. Neither proves how the Specialist actually conducts themselves.

The Practical principle is:

> **Do not merely tell us what you would do. Show us.**

Practical submissions may eventually require Specialists to demonstrate concept breakdown using the RI lens, Vocabulary-Method-Reason / mental-map use, opening and conducting a drill, understanding what phases/sets/reps mean and exist for, and defined session sections from start to finish. Video evidence can expose communication, pacing, explanation, and delivery weaknesses before a real family is involved.

### Trial

Trial is governed real-family validation. By the time a Specialist reaches Trial, they should already have demonstrated:

- understanding through Training;
- observation and system operation through Sandbox;
- visible execution through Practicals.

Trial validates whether those capabilities survive repeated live delivery with real students and parents. It should not be the first place the organization discovers that someone cannot conduct a drill or explain the RI method.

### Certification and Certified Live

These are distinct.

- **Certification** is the final decision gate.
- **Certified Live** is the operating state granted after the certification decision passes.

### Capability-authoring implication

V2R8 mastery/retrieval/transfer work belongs to **Training**. It should certify understanding, doctrine application, and scenario reasoning. It must not silently expand until it is trying to certify the things that properly belong to Sandbox or Practicals.

That means future cumulative banks can test transfer of RI understanding across scenarios, but they should not pretend that a multiple-choice/scenario assessment proves live observation, system operation in simulation, visible delivery, communication, pacing, or real-family execution.

During later source-of-truth reconciliation, search for and correct older references that blur:

- Training and Sandbox;
- Capability Checks and simulations;
- Sandbox and mock trial;
- manual repeated auditing and deterministic Training mastery;
- Trial and first-time execution validation;
- Certification and Certified Live.

## Resume sequence after diagnosis migration

When PR #47's live diagnosis migration is genuinely complete:

1. inspect the final PR #47 implementation and acceptance evidence;
2. read the updated live Intro Session Structure Deep Dive;
3. compare the Specialist UI, server validation, persistence, and evidence ledger with the Deep Dive;
4. revalidate Intro concepts 1 and 2;
5. permanently discard the old draft mechanics from items 3-5;
6. define Intro Session Structure's unique 45-item ownership before writing further items;
7. author Intro in 9 passes of 5 using the established distractor and option-parity standard;
8. continue Logging -> Session Flow -> Drill Library -> Handover -> Tools;
9. author cumulative Retrieval/Transfer banks only after all 11 mastery banks are complete;
10. run the full all-bank pre-freeze audit only after authoring is finished.

## Final all-bank audit that remains pending

Human approval during authoring is not the final freeze.

Before V2R8 can be frozen/imported, every bank must pass a deliberate review for:

- source truth against the final live Deep Dive and product contract;
- exact bank ownership and cross-bank duplication;
- exactly 45 mastery items per bank;
- four valid options and exactly one correct answer per item;
- critical-boundary coverage;
- competency/coverage completeness;
- exact duplicate prompts;
- near-duplicate reasoning patterns;
- answer-position distribution;
- answer-length and sophistication clues;
- obvious distractors;
- option-parity failures;
- answer-cue stems;
- generic `system says so` reasoning;
- unsupported psychological claims;
- scenarios that imply Specialist powers the live product does not grant;
- explanations that merely restate the answer rather than teaching the doctrine.

Only after this human audit should automated release validation, private artifact freeze, new hashes, inactive RI Proof import, persisted-source verification, and separately approved activation occur.

## Recovery summary

If this work is resumed in a new session, the shortest correct summary is:

**Five mastery banks are manually authored and approved: Clarity, Structured Execution, Controlled Discomfort, Time Pressure Stability, and Topic Conditioning. Topic Conditioning is 45/45 and is the current distractor-quality benchmark. Intro Session Structure started but authoring is paused because PR #47 is replacing fixed rep/phase-block diagnosis with an evidence-complete diagnosis engine. Keep only the concepts from Intro draft items 1-2, discard old items 3-5, and do not resume until the new diagnosis flow is live, persisted, server-reproducible, documented, and end-to-end proven. The Specialist Development pathway is Application → Training → Sandbox → Practicals → Trial → Certification → Certified Live; Capability Engine/V2R8 assessment work belongs in Training, Sandbox is deterministic simulated observation/operation, Practicals are visible execution, Trial is governed real-family validation, Certification is the gate, and Certified Live is the resulting operating state. Then author Intro from the final truthful Specialist experience.**