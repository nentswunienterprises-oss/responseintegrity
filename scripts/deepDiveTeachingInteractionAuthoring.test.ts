import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd(), "client/src/pages/responseconditioningsystem");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".tsx") ? [full] : [];
  });
}

function acceptedKeys(block: string) {
  const single = block.match(/correctOptionKey="([^"]+)"/)?.[1];
  if (single) return [single];
  const raw = block.match(/correctOptionKeys=\{\[([^\]]+)\]\}/)?.[1] || "";
  return [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

test("formative interactions keep the OS-wide silent alternate-valid standard", () => {
  let singleCount = 0;
  let dualCount = 0;
  let total = 0;

  for (const file of walk(ROOT)) {
    const source = readFileSync(file, "utf8");
    const blocks = source.match(/<DeepDiveTeachingInteraction[\s\S]*?\/>/g) || [];
    for (const block of blocks) {
      total += 1;
      const kind = block.match(/kind="([^"]+)"/)?.[1] || "single_choice";
      const accepted = acceptedKeys(block);
      const optionCount = [...block.matchAll(/key:\s*"([^"]+)"/g)].length;
      assert.ok(optionCount >= 5, `${file} has a formative interaction with fewer than five options.`);

      for (const match of block.matchAll(/label:\s*"([^"]+)"/g)) {
        assert.doesNotMatch(
          match[1],
          /\bThat can seem reasonable\b|^What matters is that\b|^The key is that\b/i,
          `${file} has formative answer copy that comments on the option instead of answering the prompt directly.`,
        );
      }

      if (kind === "multi_select") {
        assert.ok(accepted.length >= 2, `${file} multi-select needs at least two accepted answers.`);
        continue;
      }

      singleCount += 1;
      assert.ok(accepted.length === 1 || accepted.length === 2, `${file} single-choice must define one or two accepted answers.`);
      if (accepted.length === 2) dualCount += 1;

      for (const m of block.matchAll(/key:\s*"([^"]+)"[\s\S]*?feedback:\s*"([^"]+)"/g)) {
        if (/^Yes\b/.test(m[2])) {
          assert.ok(accepted.includes(m[1]), `${file} has a positive-feedback option that scoring does not accept.`);
        }
      }
    }
  }

  assert.ok(total > 0);
  assert.ok(singleCount >= 10);
  const rate = dualCount / singleCount;
  assert.ok(rate >= 0.7 && rate <= 0.9, `Silent alternate-valid formative items must stay around 80% OS-wide. Found ${dualCount}/${singleCount} (${(rate * 100).toFixed(1)}%).`);
});
