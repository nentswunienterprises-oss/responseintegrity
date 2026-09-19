# Demand Production Gateway implementation report

Branch: `feat/demand-production-gateway`
Base inspected from fresh `main`: `c1fa69957a8e728e154e64e0be7b4ad6574c27e2`
PR 45 inspected only for targeted proof fixes. The only ported changes were the DOM `setAttribute` mock in `client/src/lib/google-homepage.test.ts` and the immutable-reassignment expectation in `server/productionLinkPersistence.test.ts`.

## What changed

- Added Demand Production capture through signup, OAuth, and Gateway using a shared `captureDemandParent` helper. First durable Production Link attribution is persisted on account, lead, and parent records and cannot be reassigned by a later link.
- Introduced `pending` as the default new-family entry state. Pilot and Commercial now require explicit human qualification, entry selection, and handover evidence.
- Added enrollment evidence fields for qualification status, owner/contact/decision actor/timestamps/note, entry selection actor/time, and handover sender/recipient/completion/note.
- Added a SQL migration and trigger/RPC gate so new-flow families cannot be assigned or handed over without `qualified` + entry selection + handover completion. Legacy version-0 and synthetic sandbox records remain compatible, with unknown history kept unknown.
- Extended the COO Production Economy page with a parent application review panel and Demand metrics for pending review, contact, qualification, handover, Pilot service entry, Commercial paid entry, organic, and historical-unknown families.
- Updated metrics so free Pilot service entry is measured through accepted/unlocked Pilot service evidence, while Commercial entry requires the canonical paid transaction path.
- Kept the existing Capacity family intact, preserved Capacity pipeline identity, and retained the R200 × 8/12/16 economics with R130/R70 shares and Production Rewards disabled.
- Archived superseded production-economy/reward docs with banners and added the canonical Demand Production Gateway documentation.

## Schema and migration boundary

Migration: `migrations/20260916191307_demand_production_gateway.sql`

The migration defaults new `parents` and `leads` rows to `onboarding_type = pending`. Existing records are not rewritten. Historical enrollment rows receive `demand_flow_version = 0`; new rows default to version 1. Version-1 rows are guarded by the trigger and the `update_demand_production` RPC. Browser/client direct writes cannot set or rewrite terminal evidence.

Deployment prerequisite: apply the migration before releasing the application code. If rollback is needed, keep the new evidence columns and forward-fix; dropping evidence or disabling triggers is not a safe rollback path.

## Validation run on this branch

| Check | Result |
| --- | --- |
| Demand Production suite: `RI_TEST_PGLITE_MODULE=/tmp/ri-demand-test/node_modules/@electric-sql/pglite/dist/index.js RI_DEMAND_PROOF_OUTPUT=/tmp/ri-demand-journeys.json npm run test:demand-production` | Passed: 18 tests, 0 failures |
| Focused Production Link + package/trial regressions: `node --import tsx --test server/productionLinks.test.ts server/productionLinkPersistence.test.ts server/productionLinkOwnership.test.ts server/productionLinkRouteUrlConstructors.test.ts server/productionLinkServerBoundary.test.ts server/productionLinkUrls.test.ts shared/servicePackages.test.ts shared/trialCertification.test.ts` | Passed: 30 tests, 0 failures |
| Build-equivalent sequence: legal static generation, sitemap generation, Vite build, prerender, backend esbuild bundle | Passed |
| TypeScript: `NODE_OPTIONS=--max-old-space-size=6144 node node_modules/typescript/bin/tsc --noEmit --incremental false` | Fails with 249 existing repo diagnostics; earlier untouched-main baseline was 252 diagnostics, so this change did not increase the global TypeScript debt |
| `npm run build:full` wrapper | Not used as final proof; it fails in this container through tsx UNIX IPC `EPERM`. The equivalent underlying build steps above passed. |
| Live Production Link integration test | Not run; it is intentionally skipped unless `RI_PRODUCTION_LINK_DB_TEST=1` and live Supabase credentials/test IDs are provided. |

## Journey evidence

`docs/evidence/demand-production/journeys.json` was emitted by the HTTP journey test. It records both the Commercial and Pilot journeys across signup, Gateway submission, later-link rejection, contact, qualification, entry selection, handover, assignment, proposal/payment or free Pilot entry, and service unlock. Both journeys retain the original account/lead/parent Production Link code throughout.

## UI evidence

`docs/evidence/demand-production/ui-dom-proof.html` is a rendered DOM proof of the actual COO Production Economy page and `DemandReview` component. It shows the reviewed family as `qualified`, `pilot`, handover `Completed`, receiving owner `TD Receiver`, responsibility transferred, and SLA `Within standard`.

Browser screenshot verification could not be completed in this container because `agent-browser doctor` reported no Chrome binary and the Chrome-for-Testing CDN was unreachable from the restricted network. The Vite route started successfully on the real app, and the saved DOM proof was produced by a JSDOM render of the actual component code.

## Known limits

- The isolated test database is a narrow PostgreSQL/PGlite fixture, not a production schema clone.
- Supabase Auth identity and session transport are synthetic in the journey tests; the app route authentication and role checks still run.
- Specialist intro/diagnosis prerequisites are seeded as fixtures so the journey can reach the assignment/proposal/payment boundary without re-testing unrelated engines.
- No production database, live Supabase project, or payment provider was contacted.
