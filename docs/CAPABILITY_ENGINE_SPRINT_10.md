# Capability Engine Sprint 10 - Deterministic Sandbox Simulation Engine

Status: branch-only design and implementation freeze

Branch: `feat/capability-engine-sprint-10`

Base: `feat/capability-engine-sprint-9`

Issue: #21

## Purpose

Sprint 10 adds a deterministic, non-AI rehearsal engine inside the existing Specialist Sandbox stage.

The engine exists to let a Specialist practise RI operating decisions against fictional session conditions before the existing human Sandbox Mock Readiness Gate is assessed.

It does not create another pathway stage and it does not replace the human Sandbox Mock Gate.

## Authority boundary

The existing Sandbox Mock Readiness Gate remains the only Sandbox exit decision implemented by this sprint stack.

The simulation engine cannot:

- pass the Sandbox Mock Readiness Gate
- move a Specialist into Trial
- certify a Specialist
- change `tutor_assignments.operational_mode`
- alter student topic state
- alter Battle Test progression
- manufacture Sandbox readiness

Every simulation result is shadow rehearsal evidence only.

The persistence contract enforces `authoritative = false`, including a database check constraint in the branch migration.

## Existing human Sandbox Mock Gate preserved

The simulator is intentionally separate from the existing five human Mock criteria:

1. system direction followed
2. phase constraints preserved
3. evidence captured
4. student response managed
5. system result respected

The COO evidence note and human pass/remediation decision remain unchanged.

## Deterministic evaluation

Simulation decisions use constrained single-choice or multi-select actions.

No free-form AI scoring is used.

For each decision the evaluator determines:

- whether the selected action is operationally correct
- whether a critical integrity failure occurred
- whether the action creates evidence contamination
- whether the action violates system authority
- whether the action represents an escalation failure

Aggregate percentage and integrity failure are separate dimensions.

A simulation can meet its numeric threshold and still fail if any selected action crosses a defined critical integrity boundary.

## Critical-boundary lineage

Critical failures are not generic red flags.

Private scenario definitions may name the exact RI critical-boundary identities they exercise.

When a critical action is selected, the immutable result preserves the triggered boundary identity internally.

Examples in the public design fixture include:

- `clarity.identification_no_solving`
- `structured_execution.no_support_independent_execution`
- `controlled_discomfort.no_full_rescue`
- `logging.record_actual_behavior`
- `session_flow.no_manual_drill_override`

That lineage is excluded from Specialist-safe form and result projections.

## Canonical RI doctrine guard

Every loaded live private scenario is validated against the Sprint 8 capability blueprint.

A scenario fails closed if it references:

- an unknown RI Deep Dive
- an unknown competency for the stated Deep Dive
- an unknown critical-boundary identity
- a critical-fail action without RI critical-boundary lineage

This prevents the simulator from becoming a parallel or drifting RI doctrine.

## Public design fixture

Sprint 10 includes one public design fixture only to prove the engine contract.

It crosses five Deep Dives:

- Clarity
- Structured Execution
- Controlled Discomfort
- Logging System
- Session Flow Control

The fixture contains evaluator keys and therefore must never be used as a live production bank.

Live scenario content belongs in the private simulation-bank tables.

## Private live banks

The branch migration defines private versioned simulation-bank storage:

- `private.specialist_capability_simulation_banks`
- `private.specialist_capability_simulation_scenarios`

Direct `PUBLIC`, `anon`, and `authenticated` access is revoked.

Only one bank version may be active for a bank key at a time.

A bank version is immutable once imported.

## Deterministic scenario rotation

Scenario selection is server-side.

The rotation namespace is derived from:

- Specialist assignment identity
- bank key
- bank version
- server-only `CAPABILITY_SIMULATION_SECRET`

Attempt number advances through the scenario pool deterministically before repeating.

The generated form identity includes the assignment, bank version, attempt, scenario identity, and secret-derived namespace.

A submitted form is re-derived server-side before evaluation. A stale or hand-crafted client form is rejected.

## Attempt budgets

Attempt count and retry cooldown are scoped to the active bank version.

A new immutable bank version therefore starts a new attempt budget while prior attempts remain preserved historically.

## Immutable attempt evidence

Submitted attempts preserve:

- Specialist assignment and user
- bank key and version
- attempt number
- simulation form identity
- scenario key and version
- aggregate score
- pass/fail
- critical-fail decision identities
- triggered RI critical-boundary identities
- evidence contamination count
- authority violation count
- escalation failure count
- covered Deep Dives
- exact submitted action keys
- exact internal decision results
- `authoritative = false`

No silent overwrite path is introduced.

## Access boundary

Simulation access requires:

1. authenticated Specialist role
2. ownership of the supplied Specialist assignment
3. current assignment `operational_mode = sandbox`

The server enforces this boundary for form preparation, submission, and history.

The UI repeats the same restriction for clarity but is not the security boundary.

## Specialist-safe projection

The Specialist receives fictional prompts and visible action choices only.

The public form omits:

- competency identities
- Deep Dive identities
- correct option keys
- critical-fail option keys
- critical-boundary identities
- risk mappings
- explanations

The public result exposes aggregate outcome and risk counts but omits exact answer keys, decision results, and triggered boundary identities.

## Specialist workspace

Sprint 10 adds:

`/operational/specialist/capability-sandbox-simulation`

The workspace:

- loads only in Sandbox mode
- presents the current fictional deterministic rehearsal
- submits only form identity and selected action keys
- displays aggregate result and integrity-risk counts
- displays immutable rehearsal history
- states explicitly that no AI judgment is used
- states explicitly that passing does not pass the human Sandbox Mock Gate or open Trial

## Offline-first private-bank import

`scripts/import-private-sandbox-simulation-bank.ts` validates a private bank before any database connection is opened.

Validation includes:

- bank metadata
- at least two scenarios for rotation
- deterministic simulation-definition validity
- canonical RI capability-blueprint alignment
- unique scenario identities

No database module is imported unless `--apply` is explicitly supplied.

`--apply` is intended only for an explicitly approved non-production database until the stack has been fully verified.

The public design fixture is not imported by this script.

## Verification contract

Focused branch tests cover:

- deterministic evaluation
- operational miss vs evidence contamination separation
- authority-violation separation
- critical failures overriding aggregate score
- named RI critical-boundary lineage
- fictional-scenario enforcement
- deterministic scenario rotation
- bank-version rotation
- server-secret requirement
- Specialist-safe projection secrecy
- Sandbox-only access
- immutable `authoritative = false` persistence contract
- no Sandbox Mock or Trial mutation in the simulation service
- route registration in Express and Vercel runtimes
- Specialist UI Sandbox restriction and explicit non-authoritative disclaimer
- offline-first private-bank import boundary

GitHub Actions has repeatedly shown runner-allocation failures on the stacked Capability Engine branches. A red workflow with zero executed steps is infrastructure evidence, not a test verdict. Sprint 10 must not be represented as CI-passed unless a run actually executes the test and type-check steps successfully.

## Deliberately not done in Sprint 10

Sprint 10 does not:

- create or activate a real private simulation bank
- apply the branch migration
- write to Supabase
- merge into `main`
- deploy to production
- alter the human Sandbox Mock Gate
- alter Trial eligibility
- make simulation evidence part of certification readiness
- introduce AI grading

## Freeze decision

Sprint 10 is structurally complete when the branch contains the deterministic evaluator, canonical blueprint guard, private-bank boundary, deterministic rotation, immutable shadow attempt ledger, Specialist-safe projection, Sandbox-only API, Specialist rehearsal workspace, focused boundary tests, offline-first private importer, and this decision record.

Any later decision to make simulation performance a formal prerequisite for the human Sandbox Mock Gate must be treated as a separate operating-policy and engineering change. It is not implied by this sprint.
