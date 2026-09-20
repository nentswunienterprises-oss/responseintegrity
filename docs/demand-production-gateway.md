# Demand Production Gateway — operating contract and migration

The existing RI platform is the system of record. Parent acquisition and enrollment are the human operating subsystem of Demand Production. No CRM, WhatsApp integration or automated qualification is introduced.

## Two independent lines

Demand: awareness → Production Link (optional for organic) → signup / capture → Gateway application → qualification pending → human review → qualified or not qualified → deliberate Pilot / Commercial decision → handover → assignment → service environment → trial where applicable → proposal / plan → free Pilot or paid package → verified service entry → conditioning → evidence → renewal / referral / exit.

Capacity: Production Link → Specialist application → Training → Sandbox → Trial → Certified Live → deployment. `assignment_lane` governs the Specialist placement; it does not choose the family's service arrangement. An approved Pilot can use the Certified Live lane. An attributed family can enter Commercial.

## Source, decisions and gates

`users.production_link_code` and the earliest attributed `leads` row preserve first valid attribution. Parent `affiliate_code` is retained as a compatibility mirror. Code, original tracking source and campaign cannot be replaced once attributed. Conflicting later links are rejected. Existing attribution survives link revocation; new claims require an active Demand link. UTM data supplements lineage. Account/profile refresh omits attribution fields rather than clearing them. Password signup, OAuth and Gateway share `captureDemandParent`.

New captures have `parents.onboarding_type = pending` and pending lead classification. Gateway does not accept an entry decision from the parent. A new application starts `qualification_status = pending`; the existing `status = awaiting_assignment` remains for Gateway compatibility and is not assignment permission.

Staff act from the existing COO Production Economy page. Review states are `pending`, `contact_required`, `contacted`, `follow_up`, `qualified`, `not_qualified`. A decision requires an existing staff owner, decision maker, server timestamp and fresh note. A terminal qualification decision is immutable. Corrections/reopening are deliberately not exposed as casual overrides; any future correction procedure must retain original evidence.

Only qualified applications can select Pilot or Commercial. Entry selection records actor and timestamp and is immutable. Handover then requires a distinct receiving staff user and a note describing the accepted next action. The sender confirms responsibility has actually been accepted, not just that a message was sent. The recorded sender is the authenticated completing actor. Handover completion is inferred from persisted transfer evidence, not a separate manually edited status.

The 24-hour handover clock begins at the completed **qualified** decision, so delayed entry selection cannot hide delay. Completion within 24 hours is within standard; open or completed handovers over 24 hours are breached. Historical/missing/invalid timestamps are not measurable. The UI distinguishes a pending transfer inside its deadline from a completed transfer.

Both assignment APIs check the Demand gate before creating students/Trial placements. A database trigger also blocks assignment or service progression for new applications until qualification, entry selection and handover are complete. The Specialist lane and its existing certification/capacity gates remain independent.

## Database changes

Apply `migrations/20260916191307_demand_production_gateway.sql` **before** deploying the application. Generated with the Supabase CLI and moved into this repository's existing migration directory. The migration is transactional and repeatable.

| Table / column | Purpose | New default | Existing rows / migration |
|---|---|---|---|
| parents.onboarding_type | Canonical family service arrangement | `pending` | Existing Pilot/Commercial values untouched; no global reclassification |
| leads.onboarding_type | Compatibility reporting mirror, updated only with explicit entry decision | `pending` | Existing values untouched |
| parent_enrollments.demand_flow_version | Explicit new-flow gate boundary | `1` | Added with `0` for all pre-existing rows, then default switched to `1`; never downgradable |
| qualification_status | Persisted review station | `pending` | Added nullable first; existing values remain NULL |
| qualification_owner_id | Accountable staff user FK | NULL | No backfill |
| qualification_contacted_at | First recorded human contact time | NULL | No invented contacts |
| qualification_completed_at | Completed decision and qualified SLA start | NULL | No backfill |
| qualification_decided_by | Decision maker user FK | NULL | No backfill |
| qualification_note | Minimal decision/follow-up context | NULL | No backfill; 2,000-character command limit |
| entry_selected_at | Deliberate arrangement selection time | NULL | No backfill |
| entry_selected_by | Selecting staff user FK | NULL | No backfill |
| handover_from_user_id | Actual handing-over actor FK | NULL | No backfill |
| handover_to_user_id | Receiving staff user FK | NULL | No backfill |
| handover_completed_at | Completed responsibility transfer time | NULL | No backfill |
| handover_note | Agreed next action / transfer context | NULL | No backfill |

No new production table or enum. Shared schema exposes the new enrollment fields; the pre-existing `parent_id` / runtime `user_id` mismatch is not widened into a schema rewrite. Runtime joins use `user_id` (with historical `parent_id` fallback for existing report inputs).

`update_demand_production` is a SECURITY INVOKER RPC, revoked from PUBLIC/anon/authenticated and granted only to service_role. It validates actor/recipient roles, locks the enrollment, and atomically updates decision evidence plus parent/lead classification. Actor IDs come from authenticated server context, never the request body. Existing enrollment writes by anon/authenticated are denied by the new guard; server writes require the service-role connection. Existing application auth and role middleware still run.

`guard_demand_enrollment` enforces station evidence, immutability and progression; `guard_demand_entry_type` protects classification and the parent source; `guard_first_production_lineage` protects account/lead source fields. These guards supplement existing access controls. No broadly permissive RLS policies or SECURITY DEFINER bypass are introduced.

Explicit synthetic `is_sandbox_account` records retain their existing Specialist Sandbox path. A new Demand enrollment cannot switch itself into that exemption. Pre-existing enrollments retain their legacy operational behavior even without qualification/handover. When an old active enrollment lacks a parent billing record entirely, the historical commercial fallback applies only after a persisted version-0 enrollment is found. New captures never inherit that fallback.

Deployment rollback: revert the application release first and retain new evidence. Do **not** drop columns or reclassify live families. The new-flow database gate deliberately continues protecting version-1 records. If rollback requires legacy writers to classify new families prematurely, stop intake and forward-fix; disabling integrity triggers is not a safe routine rollback. Pre-existing records remain serviceable. Validate the migration against a representative staging schema before production deployment; the checked-in proof fixture is not a complete clone of production.

## Measurement and economic truth

Production Economy derives capture, pending review, contact, qualified/not-qualified, completed handover, Pilot service entry and Commercial paid entry from persisted rows. Multiple historical lead rows count as one family opportunity. Organic families remain visible. Missing historical qualification is reported separately, not manufactured. Unavailable payment/proposal evidence yields NULL rather than a conversion count. Source lineage keeps original source/campaign and contributor metadata. Capacity remains separate; deployment is unavailable until evidence is implemented.

Verified Pilot entry requires the Pilot arrangement, an accepted linked proposal and the existing unlocked service state (`session_booked` or `confirmed`). It is never a paid conversion. Verified Commercial entry additionally requires the existing linked PayFast transaction to be `paid`, have a payment timestamp and positive amount. New-flow records must also pass the Demand gate. A close row alone, classification alone, an unpaid proposal, or a payment without unlocked service cannot count. This is verified entry evidence, not a claim of ongoing attendance or current-month renewal. Existing payment/entitlement logic remains authoritative; there is no parallel payment state.

Canonical economics come from `shared/servicePackages.ts`: R200/session; 8/12/16 monthly sessions costing R1,600/R2,400/R3,200; R130 Specialist and R70 RI per qualifying session. Production Rewards remain disabled and economically undefined. Historical R1,000/R750/R250/R100 documents are archival, not executable policy.

## Proof boundary

`npm run test:demand-production` applies the actual migration to isolated PGlite PostgreSQL, exercises role/constraint boundaries and then uses the real signup, Gateway, decision, assignment, proposal and sandbox-payment HTTP handlers through a narrow test PostgREST transport. No production database or payment provider is contacted. Supabase Auth identity issuance and session transport are synthetic; actual route authentication/role checks run. The Specialist intro/diagnosis prerequisites are seeded as fixtures, not reimplemented. Both family journeys preserve account, lead and parent lineage. The UI proof operates on synthetic records only.
