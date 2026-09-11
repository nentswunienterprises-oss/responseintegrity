# Capability Engine Sprint 12 - Private Mastery Bank Manifest

## Scope

Sprint 12 authors the first release-grade private automated mastery banks for the 11 implemented Response Integrity Deep Dives.

The evaluator payload is deliberately not committed to this public repository. This document records only non-secret release metadata, source grounding, fingerprints, and validation outcomes.

## Authority

These banks produce `mastery` evidence only. They do not replace practical evidence, Oral Defense, Sandbox rehearsal, the human Sandbox Mock Readiness Gate, Trial, or certification.

## Assessment contract

- 11 mastery assessments
- 15 questions issued per assessment attempt
- 96% pass threshold
- binary deterministic scoring in the current engine
- therefore a 15-question V1 mastery form currently requires 15/15 correct unless scoring semantics change later
- 45 private items per Deep Dive, exceeding the 30-item release minimum
- 495 private items total
- 3 attempts per active bank version
- 0-hour retry cooldown in V1
- all evaluator keys, correct options, critical-fail mappings, and explanations remain private

## Capability coverage

| Assessment | Private items | Form slots | Competencies | Critical boundaries |
| --- | ---: | ---: | ---: | ---: |
| `clarity_mastery_v1` | 45 | 15 | 15/15 | 3/3 |
| `structured_execution_mastery_v1` | 45 | 15 | 13/13 | 3/3 |
| `controlled_discomfort_mastery_v1` | 45 | 15 | 10/10 | 4/4 |
| `time_pressure_stability_mastery_v1` | 45 | 15 | 8/8 | 3/3 |
| `topic_conditioning_mastery_v1` | 45 | 15 | 8/8 | 2/2 |
| `intro_session_structure_mastery_v1` | 45 | 15 | 8/8 | 3/3 |
| `logging_system_mastery_v1` | 45 | 15 | 9/9 | 5/5 |
| `session_flow_control_mastery_v1` | 45 | 15 | 7/7 | 2/2 |
| `drill_library_mastery_v1` | 45 | 15 | 8/8 | 4/4 |
| `handover_verification_mastery_v1` | 45 | 15 | 7/7 | 3/3 |
| `tools_required_mastery_v1` | 45 | 15 | 7/7 | 2/2 |

Total canonical critical-boundary coverage across mastery banks: 34/34.

## Retry diversity check

A network-independent selector simulation sampled 100 fictional assignment identities across attempts 1-3 for every mastery bank using the same critical-boundary-first and competency-quota selection rules as the runtime generator.

Results:

- every sampled form contained all critical boundaries required for its Deep Dive
- average pairwise question overlap across retries: approximately 5.63 of 15
- minimum distinct questions observed across three attempts in the sample: 24 of 45
- each active bank version therefore retains meaningful retry variation while preserving the same capability surface

## Source grounding

The private item authoring is grounded in the implemented RI Battle Test source and the canonical Capability Engine blueprint.

Battle Test source blobs used as doctrine references:

- Clarity: `d55fc5388a9cc147254b35f7e8d8edcc8f65ace1`
- Structured Execution: `f42bc0456b05c36253d3ddc075bfcd4010019be5`
- Controlled Discomfort: `92bb5796836efc87c9d933c725bdb9b655d64b9c`
- Time Pressure Stability: `2c059cd2929b11d2490f788ee6129bb33ddde05b`
- Topic Conditioning: `69e0e265022b7c41f6d18c224dfa06ea223ceddc`
- Intro Session Structure: `a10a45007680c656f1ea57435662dac8ae78d486`
- Logging System: `5aa655307a9cf8844b16242cbe1757d7e4c13e67`
- Session Flow Control: `a14953875df080bdd51f39d06c65c37b33f3045b`
- Drill Library: `dfbace3033f1adb4685e79f9b205240f1ee7d215`
- Handover Verification: `48d05af541b120cae3b3d5ea1d17cd6f9146c271`
- Tools Required: `3d2946cd5e6872b45e77a93058f4a4f09e89f2a0`

The authoring deliberately converts these operating truths into new deterministic scenario/judgment items rather than exposing or mechanically copying the existing Battle Test answer bank.

## Private payload fingerprints

Combined private payload SHA-256:

`b04ab608c5f7dd6d89920e5d1f654704e125bda9d4c8bda40f693a7fd8b1f3c9`

Per-assessment canonical JSON SHA-256:

- `clarity_mastery_v1`: `63f260b70810e61746ae4b9ccf4292de8ae420936b99260195ba212ba429f76f`
- `structured_execution_mastery_v1`: `6f4de627aa4598743d97c99985c3b265d903f992a2631bae782ac2be3c0d9587`
- `controlled_discomfort_mastery_v1`: `f6a25360be137805f713b56249ddc14ff54556bdbb76bfbbf8d5d305c76814a1`
- `time_pressure_stability_mastery_v1`: `3a9e26f846b4faecc4886a2a52cf1b108e24ce2f74f558a7aa0d2e9790e0a6d5`
- `topic_conditioning_mastery_v1`: `a8579b42b475333c37dbf5bdd77bdf9383849a0e5584c03fc55299244f5dbd79`
- `intro_session_structure_mastery_v1`: `1f5786bc0b68816a0144e30b92fd84684fb45abe62bc2b7db62ba9f7db62b2c9`
- `logging_system_mastery_v1`: `9ffce9c94164693cb08b49444629244809d407f3ee8e9f9716cd6d6f293b41be`
- `session_flow_control_mastery_v1`: `484af1259466828c19ed4982a0b9d44080f4e8548b6e5c9a0f754c11c01af574`
- `drill_library_mastery_v1`: `5c8896cc622c813320ba659fee91351a8fae97386166b97692523714e752aede`
- `handover_verification_mastery_v1`: `bcedf2d2ac470980a26667ad9aa6736c69c53db54a89b16c347c39289741d6d6`
- `tools_required_mastery_v1`: `e1b71455e586d22f6e7f4c8f9499f496a023a731aafaedc2fc2f12631cc67fe2`

## Validator hardening added in Sprint 12

Release-grade mastery validation now fails closed when the assessment competency blueprint omits any competency declared by the canonical Deep Dive blueprint.

This is important because a 15-question form could otherwise satisfy its own self-declared blueprint while silently ignoring part of the actual RI capability definition.

## Validation status

Offline private payload validation: PASS.

Validated without opening a database connection:

- 11/11 planned mastery assessment keys
- `mastery` evidence kind for every bank
- 15-slot form contract for every bank
- 96% threshold for every bank
- 45 items per bank, above the 30-item minimum
- every declared Deep Dive competency present
- every critical boundary represented by critical-fail-capable items
- no critical/correct option overlap
- critical-boundary reservation is feasible inside each competency quota
- no duplicate item identities
- all correct/critical option references resolve to actual options

## Explicitly not done

- no private bank payload committed to GitHub
- no Supabase import
- no migration applied
- no production write
- no production deployment
- no merge to `main`

The private payload can be imported only through the controlled private-bank importer after a database target is explicitly approved.