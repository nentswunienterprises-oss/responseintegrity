# Weekly and Monthly Reports: Full Engine and Output Breakdown

**Canonical reference**
The single source of truth for live Response Integrity-OS algorithm rules is [Response Integrity-OS Live Implementation Source of Truth](response-integrity-os-implementation-source-of-truth.md).
This file is a report-specific derivative explainer.
If any shared engine rule here conflicts with the canonical spec or current code, the canonical spec wins and this file must be brought back into alignment.

This document describes how Response Integrity weekly and monthly reports are currently built, which engines contribute to them, where each output line comes from, and what the possible scenario outputs are.

Primary code paths:

- Report generation: `server/routes.ts`
- Parent report mapping: `server/routes.ts` `mapParentFacingReport`
- Parent display: `client/src/pages/client/parent/progress.tsx`
- Tutor display: `client/src/components/tutor/StudentReportsDialog.tsx`
- Shared phase/stability/meaning/action engines: `shared/topicConditioningEngine.ts`

## End-to-end flow

1. A tutor submits diagnosis or training drill data.
2. The drill row is stored in `intro_session_drills`.
3. `maybeAutoSendDeterministicReports(studentId, tutorId)` runs after drill submission.
4. The system fetches all drill rows for the student and tutor.
5. Each drill row is normalized by `mapDrillRowToDeterministicSession`.
6. Handover verification drills are ignored for weekly/monthly reports.
7. Drill rows are grouped into session groups by `sessionGroupId`.
8. Weekly windows are created from every `2` completed session groups.
9. Monthly windows are created from every `8` completed session groups.
10. Each report window becomes structured JSON.
11. Structured JSON is inserted into `parent_reports.summary`.
12. Legacy columns are also populated for compatibility.
13. Parent reports are fetched through `/api/parent/reports`.
14. `mapParentFacingReport` converts stored report rows into parent UI fields.
15. Parent UI renders weekly and monthly cards.

## Trigger rules

### Weekly

Two-session conditioning updates are generated from pairs of completed session groups.

Window rule:

- Session groups are sorted by earliest date.
- The system creates windows using indexes `[0,1]`, `[2,3]`, `[4,5]`, etc.
- A leftover single session does not generate a weekly report yet.

Generated after:

- `2` completed session groups.

### Monthly

Eight-session conditioning reports are generated from sets of eight completed session groups.

Window rule:

- Session groups are sorted by earliest date.
- The system creates windows using indexes `[0..7]`, `[8..15]`, etc.
- Fewer than eight pending session groups do not generate a monthly report yet.

These are evidence thresholds rather than calendar promises. The stored report types remain `weekly` and `monthly` for compatibility, while parent and tutor interfaces should describe the thresholds directly.

Generated after:

- `8` completed session groups.

## Source drill normalization

Each drill row becomes a deterministic session with these report-relevant fields:

- `id`
- `date`
- `sessionGroupId`
- `topic`
- `drillType`
- `behaviorPatterns`
- `score`
- `phaseBefore`
- `phaseAfter`
- `stabilityBefore`
- `stabilityAfter`
- `nextAction`
- `transitionReason`
- `deterministicLog`

### Diagnosis drill normalization

Diagnosis rows use:

- topic from `introTopic` or `trainingTopic`
- phase from `phase` or `summary.phase`
- stability from `summary.stability`
- diagnosis score from `summary.diagnosisScore`
- transition reason is always `remain`
- phase after is the diagnosis/training entry phase
- next action comes from `summary.nextAction` or `NEXT_ACTION_ENGINE`

Diagnosis reports can still contribute to weekly/monthly windows because diagnosis rows become deterministic sessions.

### Training drill normalization

Training rows use:

- topic from `trainingTopic` or `introTopic`
- phase before from submitted/current phase
- phase after from `summary.phase`
- previous stability from `summary.previousStability`
- stability after from `summary.stability`
- transition reason from `summary.transitionReason` or `summary.transition_reason`
- if missing, `phaseDecision` can infer:
- `advance` -> `phase progress`
- `regress` -> `stability regress`
- anything else -> `remain`

### Handover verification rows

Handover verification rows return `null` from report normalization.

Result:

- They do not contribute to weekly/monthly parent reports.

## Phase engine

Valid phases:

- `Clarity`
- `Structured Execution`
- `Controlled Discomfort`
- `Time Pressure Stability`

Phase purposes used in monthly `Next Month Focus`:

- `Clarity`: `the four-layer mental model: what the problem is, how to solve it, why it works, and applying that clarity`
- `Structured Execution`: `following steps independently`
- `Controlled Discomfort`: `staying stable under difficulty`
- `Time Pressure Stability`: `maintaining structure under time`

## Stability engine

Valid stability states:

- `Low`
- `Medium`
- `High`
- `High Maintenance`

Stability scores used for ranking/report comparison:

- `Low` -> `1`
- `Medium` -> `2`
- `High` -> `3`
- `High Maintenance` -> `4`

Report scoring rank:

- phase rank is multiplied by `10`
- stability rank is added
- this lets the report engine detect whether a topic moved forward between first and last drill state

Phase rank:

- `Clarity` -> `0`
- `Structured Execution` -> `1`
- `Controlled Discomfort` -> `2`
- `Time Pressure Stability` -> `3`

Example:

- `Structured Execution (Medium)` -> `1 * 10 + 1 = 11`
- `Structured Execution (High)` -> `1 * 10 + 2 = 12`
- `Controlled Discomfort (Low)` -> `2 * 10 + 0 = 20`

## Transition engine

The transition engine receives:

- previous phase
- previous stability
- drill total out of 100

It returns:

- next phase
- next stability
- transition reason

### Low stability

Score `0-49`:

- next stability: `Low`
- transition reason: `remain`

Score `50-79`:

- next stability: `Medium`
- transition reason: `stability advance`

Score `80-100`:

- next stability: `High`
- transition reason: `stability advance`

### Medium stability

Score `0-44`:

- next stability: `Low`
- transition reason: `stability regress`

Score `45-79`:

- next stability: `Medium`
- transition reason: `remain`

Score `80-100`:

- next stability: `High`
- transition reason: `stability advance`

### High stability

Score `0-49`:

- next stability: `Medium`
- transition reason: `stability regress`

Score `50-84`:

- next stability: `High`
- transition reason: `remain`

Score `85-100`:

- next stability: `High Maintenance`
- transition reason: `stability advance`

### High Maintenance stability

Score `0-59`:

- next stability: `High`
- transition reason: `stability regress`

Score `60-84`:

- next stability: `High Maintenance`
- transition reason: `remain`

Score `85-100`, non-final phase:

- next phase: next phase in sequence
- next stability: `Low`
- transition reason: `phase progress`

Score `85-100`, final phase:

- phase remains `Time Pressure Stability`
- stability remains `High Maintenance`
- transition reason: `remain`

## Transition reason normalization

Only four transition reasons survive normalization:

- `remain`
- `stability advance`
- `stability regress`
- `phase progress`

Anything unknown becomes:

- `remain`

If stored transition reason is absent, `phaseDecision` can infer:

- `advance` -> `phase progress`
- `regress` -> `stability regress`
- anything else -> `remain`

## Observation-to-behavior engine

Raw drill observations become behavior labels through `mapObservationsToBehavior`.

The engine reads observation signal keys and values.

Values are normalized into:

- `weak`
- `partial`
- `clear`

Important rule:

- `partial` does not create a behavior label.
- `weak` creates a weak behavior label.
- `clear` creates a strong behavior label.

If no signal maps:

- `no mapped observation signal detected`

That fallback is filtered out before report behavior aggregation.

## Observation signal extraction

The report engine extracts signals from drill observations like this:

1. If fields ending in `_level` exist, those are used.
2. The `_level` suffix is removed from the key.
3. If no `_level` fields exist, all non-empty observation fields are used.

Example:

- `start_behavior_level: "weak"` becomes `{ key: "start_behavior", value: "weak" }`
- `step_execution_level: "clear"` becomes `{ key: "step_execution", value: "clear" }`

## Full observation behavior mapping

### Clarity behavior rule

Aliases:

- `vocabulary`
- `reason`
- `immediate_apply`
- `immediateapply`

Weak output:

- `clarity breakdown`

Clear output:

- `clearer concept recall`

Absolute version:

- `clear concept recall`

### Method behavior rule

Aliases:

- `method`
- `step`
- `execution`
- `repeatability`

Weak output:

- `inconsistent step execution`

Clear output:

- `more reliable step execution`

Absolute version:

- `reliable step execution`

### Independence behavior rule

Aliases:

- `independence`
- `dependence`
- `support`
- `rescue`

Weak output:

- `early dependence`

Clear output:

- `more independent execution`

Absolute version:

- `independent execution`

### Start behavior rule

Aliases:

- `start`
- `initial`

Weak output:

- `delayed starts`

Clear output:

- `earlier independent starts`

Absolute version:

- `independent starts`

### Difficulty behavior rule

Aliases:

- `boss`
- `discomfort`
- `pressure`
- `first_step`

Weak output:

- `hesitation under pressure`

Clear output:

- `better control under difficulty`

Absolute version:

- `control under difficulty`

### Structure behavior rule

Aliases:

- `structure`
- `completion`
- `integrity`

Weak output:

- `structure breakdown`

Clear output:

- `stronger structure retention`

Absolute version:

- `structure retention`

### Pace behavior rule

Aliases:

- `pace`
- `time`
- `speed`

Weak output:

- `pace loss`

Clear output:

- `more controlled pace`

Absolute version:

- `controlled pace`

## Weak vs strong buckets

After behavior labels are created, report generation divides them into weak and strong buckets.

Weak behavior labels are any labels matching:

- `breakdown`
- `dependence`
- `hesitation`
- `delayed`
- `pace loss`
- `inconsistent`

Current weak labels from the mapping:

- `clarity breakdown`
- `inconsistent step execution`
- `early dependence`
- `delayed starts`
- `hesitation under pressure`
- `structure breakdown`
- `pace loss`

Current strong labels from the mapping:

- `clearer concept recall`
- `more reliable step execution`
- `more independent execution`
- `earlier independent starts`
- `better control under difficulty`
- `stronger structure retention`
- `more controlled pace`

Current strong labels after absolute normalization:

- `clear concept recall`
- `reliable step execution`
- `independent execution`
- `independent starts`
- `control under difficulty`
- `structure retention`
- `controlled pace`

## Top behavior selection

Behavior labels are counted by frequency.

`summarizeBehaviorLabels(labels, limit)`:

- counts occurrences
- sorts descending by count
- takes the first `limit`

Current limits:

- weekly/monthly challenge fields: top `2` weak labels
- weekly response pattern: top `3` absolute behavior labels
- phase-progress behavior clause: top `2` strong late behavior labels

Tie behavior:

- equal counts keep the insertion/order behavior of JavaScript object entries from the counted labels.

## Natural joining

Multiple labels are joined with `naturalJoin`.

Outputs:

- one item: `A`
- two items: `A and B`
- three or more: `A, B, and C`

## Behavior shift engine

`buildBehaviorShiftSummary(earlyBehaviors, lateBehaviors, fallback)` creates comparative behavior movement.

It:

1. Counts early behavior labels.
2. Counts late behavior labels.
3. Finds weak labels that appeared less in late behaviors than early behaviors.
4. Finds strong labels that appeared more in late behaviors than early behaviors, or appeared late but not early.
5. Takes up to `2` reduced weak labels.
6. Takes up to `2` strengthened labels.
7. Joins them naturally.
8. Uses fallback if no shift is found.

Reduced weak output format:

- `less {weak label}`

Strengthened output format:

- `{strong label}`

Possible reduced weak outputs:

- `less clarity breakdown`
- `less inconsistent step execution`
- `less early dependence`
- `less delayed starts`
- `less hesitation under pressure`
- `less structure breakdown`
- `less pace loss`

Possible strengthened outputs:

- `clearer concept recall`
- `more reliable step execution`
- `more independent execution`
- `earlier independent starts`
- `better control under difficulty`
- `stronger structure retention`
- `more controlled pace`

Fallbacks:

- weekly/monthly improvement with stability advance: `showed stronger stability`
- weekly/monthly improvement without stability advance: `improved stability across drills`
- monthly response trend: `showed a more consistent response pattern`

## Topic snapshots

For each report window, `buildTopicSnapshots` groups deterministic sessions by topic.

Each topic snapshot stores:

- first drill state
- last drill state
- drill count
- transition reasons
- latest next action
- per-drill behavior arrays
- all behavior labels

First/last state uses dates:

- earliest date becomes first state
- latest date becomes last state

Topic fallback:

- empty topic becomes `Unknown topic`

## Parent meaning engine

Reports use `buildParentMeaningForContext`.

Inputs:

- first phase
- last phase
- last stability
- transition reasons

Decision order:

1. If latest transition is phase progress and phase changed, use parent entry meaning for the new phase.
2. Else if latest transition is stability regress, use reinforcement message.
3. Else if current state is `Time Pressure Stability (High Maintenance)`, use final maintenance message.
4. Else use parent dashboard copy for current phase/stability.

## Parent entry meanings

`Clarity`:

- `Your child is building the foundation of this topic before independent solving begins.`

`Structured Execution`:

- `Your child has entered independent execution in this topic and is now building consistency without tutor carry.`

`Controlled Discomfort`:

- `Your child has entered the challenge phase in this topic and is learning to stay stable when work becomes difficult.`

`Time Pressure Stability`:

- `Your child has entered timed stability in this topic and is learning to keep structure under urgency.`

## Special parent meanings

Stability regress:

- `This topic needs reinforcement at the current level before moving forward again.`

Final maintenance:

- `Your child is sustaining top-level stability in this topic and we are now maintaining and transferring the skill.`

## Parent dashboard meaning matrix

Used when no phase progress, no stability regress, and no final maintenance override applies.

### Clarity

`Low`

- Status: `Your child is still building a clear understanding of this topic.`
- Meaning: `They are not yet fully comfortable with the terms, steps, or logic involved.`
- Focus: `We are rebuilding the foundation so they can clearly recognize and understand the problem.`

`Medium`

- Status: `Your child is beginning to understand this topic more clearly.`
- Meaning: `They can follow explanations, but still need reinforcement to apply it independently.`
- Focus: `We are increasing practice and helping them apply the method more consistently.`

`High`

- Status: `Your child now understands this topic clearly.`
- Meaning: `They can recognize the problem and explain the steps with confidence.`
- Focus: `We are moving into independent problem-solving to build execution.`

`High Maintenance`

- Status: `Your child has sustained strong clarity in this topic.`
- Meaning: `They have held high performance consistently and are ready for progression decisions.`
- Focus: `We are now transitioning into Structured Execution training.`

### Structured Execution

`Low`

- Status: `Your child is learning to apply the steps correctly.`
- Meaning: `They understand the topic but struggle to follow the method consistently on their own.`
- Focus: `We are reinforcing a clear step-by-step approach so they can start and complete problems reliably.`

`Medium`

- Status: `Your child is becoming more consistent in solving problems.`
- Meaning: `They can follow the method in many cases, but still show occasional inconsistency.`
- Focus: `We are increasing independent practice to strengthen consistency.`

`High`

- Status: `Your child can now solve problems consistently in this topic.`
- Meaning: `They are able to follow the correct steps independently with minimal support.`
- Focus: `We are verifying sustained high execution through repeated, constrained practice before introducing more challenging questions to strengthen their response under difficulty.`

`High Maintenance`

- Status: `Your child has sustained strong execution consistency in this topic.`
- Meaning: `They have held high execution quality across sessions and are ready for progression decisions.`
- Focus: `We are now transitioning into Controlled Discomfort training.`

### Controlled Discomfort

`Low`

- Status: `Your child is starting to face more challenging problems in this topic.`
- Meaning: `They can solve basic problems, but struggle when questions become less familiar.`
- Focus: `We are helping them stay calm and start correctly even when the problem feels difficult.`

`Medium`

- Status: `Your child is improving in handling difficult questions.`
- Meaning: `They can work through unfamiliar problems, but still show hesitation at times.`
- Focus: `We are increasing exposure to harder questions to build confidence under difficulty.`

`High`

- Status: `Your child is handling difficult problems well.`
- Meaning: `They are able to stay structured and solve unfamiliar questions with stability.`
- Focus: `We are preparing them to perform under time pressure.`

`High Maintenance`

- Status: `Your child has sustained strong performance under challenge in this topic.`
- Meaning: `They have held high stability in difficult work and are ready for progression decisions.`
- Focus: `We are now transitioning into Time Pressure Stability training.`

### Time Pressure Stability

`Low`

- Status: `Your child is learning to stay structured under time pressure.`
- Meaning: `They can solve problems, but may lose structure when working against the clock.`
- Focus: `We are helping them maintain their method while working within time limits.`

`Medium`

- Status: `Your child is becoming more stable under time pressure.`
- Meaning: `They are improving their ability to complete problems within time while staying structured.`
- Focus: `We are increasing timed practice to strengthen consistency.`

`High`

- Status: `Your child is performing consistently under time pressure.`
- Meaning: `They can solve problems accurately and maintain structure even under time constraints.`
- Focus: `We are maintaining performance and preparing them to transfer this skill to new topics.`

`High Maintenance`

- Status: `Your child has sustained top stability under time pressure.`
- Meaning: `They consistently maintain structure and accuracy under timed conditions.`
- Focus: `We are maintaining performance and expanding transfer across related topics.`

## Next action engine contribution

Reports use `latestNextAction` for weekly `Next Focus`.

If missing:

- `Continue current drill`

Monthly reports do not use the latest next action directly. They use the phase purpose:

- `{topic}: Continue training {DRILL_PURPOSE_BY_PHASE[lastPhase]}.`

## Weekly structured report output

Generated object version:

- `weekly-v2-auto`

Generated fields:

- `weekStartDate`
- `weekEndDate`
- `sessionsCompletedThisWeek`
- `topicsWorkedOn`
- `whatChanged`
- `breakdownPattern`
- `whatThisMeans`
- `nextMove`
- `internalWeeklyTutorNote`
- `drillCount`
- `sourceSessionIds`

Parent card sections:

- `Weekly Report`
- date range
- sent metadata
- `Sessions Completed`
- `Topics Worked On`
- `What Changed`
- `What This Means`
- `Breakdown Pattern`
- `Next Move`

## Weekly field assembly

`Sessions Completed`:

- `sessionsCompletedThisWeek`
- based on grouped session count, not raw drill row count

`Topics Worked On`:

- all topics in topic snapshots

`Conditioning Progress`:

- one row per topic
- `startState = first phase/stability`
- `endState = last phase/stability`
- `drillCount = number of deterministic sessions/drill entries for topic`

`What Improved`:

The topic is included if:

- end state score is greater than start state score
- or any transition reason is not `remain`

If topic phase progressed:

- `{topic}: progressed from {firstPhase} to {lastPhase} with {top 2 strong late behavior labels}`

If no strong late behavior labels:

- `{topic}: progressed from {firstPhase} to {lastPhase}`

If no phase progress:

- `{topic}: {behavior shift summary}`

If no topics qualify:

- `No stability improvements detected this week`

`Response Pattern`:

- `{topic}: {top 3 absolute behavior labels}`

Fallback:

- `{topic}: no mapped observation signal detected`

`Breakdown Pattern`:

- `{topic}: {top 2 weak labels}`

Fallback:

- `{topic}: no recurring mapped weak signal detected`

Global fallback if no topic breakdown exists:

- `No recurring breakdown patterns detected`

`System Movement`:

- generated per topic
- joined with comma and space

Fallback:

- `reinforced phase`

`What This Means`:

- generated per topic by parent meaning engine

`Next Focus`:

- `{topic}: {latestNextAction}`

Fallback:

- `{topic}: Continue current drill`

## Monthly structured report output

Generated object version:

- `monthly-v2-auto`

Generated fields:

- `monthStartDate`
- `monthEndDate`
- `totalSessionsCompletedThisMonth`
- `topicsConditioned`
- `systemMovement`
- `whatBecameStronger`
- `breakdownPattern`
- `currentPosition`
- `whatThisMeans`
- `whatThisMeans`
- `nextMonthMove`
- `nextMonthMove`
- `drillCount`
- `monthRange`
- `sourceSessionIds`

Parent card sections:

- `Eight-Session Report`
- date range
- sent metadata
- feedback button
- `Total Sessions Completed`
- `Topics Conditioned`
- `What Became Stronger`
- `Breakdown Pattern`
- `System Movement`
- `Current Position`
- `Next Eight-Session Move`
- `What This Means`
- `Your Feedback` if feedback exists

## Monthly field assembly

`Total Sessions Completed`:

- `totalSessionsCompletedThisMonth`
- based on grouped session count, not raw drill row count

`Topics Conditioned`:

- all topics in topic snapshots

`Topic Progression`:

- one row per topic
- `startState = first phase/stability`
- `endState = last phase/stability`
- `drillCount = number of deterministic sessions/drill entries for topic`

`What Became Stronger`:

Same inclusion logic as weekly:

- end state score is greater than start state score
- or any transition reason is not `remain`

If phase progressed:

- `{topic}: progressed from {firstPhase} to {lastPhase} with {top 2 strong late behavior labels}`

If no phase progress:

- `{topic}: {behavior shift summary}`

If no topics qualify:

- `No significant improvements detected this month`

`Response Trend`:

- `{topic}: {behavior shift summary}`

Fallback:

- `{topic}: showed a more consistent response pattern`

`Recurring Challenge`:

- `{topic}: {top 2 weak labels}`

Fallback:

- `{topic}: no recurring mapped weak signal detected`

Global fallback if no topic recurring challenges exist:

- `No recurring challenges detected`

`System Outcome`:

- generated per topic

Fallback:

- `No monthly system outcome recorded`

`Current Conditioning State`:

- `{topic} - {phase} ({stability})`

`What This Means`:

- generated per topic by parent meaning engine

`Next Month Focus`:

- `{topic}: Continue training {phase purpose}.`

## System movement outputs

### Weekly `System Movement`

Phase progress:

- `{topic}: entered {lastPhase}`

Stability advance:

- `{topic}: improved stability inside {lastPhase}`

Stability regress:

- `{topic}: regressed within {lastPhase}`

Final phase maintenance:

- `{topic}: sustained final-phase maintenance`

Remain:

- `{topic}: reinforced {lastPhase}`

### Monthly `System Outcome`

Phase progress:

- `{topic}: advanced into {lastPhase}`

Final phase maintenance:

- `{topic}: remained in final-phase maintenance`

Stability advance:

- `{topic}: improved within {lastPhase}`

Stability regress:

- `{topic}: regressed within {lastPhase}`

Remain:

- `{topic}: held in {lastPhase}`

## Scenario matrix

### Phase progress

Conditions:

- latest transition reason is `phase progress`
- first phase and last phase differ

Weekly:

- `What Improved`: `{topic}: progressed from {firstPhase} to {lastPhase} with {top 2 strong late behavior labels}`
- `System Movement`: `{topic}: entered {lastPhase}`
- `What This Means`: `{topic}: {parent entry meaning for lastPhase}`
- `Next Focus`: `{topic}: {latestNextAction}`

Monthly:

- `What Became Stronger`: `{topic}: progressed from {firstPhase} to {lastPhase} with {top 2 strong late behavior labels}`
- `System Outcome`: `{topic}: advanced into {lastPhase}`
- `What This Means`: `{topic}: {parent entry meaning for lastPhase}`
- `Next Month Focus`: `{topic}: Continue training {phase purpose for lastPhase}.`

### Stability advance

Conditions:

- latest transition reason is `stability advance`
- phase does not need to change

Weekly:

- `What Improved`: `{topic}: {behavior shift summary}`
- `System Movement`: `{topic}: improved stability inside {lastPhase}`
- `What This Means`: `{topic}: {parent dashboard meaning for lastPhase/lastStability}`
- `Next Focus`: `{topic}: {latestNextAction}`

Monthly:

- `What Became Stronger`: `{topic}: {behavior shift summary}`
- `System Outcome`: `{topic}: improved within {lastPhase}`
- `What This Means`: `{topic}: {parent dashboard meaning for lastPhase/lastStability}`
- `Next Month Focus`: `{topic}: Continue training {phase purpose for lastPhase}.`

### Stability regress

Conditions:

- latest transition reason is `stability regress`

Weekly:

- `What Improved`: `{topic}: {behavior shift summary}`
- `System Movement`: `{topic}: regressed within {lastPhase}`
- `What This Means`: `{topic}: This topic needs reinforcement at the current level before moving forward again.`
- `Next Focus`: `{topic}: {latestNextAction}`

Monthly:

- `What Became Stronger`: `{topic}: {behavior shift summary}`
- `System Outcome`: `{topic}: regressed within {lastPhase}`
- `What This Means`: `{topic}: This topic needs reinforcement at the current level before moving forward again.`
- `Next Month Focus`: `{topic}: Continue training {phase purpose for lastPhase}.`

### Remain

Conditions:

- latest transition reason is `remain`
- current state is not final phase maintenance

Weekly:

- `What Improved`: topic excluded unless another transition in the window was not `remain` or score improved
- if no topics qualify: `No stability improvements detected this week`
- `System Movement`: `{topic}: reinforced {lastPhase}`
- `What This Means`: `{topic}: {parent dashboard meaning for lastPhase/lastStability}`
- `Next Focus`: `{topic}: {latestNextAction}`

Monthly:

- `What Became Stronger`: topic excluded unless another transition in the window was not `remain` or score improved
- if no topics qualify: `No significant improvements detected this month`
- `System Outcome`: `{topic}: held in {lastPhase}`
- `What This Means`: `{topic}: {parent dashboard meaning for lastPhase/lastStability}`
- `Next Month Focus`: `{topic}: Continue training {phase purpose for lastPhase}.`

### Final phase maintenance

Conditions:

- last phase is `Time Pressure Stability`
- last stability is `High Maintenance`

Weekly:

- `System Movement`: `{topic}: sustained final-phase maintenance`
- `What This Means`: `{topic}: Your child is sustaining top-level stability in this topic and we are now maintaining and transferring the skill.`
- `Next Focus`: `{topic}: {latestNextAction}`

Monthly:

- `System Outcome`: `{topic}: remained in final-phase maintenance`
- `What This Means`: `{topic}: Your child is sustaining top-level stability in this topic and we are now maintaining and transferring the skill.`
- `Next Month Focus`: `{topic}: Continue training maintaining structure under time.`

### Diagnosis-only window

Conditions:

- report window contains diagnosis rows
- diagnosis transition reason is `remain`

Weekly:

- `Conditioning Progress`: start and end usually match diagnosis phase/stability
- `What Improved`: fallback if no state improved
- `System Movement`: `{topic}: reinforced {phase}`
- `What This Means`: parent dashboard meaning for the diagnosed phase/stability
- `Next Focus`: diagnosis next action from `NEXT_ACTION_ENGINE`

Monthly:

- same topic snapshot logic
- `System Outcome`: `{topic}: held in {phase}`
- `Next Month Focus`: `{topic}: Continue training {phase purpose}.`

### Multi-topic mixed movement

Conditions:

- report window includes more than one topic
- each topic has its own topic snapshot

Weekly output:

- `Topics Worked On`: all topics
- `Conditioning Progress`: one row per topic
- `What Improved`: only topics that improved or had non-remain movement
- `Response Pattern`: one line per topic
- `Challenges`: one line per topic
- `System Movement`: one movement line per topic joined with `, `
- `What This Means`: one meaning line per topic
- `Next Focus`: one focus line per topic

Monthly output:

- `Topics Conditioned`: all topics
- `Topic Progression`: one row per topic
- `What Became Stronger`: only topics that improved or had non-remain movement
- `Response Trend`: one line per topic
- `Recurring Challenge`: one line per topic
- `System Outcome`: one outcome line per topic
- `Current Conditioning State`: one chip per topic
- `What This Means`: one meaning line per topic
- `Next Month Focus`: one focus line per topic

## Example outputs

### Example 1: weekly stability advance

Input:

- topic: `Linear Equations`
- first state: `Structured Execution (Medium)`
- last state: `Structured Execution (High)`
- latest transition: `stability advance`
- late behavior shift: `more reliable step execution`

Output:

- `Topics Worked On`: `Linear Equations`
- `What Improved`: `Linear Equations: more reliable step execution`
- `System Movement`: `Linear Equations: improved stability inside Structured Execution`
- `What This Means`: `Linear Equations: They are able to follow the correct steps independently with minimal support.`
- `Next Focus`: `Linear Equations: {latestNextAction}`

### Example 2: weekly phase progress

Input:

- topic: `Linear Equations`
- first state: `Structured Execution (High Maintenance)`
- last state: `Controlled Discomfort (Low)`
- latest transition: `phase progress`
- strong late labels: `control under difficulty`, `structure retention`

Output:

- `What Improved`: `Linear Equations: progressed from Structured Execution to Controlled Discomfort with control under difficulty and structure retention`
- `System Movement`: `Linear Equations: entered Controlled Discomfort`
- `What This Means`: `Linear Equations: Your child has entered the challenge phase in this topic and is learning to stay stable when work becomes difficult.`
- `Next Focus`: `Linear Equations: {latestNextAction}`

### Example 3: weekly no improvement

Input:

- topic: `Fractions`
- first state: `Clarity (Medium)`
- last state: `Clarity (Medium)`
- all transition reasons: `remain`

Output:

- `What Improved`: `No stability improvements detected this week`
- `System Movement`: `Fractions: reinforced Clarity`
- `What This Means`: `Fractions: They can follow explanations, but still need reinforcement to apply it independently.`
- `Next Focus`: `Fractions: {latestNextAction}`

### Example 4: monthly mixed topics

Input:

- `Linear Equations`: phase progress into `Controlled Discomfort`
- `Fractions`: remain in `Clarity`

Output:

- `Topics Conditioned`: `Linear Equations, Fractions`
- `What Became Stronger`: `Linear Equations: progressed from Structured Execution to Controlled Discomfort with {strong late behavior labels}`
- `Recurring Challenge`: `Linear Equations: {weak labels}; Fractions: {weak labels}`
- `System Outcome`: `Linear Equations: advanced into Controlled Discomfort; Fractions: held in Clarity`
- `Current Conditioning State`: `Linear Equations - Controlled Discomfort ({stability}); Fractions - Clarity ({stability})`
- `What This Means`: `Linear Equations: Your child has entered the challenge phase in this topic and is learning to stay stable when work becomes difficult.; Fractions: {parent dashboard meaning}`
- `Next Month Focus`: `Linear Equations: Continue training staying stable under difficulty.; Fractions: Continue training the four-layer mental model: what the problem is, how to solve it, why it works, and applying that clarity.`

## Legacy and fallback behavior

If a report has no structured date range:

- Parent UI marks it as `Legacy format`.

Weekly legacy warning:

- `This report was created before structured ranges were introduced. Some sections may have limited detail.`

Monthly legacy warning:

- `This report was created before structured ranges were introduced. Some sections may have limited detail.`

If a parent-facing field is empty:

- UI displays `Not provided`

Parent weekly empty state:

- `No two-session updates yet. Your tutor will send one after two completed session groups.`

Parent monthly empty state:

- `No eight-session reports yet. Your tutor will send one after eight completed session groups.`

Tutor weekly empty state:

- `No two-session reports created yet. Two completed session groups are required.`

Tutor monthly empty state:

- `No eight-session reports created yet. Eight completed session groups are required.`

## Storage fields

Weekly insert:

- `report_type`: `weekly`
- `week_number`: ISO week number from `weekStartDate`
- `month_name`: `null`
- `summary`: JSON string of structured weekly data
- `topics_learned`: `topicsWorkedOn.join(", ")`
- `strengths`: `whatChanged.join(" | ")`
- `areas_for_growth`: `breakdownPattern.join(" | ")`
- `solutions_unlocked`: `sessionsCompletedThisWeek`
- `next_steps`: `nextMove.join(" | ")`
- `sent_at`: current timestamp

Monthly insert:

- `report_type`: `monthly`
- `week_number`: `null`
- `month_name`: formatted month name from `monthStartDate`
- `summary`: JSON string of structured monthly data
- `topics_learned`: `topicsConditioned.join(", ")`
- `strengths`: `whatBecameStronger.join(" | ")`
- `areas_for_growth`: `breakdownPattern.join(" | ")`
- `solutions_unlocked`: `totalSessionsCompletedThisMonth`
- `next_steps`: `nextMonthMove.join(" | ")`
- `sent_at`: current timestamp

## Parent feedback

Parent feedback is only available for monthly reports.

If feedback exists:

- monthly card shows `Feedback Given`
- feedback block shows `Your Feedback`
- feedback timestamp shows `Submitted {date}`

Submitting feedback updates:

- `parent_feedback`
- `parent_feedback_at`
