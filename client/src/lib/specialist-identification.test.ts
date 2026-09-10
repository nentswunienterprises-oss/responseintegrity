import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveSpecialistDateOfBirth,
  getSpecialistIdentificationLabel,
  normalizeSpecialistIdentificationType,
} from "./specialist-identification";

test("missing application identification type remains blank", () => {
  assert.equal(normalizeSpecialistIdentificationType(null), "");
});

test("missing Step 1 acceptance snapshot identification type remains blank", () => {
  assert.equal(normalizeSpecialistIdentificationType(undefined), "");
});

test("explicit identification types retain their canonical labels", () => {
  assert.equal(getSpecialistIdentificationLabel("sa_id"), "South African ID");
  assert.equal(getSpecialistIdentificationLabel("passport"), "Passport");
});

test("blank identification type does not derive date of birth", () => {
  assert.equal(deriveSpecialistDateOfBirth("", "9001015009087"), "");
  assert.equal(deriveSpecialistDateOfBirth(null, "9001015009087"), "");
});

test("South African ID derives date of birth only when explicitly selected", () => {
  assert.match(deriveSpecialistDateOfBirth("sa_id", "9001015009087"), /^1990-01-01$/);
});

test("previously persisted Step 1 identification types remain recognized for locking", () => {
  assert.equal(normalizeSpecialistIdentificationType({ idType: "sa_id" }.idType), "sa_id");
  assert.equal(normalizeSpecialistIdentificationType({ idType: "passport" }.idType), "passport");
});