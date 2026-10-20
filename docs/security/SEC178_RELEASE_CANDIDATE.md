# P0 #178 containment release candidate

Status: source candidate; Production has not been contained by this work.

## Source and authority

Built from main 65f72294ca7139c9dd2301e9b846d701b37e37d6, then reconciled through main ee4d01a9 (including the approved Exception Doctrine release and its three managed migrations) on the existing security/p0-anon-containment-20261013 branch. The branch was zero ahead and three behind at fresh readback, then fast-forwarded. The requested 18:29 handoff archive was not attached and two Library filename searches found no result. This is a newly implemented and locally tested candidate, not a claim to have verified that archive.

Founder emergency containment authorization: 11 October 2026, recorded in issue #178. Temporary interruption is authorized. Production DDL remains reserved to .github/workflows/production-db-promotion.yml, protected production-db environment, PLAN followed by APPLY with THE_HUB. No direct Production DDL was executed.

## Live read-only findings (14 October)

- The Hub: 62 public tables have no RLS and no policies. All 62 grant authenticated CRUD; 54 grant anonymous access. Manifest: checks/p0-exposure-manifest.json.
- Existing service_role has SELECT/INSERT/UPDATE/DELETE on all 62 and BYPASSRLS. Those effective grants are preserved; no new privileged grants are introduced.
- Wider policy audit found early_intervention_requests and leadership_pilot_requests have PUBLIC ALL USING true/WITH CHECK true. school_campaigns permits authenticated ALL through service_role_all. The candidate also revokes direct client privileges on these three RLS-enabled tables. Public pilot submissions use the server storage client; their explicit public POST endpoints remain. COO request reads/deletes use role-protected server routes. No current literal school_campaigns client/server caller was found; its direct access is conservatively denied.
- The only public view found, scheduled_sessions_with_names, has security_invoker=true and no anonymous/authenticated SELECT grant. Existing RLS-protected ownership tables remain unchanged. Their policies query users; direct client policy evaluation may fail after users privileges are revoked. This is a documented fail-closed impact; server paths use privileged access.
- Confidential buckets remain public: tutor-documents 79 objects (67 PDFs), coo-brain-library one PDF. profile-images contains one intentionally public image. storage.objects has RLS and zero policies. No confidential object contents or public URLs were retrieved.
- public.handle_new_user() is SECURITY DEFINER, callable by anon/authenticated, has mutable search_path, derives role from raw_user_meta_data and has zero trigger bindings. A trigger-returning function is not evidence of a successful direct RPC exploit. Separately review EXECUTE revocation from PUBLIC/anon/authenticated, trusted role provenance, fixed search_path and trigger reactivation controls. EXECUTE revocation alone does not secure a later trigger binding. No breach or unauthorized role creation is asserted. Other mutable-path functions require separate reviewed hardening.

## Candidate behavior

The table migration denies all direct client CRUD on 65 reviewed tables, enables RLS on the 62, revokes table and column privileges, aborts when an unlisted no-RLS table appears or a reviewed no-RLS table gains a policy, and verifies the global no-RLS count is zero. Server business authorization remains in the API. No generic authenticated allow-all or unreviewed ownership policy is added.

The server client chooses a modern secret or legacy service_role before browser credentials. Actual SUPABASE_URL drives the Hub guard independently of DATABASE_URL; Hub Preview also fails closed. Non-preview production refuses browser fallback. Key format checks are not credential validity proof. The separate publishable auth client remains separate. Privileged auth session persistence is disabled. Tracked storage.js has the same correction; esbuild dependency metadata selects storage.ts for both bundles.

Storage migration makes tutor-documents and coo-brain-library private, plus executive-task-proofs if it exists. It preserves object records and profile-images. It refuses unexpected object policies. Private downloads proxy bytes after matching persisted evidence and record ownership; COO/HR access follows existing route scope (HR tutor applications only). Executive file access requires an active command seat and task ownership/support or CEO/COO authority. Uploaded executive keys use UUIDs and upsert=false; immutable references replace public/signed URLs. Historical confidential URLs resolve through protected downloads without rewriting evidence. Arbitrary objects and foreign storage origins are denied.

Browser reset navigation no longer queries users directly; it uses trusted app metadata or the established login fallback.

## Proof and limits

20 focused tests pass, including the actual registered executive read/upload-denial routes with fictional adapters. Run npm run test:p0-security and npm run test:db-authority. The isolated engine is PGlite (actual PostgreSQL compiled to WASM), with fictional data only. It proves table/column revocation, authenticated cross-account denial, service_role CRUD, transactional rollback on extra-table/policy drift, historical Storage record preservation, and protected HTTP download authorization. Storage transport in HTTP tests is a fictional adapter, not the live Supabase Storage service.

Backend and Vercel API bundles compile; frontend build/prerender compile. In this container tsx CLI IPC fails with EPERM; node --import tsx is the supported local alternative. Focused new-module TypeScript passes. Full repository TypeScript was compared with main; default heap exhausted, expanded heap emits the same error counts by file/diagnostic code as main, with no new file/code diagnostics. Do not report full check as green.

Representative existing auth/Preview/demand/Trial tests pass (51). These are regressions, not proof of complete deployed parent/student/report/COO/Trial journeys.

Render workspace was explicitly confirmed by the operator. Service srv-d544dnu3jp1c739139vg is live on main 65f72294, deployment dep-db7dk3e7bikc73ctjrv0; starts npx tsx server/index.ts; auto-deploy main enabled; Render PR previews disabled. Logs show emergency DB auth and transaction pooler host but do not prove the REST project or working privileged credential. Vercel project prj_mJZFuKba3TALYiWLoG1EZ8vbv5se is the frontend/Preview; encrypted Preview service-key metadata is presence only. Production API routes to the Render backend. Never infer Render credential validity from Vercel configuration.

## Exact release order and outage controls

1. Publish/review this source head; require CI and Vercel Preview acceptance, including controlled identities for real login, role-negative and operational API journeys.
2. Verify actual Render SUPABASE_URL/DATABASE_URL wiring and privileged credential in the backend. scripts/p0RuntimePreflight.ts performs read-only admin and REST probes and emits only project/credential-kind/status/commit. Run inside the backend, never copy its keys into a browser or ticket. This receipt is outstanding.
3. Release matching server/private-file application code before confidential Storage containment. Preserve a verified privileged credential; startup otherwise intentionally fails closed. Confidential uploads to still-public buckets will temporarily be refused until protected containment. Do not create replacement public buckets.
4. Founder runs protected PLAN on the exact tested source revision, reviews all pending managed migrations (including prior eight-table containment), then APPLY on that same revision with THE_HUB only after runtime and Preview gates pass. This workflow applies all pending managed migrations; the plan must establish the exact scope. Never use db:push, direct DDL, apply_migration, or an unprotected runner.
5. Independently read back private.ri_production_schema_migrations checksums/source commits, 65-table effective client/column grants and RLS, confidential bucket status and object counts; execute checks/p0_catalog_drift_postapply.sql (all three counts zero). Then perform real anonymous/authenticated cross-account HTTP denial, privileged operational positive paths, login and file-access smoke tests.
6. Close #178 only after applied/deployed/independently accepted evidence exists.

An individual failed migration rolls back through the protected runner. Earlier successful migrations may already be committed; inspect the ledger, do not call the entire multi-migration release atomic. After commit, recover by fixing forward through the same protected authority. Do not restore public bucket status, disable RLS or restore unrestricted client grants. Application rollback must retain privileged credential selection and protected file access. Historical links/objects without a matching authorized record remain denied pending a separately justified recovery.

Smallest founder-reserved control: protected PLAN first, then protected APPLY with THE_HUB when gates are genuinely satisfied. No founder coding permission or strategy decision is required.
