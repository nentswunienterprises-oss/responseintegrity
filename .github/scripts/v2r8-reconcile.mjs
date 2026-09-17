import fs from 'node:fs';

const runnerPath = 'client/src/components/tutor/IntroSessionDrillRunner.tsx';
let runner = fs.readFileSync(runnerPath, 'utf8');
const runnerReplacements = [
  [
    'purpose: "Student solves with minimal help. Tests start behavior, structure, and clarity carryover.",',
    'purpose: "Student solves with at most a response-control cue. Tests start behavior, structure, and clarity carryover without mathematical help.",',
  ],
  [
    'repInstruction: "Ask student to solve. Minimal guidance only. Observe start behavior and step discipline.",',
    'repInstruction: "Ask student to solve. If needed, use only a response-control cue such as pause, don\'t rush, or show me what you would do next.",',
  ],
  [
    'activeRules: ["Minimal guidance only", "No step-by-step help", "Observe independent start and execution"],',
    'activeRules: ["Response-control cue only if needed", "No mathematical hints, steps, corrections, or correctness confirmation", "Observe independent start and execution"],',
  ],
];
for (const [from, to] of runnerReplacements) {
  if (!runner.includes(from)) throw new Error(`Expected runner wording not found: ${from}`);
  runner = runner.replace(from, to);
}
fs.writeFileSync(runnerPath, runner);

const registerPath = 'docs/capability-v2r8-product-decision-register.md';
let register = fs.readFileSync(registerPath, 'utf8');
const statusReplacements = [
  [
    'Resolved doctrine. Product implementation follow-up remains before freeze.',
    'Resolved and synchronized in the proof branch. Support ceilings, rep-level actual-support capture, and deterministic evidence-condition gating are implemented.',
  ],
  [
    'Approved product contract. Implementation requires a new versioned evidence contract before freeze.',
    'Resolved and implemented on the proof branch through the additive V2 operational evidence contract; the published V1 evidence contract remains immutable.',
  ],
  [
    'A V2 type contract now exists in `shared/responseIntegrityEvidenceContractV2.ts`; runtime capture and persistence still need to be wired before freeze.',
    'The V2 operational evidence contract is now captured in the Specialist runner, serialized beside the immutable V1 drill payload, consumed by support-validity and inherited-layer logic, and projected into the proof evidence lineage.',
  ],
  [
    'Approved product contract. Runner and doctrine synchronization are required before freeze.',
    'Resolved and synchronized in the proof branch. Topic Reference is locked during scored evidence and remains available only during preparation, Modeling, and between closed reps.',
  ],
  [
    'Approved global support-semantics contract. Clarity Deep Dive and runner wording require synchronization before freeze.',
    'Resolved and synchronized in the proof branch. `minimal` now means response-control cueing only across Specialist-facing scored-rep instructions; mathematical help is outside that ceiling.',
  ],
  [
    'Approved product contract. Implementation requires the new versioned evidence contract and deterministic verification routing before freeze.',
    'Resolved and implemented on the proof branch. Supplemental inherited-layer evidence is captured in V2 operational evidence, kept separate from the current-phase score, and deterministically gates positive movement.',
  ],
  [
    'Approved product contract. Implementation requires a deterministic verification-hold state/flag and cross-phase consequence routing before freeze.',
    'Resolved and implemented on the proof branch. The inherited-verification hold, earlier-layer verification lane, clear/regress/re-diagnose consequences, and fresh-current-phase-evidence requirement are wired end to end.',
  ],
  [
    'Approved product contract. Implementation requires an auditable correction workflow before freeze.',
    'Approved product contract. The append-only correction schema and deterministic correction-overlay core are implemented, but the authenticated request/review runtime, deterministic topic replay, dependent report supersession/regeneration, and Timer Contract replay are still required before freeze.',
  ],
];
for (const [from, to] of statusReplacements) {
  if (!register.includes(from)) throw new Error(`Expected register status not found: ${from}`);
  register = register.replace(from, to);
}

const heading = '## Open product decisions and implementation gaps to resolve before final freeze\n';
const insert = `## Open product decisions and implementation gaps to resolve before final freeze\n\n### Evidence correction runtime remains the unresolved cross-cutting blocker\n\nThe human-review reconciliation against the proof-branch implementation is complete. The support contract, Topic Reference boundary, global \`minimal\` semantics, inherited-layer capture/hold/verification flow, topic-specific final-state behavior, and TPS Timer Contract runtime are implemented and covered by proof-branch tests.\n\nEvidence correction is not yet end to end. The branch has immutable correction/review/replay/report-supersession tables and a deterministic overlay core, but it still needs authenticated Specialist request submission, TD/COO review authority with self-approval blocked, chronological topic replay from the corrected source event, active topic-state replacement from that replay, dependent deterministic report supersession/regeneration, and TPS Timer Contract supersession/reconstruction when corrected baseline lineage is affected. These are implementation requirements, not open doctrine questions.\n`;
if (!register.includes(heading)) throw new Error('Open-gaps heading not found');
register = register.replace(heading, insert);
fs.writeFileSync(registerPath, register);
