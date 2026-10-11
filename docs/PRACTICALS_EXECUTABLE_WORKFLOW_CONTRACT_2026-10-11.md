# Practicals — provisioned execution and live walkthrough acceptance contract

**Authority:** Founder, 11 October 2026. **Tracking:** #182, PR #180. **Release status:** not implemented/approved until every acceptance check is proven. This is an engineering and TD acceptance specification, not a claim that current code meets it.

## Definition

A Specialist passes Practicals by **performing** a system-issued RI-OS workflow in an isolated, faithful practice environment **while** talking through meaningful decisions and student-facing conduct on uninterrupted video. The recorded explanation supplements observable action; it cannot replace action. The same underlying phase, drill, support, evidence and next-action contracts used by the operating system and Sandbox must govern the assessment. Trial, separately, establishes repeated conduct with real families.

### Required operating cycle for each case

1. **Provision:** server assigns a versioned, comparable, fictional state and reveals it only at the current case boundary; includes actual permitted mode, drill/set, constraints, evidence fields, prior baseline/timer state as relevant, and functional tools.
2. **Prepare:** Specialist accesses the issued state and configures the working environment, work visibility, session/rep plan and correct tools in the simulated operating surface. Save the configuration as an attributable event.
3. **Execute:** Specialist actually runs the specified simulated step(s) in the RI workflow: performs prompts, responds to student turns, chooses interventions, handles interruptions, observes reps, uses timer/baseline evidence and submits operating decisions as appropriate. Save every state-changing action, not just retrospective prose.
4. **Walk through:** Specialist audibly gives real student-facing language and explains boundaries, observation versus inference, decision reasons and next action *as they perform it*. Video matches issued references and server event sequence.
5. **Log:** Specialist uses the real evidence schema semantics to record rep-specific observations, evidence status, support contamination, timing and justified next action. No invented independence, repair of unseen work or manual phase movement.
6. **Verify:** the assigned TD independently inspects the entire original continuous video against the immutable issued-case/action/evidence history and applies versioned case-level observable judgments.

## Cases

| Practical | Case | Observable execution |
| --- | --- | --- |
| Prepare | Clarity entry | Inspect provisioned state, instantiate correct Clarity drill and work-view, set instruction/observation boundaries |
| Prepare | Structured Execution | Prepare and run a no-support independent set, actual materials, rep conditions and evidence capture controls |
| Prepare | TPS missing baseline | Establish the missing SE independent three-rep baseline evidence opportunity using real timing/observation controls; do not invent a TPS target |
| Execute | Clarity ambiguity | Deliver an actual student-facing response to the live fictional prompt; capture resultant observation and intervention |
| Execute | Controlled Discomfort | Run full responsive student interaction, with no-rescue, observable decisions and durable interventions/logs |
| Execute | TPS interruption | Handle injected camera/timer interruption in the actual simulated flow; capture unobserved/confounded evidence and governed recovery |
| Evidence | Assisted vs independent | Use active rep-logging fields to classify prompt/method reminder/no-support reps accurately |
| Evidence | Not observed | Log camera-loss rep evidence and supported rep separately; reject unsupported stability claim and choose recovery |
| Evidence | Mixed TPS phase exit | Enter clean, timing-invalid and assisted reps with actual lineage; preserve system-owned phase-exit authority |

## Required testable release gates

- No `next`, `finish`, submission or TD approval may succeed with a case that lacks its complete, persisted, matched **execution record**. The current PR #180 case text plus free `Save case and reveal next` behavior is insufficient, even if video is uploaded.
- Use private issued case material, future-case concealment, exact case/version/attempt binding, append-only server operations and replay/skip protection. Validate Specialist assignment and TD ownership at each endpoint.
- Isolated Practicals execution must not mutate genuine student/parent data, Sandbox capability graduation, package consumption, Trial or Certified Live permissions.
- Actual recorded video duration is captured and compared with server issuance chronology and TD observation, but former 10–18 / 12–22 / 10–18 minute estimates **cannot be used as automatic pass/fail limits** before calibrated evidence supports a policy. One continuous, full-length, original video from before reveal through final confirmation remains mandatory. Cuts, gaps, missing views or mismatched performance still block.
- TD has durable per-case actions, rep-level evidence and a usable review projection plus the video. TD notes cite concrete conduct; not merely explanation quality.
- Tests must include all nine positive *execution* paths, and negative skip/click-through/description-only/rewritten evidence, case leak, identity mismatch, unobserved rep, no-rescue breach and video-integrity failure.
- The entire flow needs exact-head CI plus authenticated controlled preview acceptance with a real authorized test identity. Protected production database plan, approved apply, ledger/guard readback and release verification are separate and remain mandatory.

## Current status / blockers

As of the original PR #180 head `435053fa37684badd4cd49b66ebf58be7fe7212e`, only the Controlled Discomfort Execute case has a stateful three-turn workflow. The remaining cases show prompts and allow direct advance, without server-mandated persisted hands-on case operations. Thus Practicals is **not ready for production qualification**. The implementation must become at least as operationally authentic as Sandbox, while remaining isolated from live data.

No broader Founder reapproval of the principles is needed; technical implementation and evidence are Technology/Founder Office responsibilities. Keep PR #180 draft/unmerged until these gates pass.
