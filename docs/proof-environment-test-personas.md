# Proof Environment Test Personas

The Vercel Preview + Proof database is a disposable integration playground for Response Integrity. It may be seeded with durable test personas and resettable workflow fixtures. Production must never reuse these identities or credentials.

## Persistent personas

Use dedicated identities under:

`@proof.responseintegrity.co.za`

These identities may authenticate in Vercel Preview through the private Proof credential fallback when a Supabase Auth identity is absent. The fallback is unavailable outside Preview.

Current durable roles should include:

- COO — control-plane testing for pods, approvals, Specialist onboarding, assignments, and executive workflow.
- Specialist — delivery, Sandbox, Training, Handover, and Trial workflow proof.
- Additional HR / TD / parent / student personas may be seeded when a proof path needs them.

## Credentials

Never commit plaintext Proof passwords.

GitHub Actions should reference encrypted repository secrets. Preferred names:

- `RI_PROOF_SPECIALIST_EMAIL`
- `RI_PROOF_SPECIALIST_PASSWORD`
- `RI_PROOF_COO_EMAIL`
- `RI_PROOF_COO_PASSWORD`
- `RI_PROOF_SHARED_PASSWORD` for intentionally shared Sandbox/Proof credentials where appropriate
- `VERCEL_AUTOMATION_BYPASS_SECRET` when Preview protection is enabled

The Proof database stores only bcrypt password hashes in `private.emergency_auth_credentials`.

## Sandbox accounts

Sandbox parent/persona accounts may use the shared Proof password convention, but code and docs must never contain the plaintext value. Agents should obtain it from the encrypted GitHub Actions secret or from an explicitly supplied user instruction in the active session.

## Preview domain

PR47 live-proof workflows currently use the stable branch alias:

`https://tt-confidence-hub-git-feat-evi-31b8c6-relief-works-technologies.vercel.app`

Prefer this alias over one-off deployment URLs for repeatable browser proof.

## Provisioning a reusable Proof persona

Use the Preview-only `POST /api/proof/personas/provision` route while authenticated as a Sandbox Specialist. The route is intentionally unavailable outside Vercel Preview and only accepts identities under `@proof.responseintegrity.co.za`.

It creates or repairs the canonical `public.users` record, writes only a bcrypt hash to the private credential table, and appoints the COO seat when the requested role is `coo`. This is the preferred mechanism for reusable COO and future Proof personas because it is idempotent and does not require direct Auth-table mutation.

The password itself must come from the active secure secret source; never add it to this document or to source control.

## Seeding rule

Seed only the Proof database. A reusable Proof persona should have:

1. a `public.users` row with the intended role;
2. a bcrypt credential in `private.emergency_auth_credentials`;
3. role-specific canonical state where required (for example an executive appointment for COO);
4. deterministic fixture data only when a live proof needs it.

Do not seed equivalent test credentials into production.
