import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import type { CapabilityAssessmentDefinition } from "@shared/capabilityEngine";
import { resolveCapabilityFormSecret } from "./capabilityFormGeneration";

const INTERACTION_CONTEXT = "response-integrity:capability-interaction:v1";
const RECEIPT_CONTEXT = "response-integrity:capability-receipt:v1";
const INTERACTION_TTL_MS = 12 * 60 * 60 * 1000;

export type CapabilityInteractionPayload = {
  version: 1;
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  formId: string;
  definition: CapabilityAssessmentDefinition;
  createdAt: number;
  expiresAt: number;
};

export type CapabilityQuestionReceiptPayload = {
  version: 1;
  tutorAssignmentId: string;
  tutorId: string;
  assessmentKey: string;
  bankVersion: number;
  attemptNumber: number;
  formId: string;
  questionIndex: number;
  questionKey: string;
  selectedOptionKeys: string[];
  confirmedAt: number;
};

function capabilitySecret() {
  const resolved = resolveCapabilityFormSecret();
  if (!resolved.secret) {
    const error = new Error("Capability form secret is not configured.") as Error & {
      status?: number;
    };
    error.status = 503;
    throw error;
  }
  return resolved.secret;
}

function deriveKey(context: string) {
  return createHash("sha256")
    .update(capabilitySecret())
    .update(":")
    .update(context)
    .digest();
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

export function createCapabilityInteractionToken(input: Omit<
  CapabilityInteractionPayload,
  "version" | "createdAt" | "expiresAt"
>) {
  const now = Date.now();
  const payload: CapabilityInteractionPayload = {
    version: 1,
    ...input,
    createdAt: now,
    expiresAt: now + INTERACTION_TTL_MS,
  };

  const key = deriveKey(INTERACTION_CONTEXT);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function readCapabilityInteractionToken(token: string) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = String(token || "").split(".");
  if (
    version !== "v1" ||
    !ivEncoded ||
    !tagEncoded ||
    !ciphertextEncoded
  ) {
    const error = new Error("Capability interaction token is invalid.") as Error & {
      status?: number;
    };
    error.status = 400;
    throw error;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(INTERACTION_CONTEXT),
      Buffer.from(ivEncoded, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(plaintext) as CapabilityInteractionPayload;

    if (payload.version !== 1 || payload.expiresAt < Date.now()) {
      const error = new Error("Capability interaction token has expired.") as Error & {
        status?: number;
      };
      error.status = 409;
      throw error;
    }

    return payload;
  } catch (caught) {
    if (Number((caught as any)?.status) === 409) throw caught;
    const error = new Error("Capability interaction token could not be verified.") as Error & {
      status?: number;
    };
    error.status = 400;
    throw error;
  }
}

export function createCapabilityQuestionReceipt(
  payload: CapabilityQuestionReceiptPayload,
) {
  const body = encodeJson(payload);
  const signature = createHmac("sha256", deriveKey(RECEIPT_CONTEXT))
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function readCapabilityQuestionReceipt(receipt: string) {
  const [body, signature] = String(receipt || "").split(".");
  if (!body || !signature) {
    const error = new Error("Capability answer receipt is invalid.") as Error & {
      status?: number;
    };
    error.status = 400;
    throw error;
  }

  const expected = createHmac("sha256", deriveKey(RECEIPT_CONTEXT))
    .update(body)
    .digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    const error = new Error("Capability answer receipt could not be verified.") as Error & {
      status?: number;
    };
    error.status = 400;
    throw error;
  }

  const payload = decodeJson<CapabilityQuestionReceiptPayload>(body);
  if (payload.version !== 1) {
    const error = new Error("Capability answer receipt version is invalid.") as Error & {
      status?: number;
    };
    error.status = 400;
    throw error;
  }
  return payload;
}
