import crypto from "crypto";

export const PAYFAST_LIVE_PROCESS_URL = "https://www.payfast.co.za/eng/process";
export const PAYFAST_SANDBOX_PROCESS_URL = "https://sandbox.payfast.co.za/eng/process";

export type InternalPaymentStatus = "pending" | "paid" | "failed" | "cancelled";

const PAYFAST_CHECKOUT_FIELD_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "notify_method",
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_int1",
  "custom_int2",
  "custom_int3",
  "custom_int4",
  "custom_int5",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "custom_str4",
  "custom_str5",
  "email_confirmation",
  "confirmation_address",
  "currency",
  "payment_method",
  "subscription_type",
  "billing_date",
  "recurring_amount",
  "frequency",
  "cycles",
  "subscription_notify_email",
  "subscription_notify_webhook",
  "subscription_notify_buyer",
] as const;

function encodePayfastValue(value: string) {
  // Match PHP urlencode(), which is the encoding PayFast documents for
  // custom-payment signatures. encodeURIComponent leaves several characters
  // unescaped that PHP urlencode() escapes.
  return encodeURIComponent(value)
    .replace(/[!'()~*]/g, (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/%20/g, "+");
}

function appendPayfastPair(
  pairs: string[],
  key: string,
  value: string | number | null | undefined,
) {
  if (value === undefined || value === null) return;
  const normalized = String(value).trim();
  if (normalized === "") return;
  pairs.push(`${key}=${encodePayfastValue(normalized)}`);
}

export function buildPayfastSignature(
  values: Record<string, string | number | null | undefined>,
  passphrase?: string | null,
) {
  // Used for incoming PayFast payload verification. Preserve the payload's
  // supplied order, excluding the signature itself.
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (key === "signature") continue;
    appendPayfastPair(pairs, key, value);
  }

  if (passphrase) {
    appendPayfastPair(pairs, "passphrase", passphrase);
  }

  return crypto.createHash("md5").update(pairs.join("&")).digest("hex");
}

export function buildPayfastCheckoutSignature(
  values: Record<string, string | number | null | undefined>,
  passphrase?: string | null,
) {
  const pairs: string[] = [];

  for (const key of PAYFAST_CHECKOUT_FIELD_ORDER) {
    appendPayfastPair(pairs, key, values[key]);
  }

  if (passphrase) {
    appendPayfastPair(pairs, "passphrase", passphrase);
  }

  return crypto.createHash("md5").update(pairs.join("&")).digest("hex");
}

export function withPayfastSignature(
  values: Record<string, string | number | null | undefined>,
  passphrase?: string | null,
) {
  // Submit fields in the same canonical order used to generate the signature.
  // PayFast's custom payment flow is order-sensitive.
  const ordered: Record<string, string | number | null | undefined> = {};

  for (const key of PAYFAST_CHECKOUT_FIELD_ORDER) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      ordered[key] = values[key];
    }
  }

  ordered.signature = buildPayfastCheckoutSignature(values, passphrase);
  return ordered;
}

export function verifyPayfastSignature(
  values: Record<string, string | number | null | undefined>,
  passphrase?: string | null,
) {
  const provided = String(values.signature || "").trim().toLowerCase();
  const expected = buildPayfastSignature(values, passphrase).toLowerCase();
  return provided !== "" && provided === expected;
}

export function getPayfastProcessUrl(useSandbox: boolean) {
  return useSandbox ? PAYFAST_SANDBOX_PROCESS_URL : PAYFAST_LIVE_PROCESS_URL;
}

export function normalizePayfastPaymentStatus(rawStatus: unknown): InternalPaymentStatus {
  const value = String(rawStatus || "").trim().toUpperCase();

  if (value === "COMPLETE") return "paid";
  if (value === "CANCELLED") return "cancelled";
  if (value === "FAILED") return "failed";

  return "pending";
}
