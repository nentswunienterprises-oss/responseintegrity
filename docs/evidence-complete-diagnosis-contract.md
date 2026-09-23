# Evidence-Complete Diagnosis Contract

Status: approved architecture for the next-generation Response Integrity diagnosis engine.

## Core law

Diagnosis is evidence-complete, not rep-complete.

A diagnostic opportunity exists only because the system has an unresolved evidence question. The Specialist does not complete a fixed number of repetitions for their own sake. After every clean opportunity, the engine must decide one of three things:

1. placement is sufficiently determined -> stop diagnosis;
2. a specific evidence question remains unresolved -> issue the next named probe;
3. the evidence was contaminated or remains irreconcilable -> do not guess; request a clean system-selected probe or block placement for review.

Training remains separate. Training can deliberately use volume, repeated exposure, modeling, correction and reinforcement. Diagnosis cannot silently become training.

## System responsibility

The Specialist is a guided observer, not the placement engine.

The system decides:

- which probe starts the diagnosis;
- what each opportunity is trying to establish;
- which response dimensions must be observed;
- whether an observation is valid baseline evidence;
- whether the evidence supports, contradicts, or leaves a phase unresolved;
- whether another opportunity is actually necessary;
- which condition should be removed or added next;
- when diagnosis is complete;
- the final entry phase and starting stability.

The Specialist supplies faithful observations only.

## Response stack

The diagnostic engine works on one response stack:

1. Clarity
2. Structured Execution
3. Controlled Discomfort
4. Time Pressure Stability

A single student response may create valid evidence for several layers at once. The phase labels remain the training architecture and final placement language; they are no longer artificial walls that force four separate mini-drills.

### Downward evidence rule

A strong higher-constraint response may support lower layers when the lower-layer dimensions were directly observed during that same response.

A weak higher-constraint response does not automatically condemn lower layers. If a timed or difficult response breaks, the engine strips constraints until it isolates the earliest unsupported layer.

The engine never infers a lower-layer failure merely because a higher layer failed.

## Evidence statuses

Every dimension and phase resolves to one of four states:

- `supported` - clean evidence is sufficient to trust the capability at this layer;
- `unsupported` - direct clean evidence shows instability at this layer;
- `unresolved` - more evidence is required;
- `confounded` - the available observation cannot be used as clean baseline evidence because assistance or another contaminating condition changed the response.

Placement occurs at the earliest unsupported phase after all earlier phases are supported.

If an earlier phase is unresolved or confounded, a higher-phase failure cannot be interpreted yet. The engine strips the higher constraint and resolves the earlier phase first.

## Starting stability

Diagnosis must not use a numeric score to decide stability.

The Specialist records concrete behavior. Each decision-relevant behavior is classified internally as one of:

- `breakdown` - phase-defining capability is substantially absent;
- `conditional` - capability exists but is materially inconsistent, dependent, or unstable;
- `near_stable` - capability is substantially present and usable, but minor instability prevents the layer from being considered fully clean;
- `supported` - the behavior meets the support contract;
- `not_observed` - no valid opportunity existed to observe it;
- `confounded` - the observation cannot be interpreted cleanly.

Starting stability is then derived categorically from the unsupported behavior that defines the entry phase:

- any clean `breakdown` evidence -> Low;
- otherwise any clean `conditional` evidence -> Medium;
- otherwise `near_stable` evidence -> High.

No percentage threshold participates in that decision.

Diagnosis never mints `High Maintenance`. High Maintenance remains the fourth stability state, but it is training-earned. A training drill must first establish the High Maintenance state; once earned, a later qualifying exposure confirms that the capability holds before phase progression.

The universal stability meanings are:

- Low - the phase-defining capability is substantially absent or breaks at meaningful exposure;
- Medium - the capability exists but is materially conditional, inconsistent, dependent, or unstable;
- High - the capability is substantially present and usable; only minor instability and/or insufficient confirmation prevents the phase from being considered sustained;
- High Maintenance - the capability has met the strong-performance threshold in training and is being confirmed in a later qualifying exposure before progression.

A phase can therefore be the correct diagnosis entry phase at High when its phase-defining capability is substantially present, but a decision-relevant behavior remains near-stable rather than fully supported. High is not a claim that the phase has already demonstrated sustained stability.

## Completion explanation contract

A completed diagnosis must be auditable without requiring knowledge of internal behavior classes or source code.

Every completion surface must explain four things:

1. **Why this phase** - identify the entry phase as the first unsupported response layer. For any higher-phase entry, do not merely state that earlier layers cleared: show the clean behavioral evidence that proves each earlier layer met its support contract, dimension by dimension.
2. **Why this stability** - connect the decisive clean behavior to the universal categorical meaning: `breakdown -> Low`, `conditional -> Medium`, `near_stable -> High`.
3. **What behavior decided it** - preserve the exact dimension and observed behavior label that created the entry state.
4. **What happens next** - show the state-engine training move without implying that diagnosis itself earned High Maintenance or phase progression.

A phase-clearance claim is valid only when the completion surface exposes, for every supported dimension, the exact clean behavior labels that counted toward support and the observed count versus the dimension's required supported-observation count. A phase name or `status = supported` flag is not, by itself, an acceptable explanation.

There is one deliberate High exception to the near-stable rule: when all four response layers are fully supported, including the required repeated timed evidence, diagnosis ends at **Time Pressure Stability / High** because diagnosis is not allowed to mint High Maintenance. That result must be explained as an authority boundary, not falsely described as near-stable behavior.

Higher-phase entries therefore require an explicit proof chain:

- Structured Execution entry -> Clarity was cleanly supported;
- Controlled Discomfort entry -> Clarity and Structured Execution were cleanly supported;
- Time Pressure Stability entry -> Clarity, Structured Execution and Controlled Discomfort were cleanly supported.

## Repetition law

Repetition is a diagnostic instrument, not a diagnostic requirement.

A second opportunity is justified only when the unresolved evidence itself is temporal or comparative, for example:

- execution repeatability;
- difficulty tolerance or recovery;
- timed structure consistency;
- timed completion consistency;
- conflicting first observations.

A decisive clean breakdown can place the student after one opportunity when the lower layers are already supported.

A single strong opportunity cannot prove a capability whose definition requires repeatability or stability. The engine requests the smallest additional probe needed to prove that question.

## Individualized timing-readiness law

Diagnosis must never use an arbitrary generic timer to decide Time Pressure Stability.

When the evidence path can legitimately finish above Structured Execution and no valid current timing authority already exists, Diagnosis must also resolve the timing-readiness question before finalizing that above-SE placement.

This does not create a fixed three-rep diagnosis block. The three-sample requirement belongs to the timing measurement contract:

- normal difficulty;
- same-form independent execution;
- no active timer or urgency cue;
- no method/step supply or rescue;
- clean supported execution evidence;
- system-owned `Begin Opportunity -> Student Finished` measurement.

Eligible timing may be gathered passively from the neutral `stack.normal_independent` and `execution.repeatability` opportunities that Diagnosis already needs. If an earlier unsupported layer becomes decisive, Diagnosis stops there and does not continue collecting timing merely for future use.

If Diagnosis is about to place in Controlled Discomfort or test/finish Time Pressure Stability and fewer than three clean comparable intervals exist, the engine requests only the remaining evidence-native independent opportunity required to complete timing authority.

Once three clean comparable intervals exist, RI uses their median as the individualized diagnosis baseline. Only then may a system-owned timed diagnosis probe run. The Specialist cannot choose, edit, pause, round, or replace that prescribed time.

## Probe catalog

### `clarity.recognition`

Primary question: Can the student identify the problem, method, and reason before training begins?

Constraints: recognition only, no pressure, no teaching.

Opportunity 1: cold recognition.

Opportunity 2: only if clarity evidence remains incomplete or conflicting.

### `stack.normal_independent`

Primary question: Can the student execute a known method independently when difficulty and time pressure are removed?

Captures: Clarity + Structured Execution.

Opportunity 1: independent baseline.

Opportunity 2: only if an immediate execution field remains unresolved; normal repeatability is otherwise handled by the dedicated repeatability probe.

### `execution.repeatability`

Primary question: Does independent execution hold on another comparable problem without method prompting?

Opportunity 1: repeatability confirmation against the first execution opportunity.

Later opportunities are requested only when unresolved repeatability/conflict evidence remains or when an otherwise above-SE diagnosis still needs clean same-form independent timing samples to complete individualized timing authority. They are Diagnosis opportunities, not backfilled Structured Execution Training.

### `stack.challenge_no_timer`

Primary question: Does difficulty destabilize the response when the timer is removed?

Captures: Clarity + Structured Execution + Controlled Discomfort.

Opportunity 1: constraint-stripping difficulty exposure.

Opportunity 2: only if unresolved composite difficulty evidence remains.

### `difficulty.recovery`

Primary question: Does engagement/tolerance hold or recover on another difficult opportunity without rescue?

Opportunity 1: recovery/tolerance confirmation.

Opportunity 2: conflict resolution only.

### `stack.timed_challenge`

Primary question: Where does the response stack first become unstable when difficulty and time are both present?

Captures: all four response layers.

Opportunity 1: individualized composite timed exposure after valid timing authority exists. A TPS starting signal does not bypass the neutral baseline and does not authorize an arbitrary timer.

Opportunity 2: only if the engine still needs unresolved composite timed evidence.

### `time.consistency`

Primary question: Does structure and completion hold on another independent timed opportunity?

Opportunity 1: timed consistency confirmation.

Opportunity 2: conflict resolution only.

## Constraint stripping

When a high-constraint response fails, the engine deconfounds rather than guesses.

Typical path:

`timed + difficult + independent`

-> remove timer

`difficult + independent`

-> remove difficulty

`normal + independent`

-> remove execution demand if needed

`recognition / explanation`

This is not chronological regression through training phases. It is diagnostic isolation of the earliest unstable response layer.

## Zero tutoring contamination

During diagnosis, teaching is prohibited as baseline evidence.

The engine distinguishes support events:

- `none` - clean baseline evidence;
- `neutral_clarification` - clean only when it clarifies the task without supplying mathematical content or a response strategy;
- `first_step_confirmation` - post-support evidence; does not count toward baseline placement;
- `teaching` - contaminated evidence; does not count toward baseline placement.

If the Specialist teaches, supplies a method, cues a step, rescues the attempt, or otherwise changes the capability being measured, that opportunity cannot silently remain baseline evidence.

Contaminated observations may be preserved for audit/history, but the placement engine ignores them when deciding the entry state.

## Scalable opportunity contract

Every diagnostic opportunity must carry:

- probe ID;
- opportunity number;
- evidence question;
- exact Specialist instruction;
- active constraints;
- allowed evidence dimensions;
- support/contamination status;
- observations;
- system decision after submission.

No anonymous `Rep 1`, `Rep 2`, `Rep 3` exists in the next-generation contract. Each opportunity has a named purpose.

## Multi-topic sessions

The engine is topic-scoped and stateless with respect to how many topics are handled in a session.

For each topic:

`topic + recommended starting phase + probe history + evidence -> next probe or final placement`

That means a session can diagnose one topic or several without changing the diagnostic law. The session shell manages time and topic switching; the diagnosis engine manages evidence for each topic independently.

## Persistence contract

The durable diagnosis payload should preserve:

- recommended starting phase;
- ordered probe history;
- each probe's constraint profile;
- each opportunity's named purpose;
- raw normalized observation levels by stable dimension ID;
- contamination/support event;
- derived phase states after each opportunity;
- final entry phase;
- final starting stability;
- decision confidence;
- engine version.

The server must validate the same deterministic engine rules. A client may guide the Specialist, but it must not be able to mint a placement the server cannot reproduce from the submitted evidence.

## Integration rule

Evidence-complete diagnosis is the only supported intro-diagnosis runtime.

The previous adaptive/fixed phase-block diagnosis is retired from intro launch paths. No query parameter, client route, or Specialist control may opt an intro diagnosis back into that previous-generation flow.

Historical code or stored payload compatibility may remain only where deleting it would damage already-captured records or a separate workflow. In particular, targeted handover re-diagnosis is a distinct handover verification path; it is not an intro-diagnosis fallback and must not be exposed as one.

Migration must preserve existing evidence identities and reporting lineage while the live intro decision unit remains a sequence of named evidence opportunities.

Do not fake unused repetitions, duplicate one observation into missing reps, or mark skipped opportunities as `partial`. If the engine stops after one opportunity, the durable record must honestly contain one opportunity.

## Acceptance criteria

The evidence-complete engine is ready for live use only when all of the following are true:

- a decisive early breakdown can finish diagnosis without fake extra reps;
- a strong single response can support several lower layers when those dimensions were directly observed;
- high-constraint failure triggers deconfounding rather than automatic lower-phase failure;
- repeatability/recovery/stability cannot be proven from one opportunity;
- Low, Medium and High starting stability are all reachable from diagnosis evidence;
- High Maintenance cannot be minted by diagnosis;
- teaching-contaminated evidence cannot determine placement;
- the Specialist cannot choose the next probe by intuition;
- client and server reproduce the same decision from the same evidence;
- multi-topic diagnosis uses the same engine independently per topic;
- the response snapshot/evidence ledger can explain why every probe was run and why diagnosis stopped.


## Observation-language contract

The Specialist does not select `Weak`, `Partial`, `Clear`, Low, Medium, High, or a score.

For every exposed evidence dimension, the UI must present concrete behavioral descriptions. The Specialist answers only: **what actually happened?**

Every dimension must include explicit escape states:

- `not_observed` when the situation did not create a valid observation opportunity;
- `confounded` when intervention, content exposure, task design, or another condition prevents clean interpretation.

Missing evidence must never be converted into weakness.

The canonical behavior-option matrix lives in `shared/diagnosisObservationMatrix.ts`.

The matrix is decision-exhaustive rather than linguistically exhaustive: it must distinguish every behavior that would change diagnosis or the next probe, without attempting to enumerate every possible human action.

## Decision authority

The evidence-native diagnosis path has one authority chain:

`concrete observed behavior -> evidence state -> earliest unsupported layer -> behavior-derived stability -> next action`

Numeric score fields may remain zeroed or analytics-only for schema compatibility, but they cannot decide placement, stability, probe selection, or completion.

The evidence ledger must preserve the exact behavior option ID and label that produced each evidence state.

## No-signal start

A parent or prior-system signal routes the diagnostic search only.

A Time Pressure Stability starting signal does not start with a timed challenge when individualized timing authority is absent. Diagnosis begins with the neutral `stack.normal_independent` route, establishes lower-layer truth and the no-pressure timing reference as needed, verifies Controlled Discomfort, and only then applies the individualized timed condition.

When no trustworthy starting signal exists, diagnosis also begins with the neutral `stack.normal_independent` probe rather than assuming Clarity. That baseline can observe Clarity and Structured Execution without adding difficulty or time. The resulting behavior then determines whether the system stops, strips downward, or escalates.

## Content-exposure protection

A response must not be called a Clarity breakdown merely because the student has never learned the mathematical content.

The observation matrix therefore allows the Specialist to record that a behavior was not meaningfully observable or was confounded by uncertain content exposure. Such evidence remains unresolved/confounded rather than being converted into Low.

A dedicated content-readiness workflow may later make this precondition explicit before diagnosis begins; until then the engine must block rather than invent a response-conditioning placement from unavailable content.
