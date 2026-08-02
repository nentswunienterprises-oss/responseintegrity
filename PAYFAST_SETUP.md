# PayFast Premium Flow

## Business Rule

- Paid plan: `Premium`
- Price: `R1000` per student per month
- Revenue split:
  - Tutor: `R750`
  - TT: `R250`

## Onboarding Models

- `commercial`
  - Default when no affiliate code is provided
  - Parent pays at training proposal acceptance during onboarding
  - No payment means no training-session access

- `pilot`
  - Activated when parent signs up with an affiliate code
  - Parent accepts proposal without immediate payment
  - First `9` submitted sessions are free
  - After free-session usage is exhausted, Premium payment is required before more training sessions can be accessed

## Environment Variables

- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_SANDBOX=true` for sandbox
- `PAYFAST_SANDBOX_MERCHANT_ID` (optional)
- `PAYFAST_SANDBOX_MERCHANT_KEY` (optional)
- `PAYFAST_SANDBOX_PASSPHRASE` (optional)
- `APP_BASE_URL=https://app.responseintegrity.co.za`
- `API_PUBLIC_URL=https://api.responseintegrity.co.za`

If sandbox uses different PayFast credentials than live, set the sandbox-specific vars. Otherwise the live credentials are reused in sandbox mode.

`APP_BASE_URL` and `API_PUBLIC_URL` must be public web URLs. PayFast does not accept local `localhost` callback URLs for live ITN flow.

## What Was Added

- `payment_transactions` table
- PayFast signature helper in `server/payfast.ts`
- Parent proposal accept route now starts PayFast checkout
- PayFast ITN route at `/api/payments/payfast/notify`
- Training-session routes now enforce payment before access

## Expected Flow

1. Tutor sends proposal.
2. Parent clicks accept.
3. If `commercial`:
   - app creates or reuses a pending `payment_transactions` row
   - browser posts signed fields to PayFast
   - PayFast sends ITN to `/api/payments/payfast/notify`
   - app marks transaction `paid`
4. If `pilot`:
   - proposal is finalized immediately with free access
5. Enrollment moves to `session_booked`.
6. Training-session access is checked against onboarding type plus payment state.

## Deployment Steps

1. Apply `migrations/2026-04-29_add_payment_transactions.sql`.
2. Set the PayFast credentials and public URL env vars.
3. In PayFast, use the same passphrase configured in `PAYFAST_PASSPHRASE`.
4. Test sandbox checkout and confirm ITN reaches the notify endpoint.
