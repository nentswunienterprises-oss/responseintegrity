# Response Integrity Proof Database

## Purpose

The Response Integrity Proof database is the permanent pre-production database for Response Integrity.

It is not a Capability Engine sandbox and it is not disposable. Capability Engine is simply the first initiative being validated through it.

The Proof database exists to answer one question before any database change reaches production:

> Does this change behave correctly against a production-equivalent Response Integrity database without risking the live system?

## Environment contract

### Production

Production is the live release target and the source of truth for the current deployed database state.

Production database changes must not be used as the first place to discover whether a migration, function, trigger, policy, or application path works.

### Proof

Proof is the mandatory first database target for development database changes.

Proof should mirror production's application database behavior, including:

- schemas used by Response Integrity
- tables and columns
- data types and defaults
- enums and sequences
- primary, unique, check, and foreign-key constraints
- indexes
- functions and function privileges
- triggers
- row-level-security state and policies
- views and relation grants
- required Storage bucket definitions

Proof may contain changes that are being validated and have not yet been promoted to production.

## Data policy

Schema parity does **not** mean copying production personal data.

By default, Proof uses synthetic or deliberately sanitized fixtures. Real student, parent, specialist, credential, onboarding-file, payment, or other sensitive production rows must not be copied merely to make Proof realistic.

When a production behavior depends on a particular data shape, reproduce the shape with synthetic evidence unless an explicitly approved sanitization process exists.

Storage bucket definitions may mirror production. Production files are not copied by default.

## Baseline established

On 2026-09-12 the Proof project was baselined from the live Response Integrity database before Capability Engine migrations were added.

The baseline includes:

- 80 public application tables
- 2 private emergency tables
- 46 public enums
- 5 public sequences
- 14 public functions
- 8 public-table triggers
- 30 public RLS policies
- 262 public indexes
- 1 public view
- 3 public Storage bucket definitions

Public column structure, enum definitions, RLS state, triggers, policies, relation grants, function source/metadata, sequence configuration, and view metadata were verified against production. Primary keys, unique constraints, foreign keys, ordinary indexes, and constraint-backed indexes were also verified directly. PostgreSQL deparses a small number of equivalent CHECK and partial-index cast expressions differently after recreation; those differences are representational rather than behavioral.

No production application data was copied into Proof as part of the baseline.

## Deliberate environment differences

A Proof environment can be safer than production when the difference does not invalidate the behavior under test, but the difference must be explicit.

At baseline time, Supabase's security advisor reported leaked-password protection disabled in Production, while Proof did not report that warning. This is a managed Auth configuration difference, not an application-schema difference. Do not weaken Proof silently to make this warning appear.

Environment secrets, OAuth credentials, webhook endpoints, email/SMS providers, payment credentials, and other external integrations must use proof/test credentials or be disabled unless a test explicitly requires them.

## Mandatory database promotion cycle

Every planned Response Integrity database change follows this order:

1. **Create the change in the repository.** Database behavior must be represented by a reviewable migration or other versioned infrastructure change.
2. **Apply it to Proof first.** Production is never the exploratory target.
3. **Run proof validation.** Validate migration success, application behavior, constraints, RLS, functions/triggers, failure paths, and relevant end-to-end flows using synthetic fixtures.
4. **Run database advisors and integrity checks.** New warnings must be explained. Existing inherited production warnings are not silently "fixed" only in Proof.
5. **Capture proof evidence.** Record the branch/commit, migrations, scenarios run, failures discovered, fixes made, and the final promotion decision.
6. **Promote the exact reviewed change to Production.** Do not hand-rewrite a different production version of a change that passed Proof.
7. **Verify Production after promotion.** Confirm the production migration landed and the expected invariants still hold.
8. **Re-establish parity.** After promotion, Production and Proof should converge again except for deliberately documented test data/config differences.

## Production hotfix rule

If an emergency change must be made directly in Production, that creates database drift and therefore an integrity debt.

The same change must immediately be:

1. represented in the repository,
2. mirrored into Proof,
3. validated there,
4. included in the next parity check.

A production-only hotfix is not considered closed while Proof and the repository remain unaware of it.

## Proof database states

Proof intentionally moves between two states:

### Baseline parity

Proof matches the current deployed Production application schema and behavior.

### Candidate-ahead

Proof equals the Production baseline **plus** one or more explicitly identified candidate migrations under validation.

Candidate-ahead is healthy. Unexplained drift is not.

## Capability Engine

Capability Engine development must now sit on top of this permanent baseline.

Its migrations, private assessment banks, synthetic specialists, concordance fixtures, and shadow-cohort validation belong in Proof first. Passing Capability Engine validation does not bypass this contract; it demonstrates the contract working as intended.

## Promotion principle

**Nothing earns the right to change Production merely because it compiles or because a migration runs. It earns promotion by surviving the Response Integrity Proof Cycle against a production-equivalent environment with traceable evidence.**
