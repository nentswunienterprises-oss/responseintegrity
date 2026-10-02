import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const bankSource = readFileSync(resolve(process.cwd(), "server/capabilityBank.ts"), "utf8");
const sequencingSource = readFileSync(resolve(process.cwd(), "server/capabilitySequencing.ts"), "utf8");
const engineSource = readFileSync(resolve(process.cwd(), "server/capabilityEngine.ts"), "utf8");
const migrationSource = readFileSync(
  resolve(process.cwd(), "migrations/2026-10-02_add_capability_review_mode.sql"),
  "utf8",
);

test("Capability runtime tolerates production configs before review_mode migration", () => {
  for (const source of [bankSource, sequencingSource, engineSource]) {
    assert.match(
      source,
      /COALESCE\(\(to_jsonb\(config\)->>'review_mode'\)::boolean, false\) AS review_mode/,
    );
  }
});

test("Capability review_mode has an explicit idempotent schema migration", () => {
  assert.match(
    migrationSource,
    /ADD COLUMN IF NOT EXISTS review_mode boolean NOT NULL DEFAULT false/i,
  );
});
