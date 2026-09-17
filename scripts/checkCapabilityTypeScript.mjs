import { spawnSync } from "node:child_process";

const tscBin = process.platform === "win32"
  ? "node_modules/.bin/tsc.cmd"
  : "node_modules/.bin/tsc";

const result = spawnSync(tscBin, ["--pretty", "false", "--noEmit"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: false,
});

if (result.error) {
  console.error("Capability TypeScript check could not start tsc:", result.error);
  process.exit(1);
}

const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
const diagnosticLines = output
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => /error TS\d+:/.test(line));

const capabilityPrefixes = [
  "shared/capability",
  "server/capability",
  "server/routes/capability",
  "client/src/capabilityStandaloneApp.tsx",
  "client/src/pages/operational/capability",
  "client/src/pages/operational/tutor/capability",
  "client/src/components/sandbox/capability",
  "client/src/components/sandbox/Capability",
  "client/src/components/responseconditioning/DeepDiveDeterrent.tsx",
];

function diagnosticPath(line) {
  const match = line.match(/^([^()]+?)(?:\(\d+,\d+\))?: error TS\d+:/);
  return match?.[1]?.replaceAll("\\", "/") || null;
}

function isCapabilityDiagnostic(line) {
  const path = diagnosticPath(line);
  return Boolean(path && capabilityPrefixes.some((prefix) => path.startsWith(prefix)));
}

const capabilityDiagnostics = diagnosticLines.filter(isCapabilityDiagnostic);
const legacyDiagnostics = diagnosticLines.filter((line) => !isCapabilityDiagnostic(line));
const unscopedDiagnostics = diagnosticLines.filter((line) => diagnosticPath(line) === null);

console.log(`TypeScript diagnostics: ${diagnosticLines.length} total.`);
console.log(`Capability Engine diagnostics: ${capabilityDiagnostics.length}.`);
console.log(`Existing repository diagnostics outside Capability scope: ${legacyDiagnostics.length}.`);

if (capabilityDiagnostics.length > 0) {
  console.error("\nCapability Engine TypeScript diagnostics:\n");
  console.error(capabilityDiagnostics.join("\n"));
  process.exit(1);
}

if (unscopedDiagnostics.length > 0) {
  console.error("\nUnscoped TypeScript diagnostics cannot be safely classified:\n");
  console.error(unscopedDiagnostics.join("\n"));
  process.exit(1);
}

if ((result.status ?? 0) !== 0 && diagnosticLines.length === 0) {
  console.error(output || `tsc exited with status ${String(result.status)} without parseable diagnostics.`);
  process.exit(1);
}

if (legacyDiagnostics.length > 0) {
  console.log(
    "Whole-repository TypeScript is not yet clean, but no diagnostic originates from Capability Engine source. " +
    "Legacy diagnostics remain non-blocking for this branch and should be handled separately.",
  );
}
