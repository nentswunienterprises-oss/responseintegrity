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

## Adversarial test-taking audit

The first structurally valid draft was rejected during content QA because correct options were disproportionately the longest response and one generic distractor repeated hundreds of times. That would have created a test-taking shortcut unrelated to RI capability.

The private payload was regenerated and re-audited.

Current result:

- 495 items total
- 443 distinct prompts
- correct option is uniquely longest in 24.4% of items, approximately neutral for four-option questions
- correct option appears across all four answer-length ranks rather than consistently occupying one linguistic pattern
- no exact option label appears more than 11 times across the full 495-item payload
- per-attempt option presentation is independently shuffled by the server-side deterministic form generator

This is an authoring integrity requirement: Specialists should need to understand the operating rule, not reverse-engineer writing style.

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

`59a91cd16fc5723ccc258e17cc314afa558d5b10ae56db2bd00724c8ac751d1c`

Per-assessment canonical JSON SHA-256:

- `clarity_mastery_v1`: `8f3d6b5a0f9dc4449a0d3ce454f2d0561be159fb7144865cb3d64c96c740f37f`
- `structured_execution_mastery_v1`: `32c699df28755ee27d49734dd5e3e8fecc34178f0809fe2a32e3582a089aab13`
- `controlled_discomfort_mastery_v1`: `f247858a15a30fbe90ea2fdaa041ed7ce694aff648df1fc58aa016694ab817ad`
- `time_pressure_stability_mastery_v1`: `b754db684ce953699a99d2c08ffddaa6ce518136880e0860f9b19c0c86e371bf`
- `topic_conditioning_mastery_v1`: `ba43808213f872789c854f34c27106fd1cc137e187658210d4ebbca47baf0a30`
- `intro_session_structure_mastery_v1`: `760afd555278b0cd2c9b5a974b2d170d8a7fa6c53b3e60686ee0555f494ebc18`
- `logging_system_mastery_v1`: `d28e38af5aa81f76a8a0eb6aad085aa95d58dbe4a91d549890c6b3a34a2acee5`
- `session_flow_control_mastery_v1`: `5a0c9cab872d613d40109a96b1fd1730ef772dfdb296a583db9e69f7c5e03386`
- `drill_library_mastery_v1`: `218e5921e90d2516a9f73ca393b111df9379ffbf327d95d53db30e1da26d2614`
- `handover_verification_mastery_v1`: `3142107faeca71f83c7a5790207c6c12d291033d4be2f90b93a2e8402aff3db5`
- `tools_required_mastery_v1`: `2f47e0b67e549f5153d9997cd7ef88e34427426281dac94f89b3b7acb0ef4b44`

## Validator hardening added in Sprint 12

Release-grade mastery validation now fails closed when the assessment competency blueprint omits any competency declared by the canonical Deep Dive blueprint.

This is important because a 15-question form could otherwise satisfy its own self-declared blueprint while silently ignoring part of the actual RI capability definition.

The Capability Engine CI command also now executes the private-bank leakage boundary tests, so private assessment or simulation JSON cannot be silently committed to the public repository without failing the feature-branch gate once the Actions runner is available.

## Validation status

Offline private payload validation: PASS.

Validated without opening a database connection:

- 11/11 planned mastery assessment keys
- `mastery` evidence kind for every bank
- 15-slot form contract for every bank
- 96% threshold for every bank
- 45 items per bank, above the 30-item minimum
- every declared Deep Dive competency present
- every critical boundary represented by multiple critical-fail-capable candidates where the form quota permits selection
- no critical/correct option overlap
- critical-boundary reservation is feasible inside each competency quota
- no duplicate item identities
- all correct/critical option references resolve to actual options
- sampled retry generation preserves all required critical boundaries

## Explicitly not done

- no private bank payload committed to GitHub
- no Supabase import
- no migration applied
- no production write
- no production deployment
- no merge to `main`

The private payload can be imported only through the controlled private-bank importer after a database target is explicitly approved.