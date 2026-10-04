import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "server/specialistDevelopmentPathway.ts"),
  "utf8",
);

test("Specialist Development Pathway uses server database authority", () => {
  assert.match(source, /import \{ pool \} from "\.\/db";/);
  assert.doesNotMatch(source, /from "\.\/storage"/);
  assert.doesNotMatch(source, /\.from\("specialist_development_pathways"\)/);
  assert.match(source, /FROM public\.specialist_development_pathways/);
  assert.match(source, /INSERT INTO public\.specialist_development_pathways/);
  assert.match(source, /UPDATE public\.specialist_development_pathways/);
});
