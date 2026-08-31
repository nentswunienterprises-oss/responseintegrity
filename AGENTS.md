# PodDigitizer Agent Instructions

## Mission and decision standard

PodDigitizer operationalizes the 4-Seater Pod system and Response Integrity work. Changes must improve a real user or operational outcome, preserve traceability, and remain consistent with the intended service model.

Before changing code, establish:

- **Vision:** what user or business outcome is intended?
- **Current state:** what does the live code actually do?
- **Target state:** what should happen instead, including failure and empty states?
- **Misalignment:** what specific behavior, contract, or document is wrong?
- **Proof:** what is the cheapest check that could disconfirm the diagnosis?

Question unclear requirements and contradictory documentation. Do not silently choose a convenient interpretation. If the task is actionable, execute it; do not stop at a plan or leave a partially implemented path.

## Source of truth and architecture

- The live runtime is authoritative when it conflicts with documentation. Update the relevant canonical documentation in the same workstream when behavior or product rules change.
- For Response Integrity-OS behavior, read [`docs/response-integrity-os-implementation-source-of-truth.md`](docs/response-integrity-os-implementation-source-of-truth.md) first. It governs product logic, deterministic state movement, reporting, and integrity rules.
- Treat [`brain/vision/TT_CONSTITUTION.md`](brain/vision/TT_CONSTITUTION.md) as non-negotiable product direction. Do not weaken evidence, accountability, one-to-one precision, or response-first training to make a feature easier or more marketable.
- Use [`brain/context/active_context.md`](brain/context/active_context.md), [`brain/memory/conventions.md`](brain/memory/conventions.md), and [`brain/memory/constraints.md`](brain/memory/constraints.md) for project context, conventions, and constraints. These are templates in places; do not invent facts to fill their unanswered prompts.
- Link to existing documentation instead of copying it into new instructions or code comments. Important project areas are mapped in [`brain/index/repo_map.md`](brain/index/repo_map.md).

The main boundaries are:

- `client/`: React and Vite frontend; pages, components, hooks, and client-side data access.
- `server/`: Express and TypeScript backend, routes, auth, storage, integrations, and server-side workflows.
- `shared/`: shared schemas, engines, types, and behavior used across client and server.
- `migrations/` and root SQL files: database changes and operational data work; treat as production-sensitive.
- `scripts/`: generation, prerendering, migration, and verification utilities.

This repository contains parallel `.ts`/`.js` implementations in important runtime areas. When changing a shared module, inspect module resolution and update the paired implementation when both are active; do not assume one is dead code. Preserve existing public contracts unless the task explicitly requires a breaking change.

## Working method

1. Start from the most concrete anchor available: a failing test, reported behavior, route, symbol, or nearby implementation.
2. Read only enough local context to identify the controlling code path and a falsifiable hypothesis.
3. Search for call sites and neighboring tests before changing a shared contract.
4. Make the smallest coherent edit. Keep product logic deterministic and evidence-based; avoid adding manual overrides that bypass scored evidence or established state transitions.
5. Validate immediately with the narrowest relevant check. Then run broader checks when the change crosses boundaries.
6. Report what changed, what was verified, what remains uncertain, and any manual or deployment step. Never imply success when a check was not run or a dependency/environment prevented it.

Keep progress visible on multi-step work: state the current finding, next action, and blocker when one exists. Prefer a clear stop with an explicit blocker over a polished but incomplete implementation.

## Commands

Run from the repository root:

- `npm run dev` starts the client and server together.
- `npm run check` runs TypeScript checking.
- `npm run test:unit` runs the Node test suite through `tsx --test`.
- `npm run build` generates static artifacts, builds the frontend, and prerenders public pages.
- `npm run build:full` also bundles the backend.
- `npm run db:push` changes the database schema; use only when the task explicitly requires it and confirm environment/database safety first.

For focused verification, run the narrowest relevant test or typecheck before a full build. Do not treat a successful build as proof of a behavioral or data-integrity change.

## Data, security, and operational safety

- Never commit secrets, tokens, credentials, or real user data. Use environment variables and `.env.example` patterns.
- Treat auth, RLS, payments, onboarding, reports, and database migrations as high-risk surfaces. Inspect authorization and tenant/role boundaries before editing them.
- Prefer additive, reversible migrations with an explicit rollback or recovery path. Do not run destructive SQL or production-affecting scripts without clear scope and confirmation.
- Do not use ad hoc data backfills to hide an application bug. Fix the controlling behavior, then use a separately justified migration or backfill if needed.
- Preserve auditability: errors should remain diagnosable, state transitions should be explainable, and user-visible claims should be supported by captured evidence.

## UI and product language

Keep the existing mobile-first operational design language. Favor clear, calm, precise surfaces over dashboard theatre, gamification, or decorative complexity. For Response Integrity reports and training flows, use approved wording and structure from the canonical source-of-truth and relevant `docs/` specifications. Do not introduce generic tutoring language, unsupported mastery claims, or copy that explains the system instead of communicating the user's actual position.

## Completion standard

A task is complete only when the requested behavior is implemented across every active layer, focused validation has passed or its failure is explicitly explained, documentation is updated when the contract changed, and the final report names residual risk or follow-up work. Do not claim that code is done merely because a file was edited.
