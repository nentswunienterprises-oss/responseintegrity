# Capability Engine Sprint 19 - Shadow Cohort Review Surface

## Objective

Sprint 19 makes Sprint 18's per-assignment shadow concordance operational for reviewers.

The purpose is not to decide cutover. It is to make the current evidence population visible:

- which Specialist assignments have evidence from either pathway;
- which are actually comparable;
- which remain incomplete;
- where Battle Test and Capability signals disagree;
- which downstream Sandbox Mock and Trial outcomes exist;
- which evidence families are still missing.

The core integrity rule is denominator preservation.

An incomplete Specialist must not disappear from the cohort merely because the comparison is inconvenient or unfinished.

## Candidate denominator

An assignment enters the shadow cohort when at least one of these exists:

1. a tutor `battle_test_runs` record; or
2. a `specialist_capability_assessment_attempts` record.

The candidate query uses **Battle Test OR Capability**, not Battle Test AND Capability.

This prevents selection bias where only fully paired or successful assignments become visible.

The headline candidate denominator is built before any UI filter is applied.

## Reviewer scope

Sprint 19 reuses the existing Capability reviewer role contract:

- TD
- COO
- HR

TD cohort discovery is scoped through `pods.td_id`.

Each candidate assignment is then passed through Sprint 18's existing `assertCapabilityReviewerAccessToAssignment` check again before its persisted concordance snapshot is built.

This creates both query-level scope and per-assignment fail-closed scope.

## Assignment identity

Concordance is assignment-level, not person-level.

The cohort uses `tutor_assignment_id` as the unique analytical identity because one Specialist may have more than one assignment over time.

Duplicate assignment identities fail closed.

Specialist user ID remains visible metadata but is not used to collapse separate assignments into one analytical row.

## Cohort summary

The fixed cohort summary reports:

- candidate assignments;
- comparable assignments;
- incomplete assignments;
- agreement rate among comparable assignments only;
- classification counts;
- observed Sandbox Mock outcome count;
- observed Trial decision count.

The cohort inherits Sprint 18's descriptive-only guarantees:

- no statistical analysis plan;
- no equivalence claim;
- no superiority claim;
- no predictive-validity claim;
- no strong cutover claim.

## Comparable versus incomplete

An assignment is `comparable` when Sprint 18's overall concordance classification is not `missing_comparison_evidence`.

An assignment is `incomplete` when the current evidence is insufficient for the overall pathway comparison.

Incomplete assignments remain in:

- the candidate denominator;
- classification counts;
- the reviewer list unless explicitly filtered out for viewing.

They are excluded only from the mathematical agreement-rate denominator because no comparison exists yet.

## Per-assignment review row

Each visible cohort member exposes:

### Identity/context

- Specialist name;
- email when available;
- pod;
- operational mode;
- tutor assignment ID;
- tutor user ID.

### Overall concordance

- Battle Test overall state;
- Capability overall state;
- overall concordance classification;
- comparable/incomplete status.

### Deep-Dive comparison

- comparable Deep Dives;
- agreeing Deep Dives;
- disagreement count;
- missing Deep-Dive count;
- integrity-asymmetry count.

### Evidence completeness

- Battle Test Deep Dives observed out of 11;
- Capability cells observed out of 33;
- Capability cells satisfied out of 33;
- practical current-state rows observed out of 3;
- Oral Defense V2 presence;
- Sandbox simulation attempt presence;
- Sandbox Mock outcome presence;
- Trial case presence;
- Trial decision presence.

These are evidence-completeness facts, not readiness recommendations.

## Overlapping Capability evidence-cell lineage

Sprint 19 also hardens Sprint 18's persisted Capability lineage model.

Some approved transfer assessments intentionally overlap the same Deep Dive. For example, more than one current transfer assessment can legitimately cover `logging_system.transfer` or `session_flow_control.transfer`.

The production readiness selector already treats this as valid overlap rather than duplicate corruption. It resolves one canonical evidence-cell state from the current passing assessments.

The persisted concordance snapshot now mirrors that contract instead of throwing when more than one current assessment resolves to one cell.

For each evidence cell:

1. if any current candidate contains a localized critical fail for that Deep Dive, the latest critical candidate is retained for integrity trace and the cell is not satisfied;
2. otherwise, if one or more current candidates pass, the earliest passing candidate is retained, matching the production readiness selector's earliest-satisfaction behavior;
3. otherwise the latest current failed observation is retained so the cell is observed but unsatisfied.

This preserves three separate truths:

- valid transfer overlap is allowed;
- a passing current overlap can satisfy one canonical cell once;
- current critical evidence is never hidden by another passing overlap.

Focused tests now prove both the production selector overlap behavior and the persisted concordance mirror. Retired-bank overlap cannot outrank current-bank evidence.

## Filters

The reviewer UI supports local read-only filtering by:

- all / comparable / incomplete;
- concordance classification;
- free-text Specialist, email, pod, assignment ID, or tutor ID search.

Filtering happens after the full cohort is loaded.

Filters do not change:

- candidate denominator;
- comparable denominator;
- incomplete denominator;
- agreement rate;
- classification totals.

The UI explicitly shows `Showing X of Y candidate assignments` and states that filters do not alter the headline denominator.

## UI authority language

The surface is labelled:

- `Read-only - descriptive only`;
- `Capability Engine - shadow evidence`.

The page explicitly states that it does not:

- recommend cutover;
- rank Specialists;
- change readiness.

A disagreement banner says the signal is evidence to inspect, not a decision recommendation.

No pass-Specialist, certify, or authority-migration action exists on the page.

## Read-only API

The cohort endpoint is:

`GET /api/capability-review/shadow-cohort`

It is authenticated and registered in both:

- Express runtime;
- Vercel runtime.

The service:

1. discovers scoped candidate assignments;
2. builds a Sprint 18 persisted concordance snapshot for every candidate;
3. validates Specialist identity consistency;
4. projects the fixed cohort review summary.

There is no POST, PUT, PATCH, or DELETE cohort endpoint.

## No schema change

Sprint 19 introduces no cohort table and no migration.

The cohort is a derived current-state view over existing persisted evidence.

This avoids creating a second truth store for concordance results.

## Performance boundary

Candidate snapshots are currently built sequentially.

This is deliberate for the shadow phase:

- the expected review population is small;
- each snapshot already reads multiple evidence families;
- sequential evaluation avoids an uncontrolled burst of database connections;
- one malformed assignment fails the cohort closed instead of being silently omitted.

If the cohort grows materially, performance can be improved with batched evidence reads without changing the denominator or authority semantics.

## Standalone UI boundary

The reviewer route is:

`/operational/capability-review/shadow-cohort`

It is routed through `CapabilityStandaloneApp`, alongside practical and Oral Defense review.

`client/src/main.tsx` explicitly boots the Capability standalone app for this route.

Sprint 19 does not add the shadow cohort review to the ordinary main application navigation.

## Focused verification contract

Shared cohort tests prove:

- incomplete assignments stay in the candidate denominator;
- comparable and incomplete denominators are separate;
- evidence-completeness counts are derived from the comparison object;
- filters do not alter the stored cohort summary;
- duplicate assignment identity fails closed;
- authoritative/cutover-bearing comparison objects are rejected.

Capability overlap tests prove:

- two current passing transfer assessments may legitimately resolve to one canonical cell;
- the production selector keeps one deterministic cell state;
- the earliest passing current evidence supplies the satisfied-cell lineage;
- retired-bank evidence cannot outrank current-bank evidence;
- the persisted concordance service does not reintroduce a duplicate-cell failure;
- localized critical evidence takes precedence over passing overlap in the analytical trace.

Server boundary tests prove:

- candidate discovery uses Battle OR Capability;
- TD discovery is pod-scoped;
- per-assignment reviewer scope is rechecked;
- endpoint is authenticated GET-only;
- cohort is built from all discovered snapshots before filtering;
- no evidence/authority mutation calls exist;
- route is registered in both server runtimes.

Client boundary tests prove:

- UI calls only the GET cohort endpoint;
- no mutation hook exists;
- fixed denominators remain visibly separate from filters;
- missing evidence families are visible;
- safe descriptive wording is present;
- no pass/cutover/certification recommendation action is present;
- the route stays inside the Capability standalone app.

## What Sprint 19 provides

Once real shadow evidence exists, Sprint 19 provides an operating answer to:

- how large the actual shadow cohort is;
- how much of it is comparable;
- where data collection is incomplete;
- which evidence family is causing incompleteness;
- which Deep Dives disagree most often;
- where integrity asymmetry appears;
- how much downstream Mock/Trial evidence is available for later analysis.

This makes missingness an operational problem that can be fixed instead of a hidden statistical bias.

## What Sprint 19 does not provide

Sprint 19 does not establish:

- equivalence;
- non-inferiority;
- superiority;
- predictive validity;
- cutover readiness;
- certification eligibility;
- a replacement authority decision.

It is an evidence-operations surface.

## Next proof boundary

The next meaningful move is not another replacement feature.

Once this stack is executable against isolated or approved shadow data, use the cohort surface to determine:

1. whether enough paired evidence exists;
2. which evidence families are systematically missing;
3. which disagreement types recur;
4. whether enough Mock/Trial outcomes exist to justify a formal analysis plan.

Only then should a statistical/operational cutover criterion be specified.

## Deployment state

- branch: `feat/capability-engine-sprint-19`;
- stacked on Sprint 18, not `main`;
- no merge to `main`;
- no Supabase write;
- no migration;
- no production deployment.

Refs #40 #38 #35 #33 #31 #29 #27 #23 #21.
