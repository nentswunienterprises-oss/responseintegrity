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

const registerPath = "docs/capability-v2r8-product-decision-register.md";

patch(registerPath, [
  [
    "Resolved core-model rule; derivative next-action/reporting wording still needs synchronization below.",
    "Resolved and synchronized in the proof branch, including Specialist next-action and parent-facing final-state wording.",
    "topic-specific state synchronization status",
  ],
  [
`### TPS timer runtime wiring remains before TPS freeze

The timer formula and baseline timing semantics are no longer product ambiguities, but the live runner and server do not yet execute the whole contract. Before TPS freezes:

- the runner must passively time scored Structured Execution and Controlled Discomfort reps without displaying time pressure to the student; Clarity must not contribute Timer Contract V1 baseline data
- V2 rep evidence must capture \`actualSupportUsed\`, timing metadata, and inherited evidence without rewriting the published V1 contract
- timing records must persist in the authoritative drill evidence lineage
- the server must retain pre-TPS timing history while selecting only the latest three eligible comparable Structured Execution reps for the V1 baseline
- the Controlled Discomfort -> TPS transition must refuse TPS activation until a valid Timer Contract exists
- the fallback calibration lane must run before TPS activation when historical eligibility is insufficient, remain non-scored, and mint the contract before TPS Low begins
- the persisted contract must carry conditioning-epoch lineage so it remains immutable across sessions, stability movement, High Maintenance, and handovers, while allowing an explicit new epoch after TPS exit/re-entry or system-owned reset
- evidence-correction replay must be able to supersede a contract whose baseline lineage becomes invalid and require reconstructed timing plus fresh TPS evidence
- TPS runner UI must load the Timer Contract, display and run the prescribed countdown, and prevent Specialist duration edits
- Repeated Timed Execution must preserve the exact same prescribed duration across its reps
- Full Constraint must use the versioned 85% duration
- technical timer failures must persist as invalid attempts and generate linked replacement reps without student scoring or state movement
- a missing or invalid Timer Contract must lock scored TPS rather than inviting a Specialist fallback

The pure deterministic contract and automated tests are already implemented; this section tracks runtime wiring, not an unresolved timer policy.
`,
`### TPS timer runtime implementation completed

The approved Timer Contract V1 is now executed end to end on the proof branch and proof database:

- scored Structured Execution and Controlled Discomfort reps are passively timed without exposing a timer to the student; Clarity is excluded from the Timer Contract V1 dataset
- V2 rep operational evidence persists actual support used and timing metadata beside the immutable V1 drill schema
- the server retains passive timing history but selects only clean, comparable Structured Execution evidence for the latest-three baseline
- Controlled Discomfort -> TPS progression is blocked until a Timer Contract exists
- the fallback three-rep calibration lane runs before TPS activation, remains non-scored, and mints the contract before TPS Low can begin
- the contract is persisted by student, topic, and conditioning epoch and remains fixed across TPS stability movement, sessions, High Maintenance, and legitimate Specialist handovers
- the TPS runner owns the prescribed countdown; Specialists cannot edit durations
- Structure Under Timer and Repeated Timed Execution use the same 100% baseline duration; Full Constraint uses the versioned 85% duration
- every timed attempt persists prescribed and actual timing lineage
- assisted TPS attempts and technical-invalid attempts are preserved historically but cannot score; the runner requires a linked replacement rep under the same contract
- missing or invalid Timer Contracts lock scored TPS rather than permitting a Specialist fallback
- the dedicated proof-database timer tables are append-only and RLS-enabled

The approved evidence-correction/supersession workflow remains a cross-cutting evidence-integrity implementation dependency. When that broader workflow is activated, it must replay Timer Contract lineage if a baseline source is superseded; this is not a remaining TPS timer-policy ambiguity.
`,
    "TPS runtime closeout",
  ],
  [
`### TPS final-state next action must not imply cross-topic phase transfer

Raised during Time Pressure Stability review item 43.

The core model is topic-specific: each topic has its own phase and stability, and a new topic gets its own state from its own diagnosis/activation evidence. A topic reaching Time Pressure Stability / High Maintenance does not transfer that phase or stability to a different topic.

Current next-action and parent-copy language still includes phrases such as \`Begin cross-topic conditioning\`, \`Prepare for transfer to new topics\`, and \`expanding transfer across related topics\`. That wording is inconsistent with the topic-specific state model unless a separate cross-topic capability product is deliberately designed later.

Before freeze, synchronize this language so that:

- the mastered topic remains in its own TPS maintenance state
- any newly activated topic gets its own independent state from its own evidence
- no phase or stability is inherited merely because another topic reached TPS High Maintenance

The replacement TPS item 43 tests this topic-specific-state boundary and was approved.
`,
`### TPS final-state next action is topic-specific and synchronized

Resolved and synchronized in the proof branch.

- a topic at Time Pressure Stability / High Maintenance remains in final-phase maintenance for that topic
- Specialist next-action copy no longer instructs cross-topic phase transfer
- parent-facing copy describes maintenance of the same topic rather than transferring its state elsewhere
- any new or different topic still receives its own independently derived phase and stability from its own evidence

The replacement TPS item 43 tests this topic-specific-state boundary and remains approved.
`,
    "TPS final-state closeout",
  ],
]);

console.log("TPS closeout register synchronization applied.");
