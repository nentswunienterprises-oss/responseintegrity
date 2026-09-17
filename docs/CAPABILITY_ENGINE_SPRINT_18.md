# Capability Engine Sprint 18 - Shadow Concordance Framework

## Objective

Sprint 18 creates the empirical comparison boundary between the current authoritative Battle Test pathway and the shadow Capability Engine.

The question is no longer whether both pathways mention the same doctrine. Sprint 17 established the semantic map. Sprint 18 asks a narrower empirical question:

> For the same Specialist assignment, what does each pathway currently say at Deep-Dive level, where do those signals agree or disagree, and what downstream Sandbox Mock or Trial evidence exists after those signals?

The framework is intentionally descriptive and non-authoritative.

It does not decide which pathway is better, declare equivalence, recommend cutover, alter readiness, or recreate the 495-human-judgment Battle Test burden under another name.

## Authority boundary

Every Sprint 18 comparison returns:

- `authoritative: false`;
- `cutoverDecision: null`;
- `analysisKind: "descriptive_shadow_concordance"`.

The persisted service is read-only.

It does not:

- write Battle Test runs;
- write Capability assessments;
- write practical reviews;
- write Oral Defense results;
- write Sandbox simulation attempts;
- record Sandbox Mock decisions;
- create or update Trial cases;
- record Trial reviews or certification decisions;
- mutate Specialist operational mode;
- mutate certification state;
- mutate student state.

The review endpoint is GET-only and reuses the existing Capability reviewer access rule. TD scope remains pod-limited; COO/HR retain the same cross-pod review scope already used by Capability review surfaces.

## Comparison unit

Sprint 18 deliberately does not compare the 165 legacy Battle Test questions one-for-one against new assessment questions.

That would recreate the wrong unit of work and confuse semantic lineage with empirical signal comparison.

The comparison unit is the 11 canonical Deep Dives:

1. Clarity
2. Structured Execution
3. Controlled Discomfort
4. Time Pressure Stability
5. Topic Conditioning
6. Intro Session Structure
7. Logging System
8. Session Flow Control
9. Drill Library
10. Handover Verification
11. Tools Required

Each Deep Dive receives one current Battle Test signal and one current Capability signal.

## Battle Test signal

Sprint 18 derives the Battle Test side from the same production logic used by the current operating pathway: `buildTutorDeepDiveProgress` over persisted `battle_test_runs`.

The current Deep-Dive signal is:

### `missing`

No Battle Test attempt exists for that Deep Dive.

### `integrity_block`

The latest attempt carries an active critical flag.

### `ready`

All of the following hold:

- historical state is `completed`;
- current health is `locked`;
- current streak is at least 3;
- latest score is at least 96;
- no active critical flag exists.

### `not_ready`

Evidence exists, but the current state does not satisfy the full ready rule.

This preserves the existing distinction between historical completion and current health. A Deep Dive may have completed historically and later return to watchlist/drift.

Each current Battle Test Deep-Dive signal carries the latest traceable `battle_test_runs.id` and timestamps used to derive it.

## Capability Deep-Dive signal

Each Capability Deep Dive has three required evidence cells:

- mastery;
- delayed retrieval;
- transfer.

The current Capability Deep-Dive signal is:

### `missing`

None of the required current-version cells has observed evidence.

### `integrity_block`

Current Capability evidence carries a localized critical signal for that Deep Dive.

### `ready`

All three required current-version cells are satisfied and no current localized critical signal exists.

### `not_ready`

Current evidence exists, but one or more required cells are unsatisfied.

Sprint 18 requires lineage for every observed cell:

- evidence ID;
- assessment key;
- active bank version;
- attempt number;
- evidence kind;
- covered Deep Dive;
- pass state;
- localized critical state;
- completion timestamp.

A satisfied cell without current-version lineage fails closed.

## Current-version rule

Capability evidence is version-scoped before latest-attempt selection.

This rule is now explicit for all three versioned evidence families:

### Automated assessment banks

Filter to the active bank version first, then select the latest attempt.

An old v1 attempt 4 cannot outrank a current v2 attempt 1.

### Practical proofs

Filter to the current proof version first, then select the latest attempt.

An older approved proof cannot satisfy readiness after the proof definition rotates unless current-version evidence exists.

### Oral Integrity Defense

Filter to the current Oral Defense version first, then select the latest attempt.

A historical V1 approval cannot satisfy V2 merely because its attempt number is higher.

Focused version-rotation tests protect these rules.

## Capability overall state

Sprint 18 uses the actual `CAPABILITY_MVP_SHADOW_GATE_V2` contract rather than inventing a second readiness formula.

Current Capability readiness requires:

- all 33 Deep-Dive evidence cells;
- Prepare practical approved;
- Execute practical approved;
- Evidence practical approved;
- Oral Integrity Defense V2 approved.

Additional handling:

- a current practical `integrity_review` produces an integrity block;
- a current Oral Defense `integrity_review` produces an integrity block;
- missing practical/oral observations remain `missing` rather than being inferred as failure;
- otherwise the actual V2 shadow gate determines READY versus NOT_READY.

## Sandbox simulation role

Sandbox simulation remains contextual rehearsal evidence.

Sprint 18 records:

- active simulation bank version;
- latest attempt on that active version;
- evidence ID;
- attempt number;
- pass state;
- critical flag;
- timestamp.

Simulation does not mutate the Capability readiness signal because it is not a requirement in `CAPABILITY_MVP_SHADOW_GATE_V2`.

A future readiness change must change the gate explicitly rather than allowing concordance analytics to silently add a new requirement.

## Critical-signal localization

Sprint 18 does not infer integrity risk from aggregate failure alone.

### Assessments

Current critical assessment signals are localized from `question_results[].criticalFail` and the recorded `deepDiveKey`.

If the assessment says `has_critical_fail = true` but no question-level critical signal can be localized, the snapshot fails closed.

### Practicals

Current practical integrity signals use `critical_fail_criterion_keys` and the current frozen rubric lineage.

The service resolves each critical criterion to its canonical competency and critical-boundary Deep-Dive links.

Unknown criterion lineage fails closed.

### Oral Defense

Current Oral Defense V2 integrity signals are localized by combining:

- the issued probe rubric in `brief_snapshot`;
- observed probe judgments;
- `criticalOnFail`;
- canonical critical-boundary links.

If a critical count exists but no critical probe can be localized, the snapshot fails closed.

This means an integrity disagreement has traceable evidence rather than an unexplained aggregate flag.

## Concordance classifications

For each Deep Dive and for the overall pathway state, Sprint 18 uses:

- `agree_ready`
- `agree_not_ready`
- `agree_integrity_block`
- `battle_test_only_ready`
- `capability_only_ready`
- `missing_comparison_evidence`
- `integrity_disagreement`
- `other_disagreement`

Missing evidence is not included as agreement or disagreement.

This is important because an incomplete shadow pathway must not artificially lower or raise concordance.

## Downstream outcome targets

Sandbox Mock and Trial are observational outcomes, not inputs to concordance state.

### Sandbox Mock

The latest persisted Sandbox Mock decision is recorded when available:

- `passed`; or
- `remediation_required`.

Its assessment ID and timestamp are preserved.

The Mock result does not change either pathway signal.

### Trial

Sprint 18 reads the latest persisted Trial case for the assignment and, if present, the latest persisted certification decision.

It records:

- persisted case status;
- latest certification decision when one exists;
- traceable case/decision evidence ID;
- timestamp.

An active or reviewable Trial case with no certification decision remains exactly that. Sprint 18 does not infer a positive or negative Trial outcome.

The framework intentionally reads persisted Trial state rather than rebuilding the full Trial gate inside concordance analytics.

## Descriptive cohort aggregation

Sprint 18 can aggregate multiple assignment snapshots, but only descriptively.

It reports:

- total sample size;
- comparable sample size;
- missing-comparison sample size;
- overall agreement rate among comparable assignments;
- counts by concordance classification;
- number with observed Sandbox Mock outcome;
- number with observed Trial certification decision;
- Sandbox Mock outcomes cross-tabulated by concordance classification;
- Trial certification decisions cross-tabulated by concordance classification.

Duplicate Specialist identities fail closed in cohort aggregation.

## No arbitrary inferential threshold

An earlier unfinished Sprint 18 branch contained hard-coded sample thresholds such as n=10 and n=30 for descriptive/formal equivalence language.

Those thresholds were removed.

Equivalence, superiority, non-inferiority, predictive validity, sensitivity/specificity, or cutover confidence require a statistical analysis plan that specifies the estimand, comparison margin, outcome prevalence, acceptable error, power, missing-data handling, and cohort design.

Sprint 18 therefore always returns:

- `statisticalAnalysisPlanDefined: false`;
- `equivalenceEstablished: false`;
- `superiorityEstablished: false`;
- `predictiveValidityEstablished: false`;
- `strongCutoverClaimAllowed: false`.

No sample size automatically changes those fields.

## Persisted evidence sources

The read-only snapshot currently uses existing storage only:

- `battle_test_runs`;
- `private.specialist_capability_assessment_configs`;
- `specialist_capability_assessment_attempts`;
- `specialist_capability_practical_evidence`;
- `specialist_capability_practical_reviews`;
- `specialist_capability_oral_defenses`;
- `private.specialist_capability_simulation_banks`;
- `specialist_capability_sandbox_simulation_attempts`;
- existing Sandbox Mock assessment storage through `getLatestSandboxMockAssessment`;
- `tutor_trial_cases`;
- `tutor_certification_decisions`.

No concordance table is introduced.

No migration is required for Sprint 18.

## Fail-closed conditions

The pure comparison validator rejects:

- duplicate Battle Test Deep-Dive identities;
- unknown Deep Dives;
- invalid Battle Test scores, streaks, attempt counts, or timestamps;
- duplicate active Capability assessment configs;
- unknown Capability evidence cells;
- a satisfied cell that is not observed;
- missing current-version lineage for an observed cell;
- lineage whose Deep Dive or evidence kind does not match the canonical cell;
- stale assessment bank lineage;
- a satisfied cell whose current lineage is failed or critical;
- unknown/current critical Deep-Dive identities;
- duplicate or incomplete practical current-state rows;
- stale practical proof/rubric versions;
- stale Oral Defense version;
- stale simulation bank version;
- malformed Mock/Trial outcome metadata.

The persisted snapshot additionally fails closed when:

- an aggregate assessment critical fail cannot be localized to a question/Deep Dive;
- a practical integrity signal cannot be traced to a current rubric criterion;
- an Oral Defense critical fail cannot be localized to an issued critical probe;
- multiple active simulation banks exist;
- Battle Test progress cannot be traced to a persisted run ID;
- persisted Trial status/decision contains an unknown enum value.

## Verification contract

Focused tests cover:

- current Battle Test ready/not-ready/missing/integrity states;
- Capability missing/partial/ready/integrity states;
- all concordance classifications;
- fully ready 11-Deep-Dive agreement;
- Capability overall state requiring the real V2 gate evidence;
- integrity asymmetry despite otherwise complete cells;
- stale assessment-bank rejection;
- stale practical-proof rejection;
- stale Oral Defense rejection;
- stale simulation rejection;
- duplicate Battle Test identity rejection;
- missing current cell lineage rejection;
- Sandbox Mock/Trial remaining observational targets;
- descriptive cohort denominators and downstream outcome cross-tabs;
- no hard-coded equivalence threshold;
- GET-only route;
- reviewer scope reuse;
- SELECT-only evidence path;
- no authority mutation path;
- route registration in both Express and Vercel runtimes.

## What Sprint 18 can establish once executed on real shadow data

Sprint 18 can establish descriptive facts such as:

- how many Specialist assignments have both pathways sufficiently observed to compare;
- which Deep Dives most frequently disagree;
- whether integrity asymmetry exists and on which side;
- how often both pathways say ready/not-ready;
- whether disagreements cluster before Mock remediation;
- what Trial decisions are observed after each concordance class.

These are useful cutover inputs.

They are not themselves proof of equivalence or predictive superiority.

## What Sprint 18 does not establish

Sprint 18 does not establish:

- that Capability Engine is equivalent to Battle Testing;
- that Capability Engine is superior to Battle Testing;
- that Battle Testing should be retired;
- that the 96% threshold is calibrated optimally;
- that Mock or Trial are validated gold-standard endpoints;
- causal predictive validity;
- a statistically powered cutover decision.

Those claims require real cohort data and a pre-specified analysis plan.

## Next proof boundary

Once enough real shadow assignments contain both pathways and downstream outcomes, the next sprint should analyze the actual observed cohort rather than add more replacement features.

The decision sequence should be:

1. collect paired shadow evidence without changing authority;
2. inspect missingness and disagreement patterns;
3. define the statistical/operational cutover criteria from the observed data and business risk;
4. run the pre-specified analysis;
5. only then consider an authority migration design.

Until then, Battle Testing and the human Sandbox Mock remain authoritative.

## Deployment state

- branch: `feat/capability-engine-sprint-18`;
- stacked on Sprint 17, not `main`;
- no merge to `main`;
- no Supabase write;
- no migration;
- no production deployment.

Refs #38 #35 #33 #31 #29 #27 #23 #21.
