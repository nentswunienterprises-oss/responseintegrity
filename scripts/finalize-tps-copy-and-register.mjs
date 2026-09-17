// Triggered after workflow installation to apply the final TPS synchronization pass.
import fs from "node:fs";

function patch(path, replacements) {
  let source = fs.readFileSync(path, "utf8");
  for (const [search, replacement, label] of replacements) {
    const count = source.split(search).length - 1;
    if (count !== 1) throw new Error(`${path}: expected one anchor for ${label}, found ${count}`);
    source = source.replace(search, replacement);
  }
  fs.writeFileSync(path, source);
}

patch("shared/topicConditioningEngine.ts", [
  [
    'focus: "We are maintaining performance and preparing them to transfer this skill to new topics.",',
    'focus: "We are maintaining this topic\'s timed performance and confirming that the same structure remains stable across repeated work.",',
    "parent TPS High focus",
  ],
  [
    'focus: "We are maintaining performance and expanding transfer across related topics.",',
    'focus: "We are maintaining this topic\'s timed stability through periodic maintenance without assigning that state to other topics.",',
    "parent TPS HM focus",
  ],
  [
    '"Confirm structure under timed variation",',
    '"Confirm structure under the same prescribed timed condition",',
    "TPS High same-form action",
  ],
  [
    'rules: ["Do not over-train same pattern", "Begin cross-topic conditioning"],\n      nextActions: [\n        "Run Time Pressure Stability maintenance drill",\n        "Introduce new variations of topic",\n        "Prepare for transfer to new topics",\n      ],',
    'rules: ["Do not over-train the topic", "Keep final-phase maintenance topic-specific"],\n      nextActions: [\n        "Run Time Pressure Stability maintenance drill for this topic",\n        "Confirm the same topic remains stable under its prescribed timed conditions",\n        "Keep other topics on their own independently derived phase and stability state",\n      ],',
    "TPS HM next actions",
  ],
]);

patch("client/src/components/tutor/topicConditioningEngine.ts", [
  [
    'transitionStatus = "Maintain and transfer to new topics";',
    'transitionStatus = "Maintain this topic at final-phase High Maintenance";',
    "tutor final TPS transition status",
  ],
  [
    '"Confirm structure under timed variation",',
    '"Confirm structure under the same prescribed timed condition",',
    "tutor TPS High same-form action",
  ],
  [
    'nextActions: [\n        "Run Time Pressure Stability maintenance drill",\n        "Introduce new variations of topic",\n        "Prepare for transfer to new topics",\n      ],\n      rules: ["Do not over-train same pattern", "Begin cross-topic conditioning"],',
    'nextActions: [\n        "Run Time Pressure Stability maintenance drill for this topic",\n        "Confirm the same topic remains stable under its prescribed timed conditions",\n        "Keep other topics on their own independently derived phase and stability state",\n      ],\n      rules: ["Do not over-train the topic", "Keep final-phase maintenance topic-specific"],',
    "tutor TPS HM next actions",
  ],
]);

patch("client/src/pages/responseconditioningsystem/transformation-phases/time-pressure-stability.tsx", [
  [
    '"High Maintenance: qualifying evidence marks the topic as transfer-ready or ready for mixed maintenance work. The engine owns that decision.",',
    '"High Maintenance: qualifying evidence keeps this topic at final-phase High Maintenance. Maintenance remains topic-specific; other topics keep their own independently derived states.",',
    "TPS progression copy",
  ],
  [
    'Use the active student topic and the Map/pre-session preparation direction. Problems should be normal difficulty unless the\n            system explicitly directs otherwise. The pressure comes from timing and repetition, not from secretly changing the topic demand.',
    'Use the active student topic and the Map/pre-session preparation direction. TPS problems remain normal difficulty and same form across\n            the defined training sequence. The pressure variable is timing and repetition; mathematical difficulty and problem form do not change.',
    "TPS fixed-condition prep copy",
  ],
  [
    'This Deep Dive defines the recipe and pressure levels, but not a personal timer formula. Use the runner/pre-session timer\n              instruction. Do not invent a different timer and treat it as canon.',
    'The runner uses the immutable TPS Timer Contract for this student and topic. Structure Under Timer and Repeated Timed Execution use 100% of the\n              baseline duration; Full Constraint uses 85%. Do not invent, loosen, or tighten a different timer.',
    "TPS timer boundary copy",
  ],
  [
    '"Run the timed attempt using the runner/prep-defined timer, withhold help, observe start, structure, pace, and completion, then log the response.",',
    '"Run the timed attempt using the runner-owned duration from the active TPS Timer Contract, withhold help, observe start, structure, pace, and completion, then log the response.",',
    "structure under timer specialist action",
  ],
  [
    '"Run the full constraint exactly as defined by the runner/prep, withhold help, observe the full pressure response, and log the evidence.",',
    '"Run Full Constraint at the runner-owned 85% Timer Contract duration, withhold help, observe the full pressure response, and log the evidence.",',
    "full constraint specialist action",
  ],
]);

patch("client/src/pages/client/parent/dashboard.tsx", [
  [
    'focus: "We are maintaining performance and preparing them to transfer this skill to new topics.",',
    'focus: "We are maintaining this topic\'s timed performance and confirming that the same structure remains stable across repeated work.",',
    "dashboard TPS High focus",
  ],
  [
    'focus: "We are maintaining performance and expanding transfer across related topics.",',
    'focus: "We are maintaining this topic\'s timed stability through periodic maintenance without assigning that state to other topics.",',
    "dashboard TPS HM focus",
  ],
]);

patch("TT_DRILL_LIBRARY_AND_STATE_ENGINE_EXACT.md", [
  [
    '- If already in final phase, `getNextPhase` returns current phase, so final-phase `High Maintenance` + `85+` produces the same phase at `Low` with `phase progress`',
    '- If already in final Time Pressure Stability, `High Maintenance` + `85+` remains `Time Pressure Stability / High Maintenance` with `remain`; the final phase never resets to Low because there is no next in-sequence phase.',
    "final TPS HM state rule",
  ],
  [
    '- Rules: `Do not over-train same pattern`; `Begin cross-topic conditioning`\n  - Next actions: `Run Time Pressure Stability maintenance drill`; `Introduce new variations of topic`; `Prepare for transfer to new topics`',
    '- Rules: `Do not over-train the topic`; `Keep final-phase maintenance topic-specific`\n  - Next actions: `Run Time Pressure Stability maintenance drill for this topic`; `Confirm the same topic remains stable under its prescribed timed conditions`; `Keep other topics on their own independently derived phase and stability state`',
    "TT TPS HM next actions",
  ],
  [
    '- final phase => `Maintain and transfer to new topics`',
    '- final phase => `Maintain this topic at final-phase High Maintenance`',
    "TT tutor final state copy",
  ],
  [
    '- Focus: `We are maintaining performance and preparing them to transfer this skill to new topics.`',
    '- Focus: `We are maintaining this topic\'s timed performance and confirming that the same structure remains stable across repeated work.`',
    "TT parent TPS High focus",
  ],
  [
    '- Focus: `We are maintaining performance and expanding transfer across related topics.`',
    '- Focus: `We are maintaining this topic\'s timed stability through periodic maintenance without assigning that state to other topics.`',
    "TT parent TPS HM focus",
  ],
]);

patch("docs/capability-v2r8-product-decision-register.md", [
  [
    'Resolved doctrine. One live Deep Dive sentence still needs synchronization before freeze.',
    'Resolved and synchronized in the proof branch.',
    "TPS isolate status",
  ],
  [
    '- The current Deep Dive phrase `unless the system explicitly directs otherwise` is too loose for this contract and must be removed or rewritten to state the fixed standard clearly.',
    '- The live Deep Dive now states the fixed condition directly: normal difficulty, same form, no support; timing is the only pressure variable that changes.',
    "TPS fixed-condition follow-up",
  ],
  [
    'Approved product contract. The pure Timer Contract V1 and test coverage are implemented on the proof branch in `shared/capabilityTpsTimerContract.ts` and `shared/capabilityTpsTimerContract.test.ts`. Runtime runner/server wiring remains an implementation gap below.',
    'Approved product contract and runtime implementation completed on the proof branch. The pure Timer Contract V1, deterministic tests, V2 timing evidence, server routes, Specialist runner countdown/calibration flow, append-only persistence schema, and proof-database migration are now wired together.',
    "TPS runtime implementation status",
  ],
]);

console.log("TPS synchronization patch applied.");
