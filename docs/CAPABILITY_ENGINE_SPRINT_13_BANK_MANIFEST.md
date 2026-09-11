# Capability Engine Sprint 13 - Private Retrieval and Transfer Bank Manifest

## Scope

Sprint 13 completes the automated proof layer in the approved 16-event Capability Assessment Plan by authoring the two delayed-retrieval banks and three interleaved-transfer banks.

All evaluator content remains outside this public repository. This manifest records only release metadata, fingerprints, and validation outcomes.

## Cumulative assessment contract

- 5 cumulative assessments
- 20 questions issued per attempt
- 96% pass threshold
- binary deterministic scoring in V1, so 20-question forms currently require 20/20 correct
- 80 private items per assessment, double the 40-item release minimum
- 400 cumulative private items total
- 3 attempts per active bank version
- 0-hour retry cooldown at the bank level; delayed sequencing is enforced separately by the Capability Plan
- every covered Deep Dive contributes multiple distinct competency identities
- every canonical critical boundary for every covered Deep Dive exists somewhere in the private pool
- each issued cumulative form still samples one critical boundary per included Deep Dive according to the Sprint 9 selection contract

## Banks

| Assessment | Kind | Deep Dives | Private items | Form size | Pool critical boundaries |
| --- | --- | ---: | ---: | ---: | ---: |
| `transformation_phases_retrieval_v1` | retrieval | 5 | 80 | 20 | 15/15 |
| `session_infrastructure_retrieval_v1` | retrieval | 6 | 80 | 20 | 19/19 |
| `transformation_state_transfer_v1` | transfer | 5 | 80 | 20 | 15/15 |
| `session_operation_transfer_v1` | transfer | 4 | 80 | 20 | 14/14 |
| `continuity_delivery_transfer_v1` | transfer | 4 | 80 | 20 | 12/12 |

## Retrieval design

Delayed retrieval does not copy the immediate mastery prompts.

Offline comparison against the Sprint 12 mastery payload found:

- zero exact mastery prompt reuse
- maximum retrieval-to-mastery prompt similarity: 0.406
- prompts place the operating rule inside a materially different fictional context and require reconstruction after the sequencing delay

## Transfer design

Transfer is label-blind by design.

The private transfer prompts:

- do not name the tested Deep Dive
- do not expose internal competency keys
- describe only the fictional student/session condition and ask the Specialist to identify the governing action
- interleave transformation and operational evidence so the learner cannot rely on the page or phase label to choose the response

Sprint 13 also hardens the shared release validator and private-bank importer so future release-grade transfer banks fail closed when the prompt exposes the formal Deep Dive label or internal competency label.

## Pool breadth hardening

Release validation now requires, for every cumulative bank:

1. at least two distinct competency identities from every covered Deep Dive;
2. every canonical critical boundary for every covered Deep Dive to be represented somewhere in the private item pool;
3. every boundary-tagged item to retain real critical-fail semantics;
4. the normal Sprint 9 one-boundary-per-Deep-Dive issued-form quota to remain feasible inside the competency form quotas.

The whole pool therefore carries the full integrity surface even though one 20-question attempt samples only a controlled subset.

## Adversarial item-bank QA

The first 60-item draft passed structural validation but produced only 196/300 unique prompts. It was rejected rather than accepted as good enough.

After increasing context variation and then increasing the pool to 80 items per bank, the final payload measures:

- 400 items total
- 399 distinct prompts
- correct answer is uniquely longest in 24.5% of items, approximately neutral for four-option questions
- correct-answer length ranks are distributed across all four positions
- no exact option label appears more than 13 times across the 400-item payload
- transfer prompt label-leak audit: PASS

## Retry diversity

A network-independent selector simulation sampled 100 fictional assignment identities across attempts 1-3 for all five banks using the same critical-boundary-first and competency-quota selection rules as the runtime generator.

Results:

- every sampled 20-question form contained critical-boundary coverage for every included Deep Dive
- average pairwise retry overlap: approximately 6.11 of 20 questions
- minimum distinct questions observed across three attempts: 36 of 80

The earlier 60-item draft averaged 9.14/20 overlap, so the stronger 80-item version was retained.

## Private fingerprints

Combined cumulative payload SHA-256:

`461fd65dfd7bcfbad3a68c98f933597cbdf80441927ffdd0db270840bca560d2`

Per-assessment canonical JSON SHA-256:

- `transformation_phases_retrieval_v1`: `249518f7d5df13c7db26829fa882366b8d8ed6cb48dce27ec2b9774fe2764ca5`
- `session_infrastructure_retrieval_v1`: `e6416b4e0e9439ec53b50ca2696dc0b54e64282bf5d47e9cf6d54cd9255158ad`
- `transformation_state_transfer_v1`: `87202be2976d37cc50a0952292b9e94dce9d18d268112208b8c4e1aa8e57ac68`
- `session_operation_transfer_v1`: `5b9f9fce5490f539c5dc62be6e36ae336ebb824254fd33592e61e16235b806de`
- `continuity_delivery_transfer_v1`: `4af87bdc3f66fb0673ca5d23332ccaf3ecfadead30a2199e0a607cc8ac4b594a`

## Complete automated MVP package

Sprint 12 mastery and Sprint 13 cumulative banks were combined offline into one private import package.

Combined package:

- 16 assessments
- 895 private items
- 11 mastery assessments
- 2 delayed-retrieval assessments
- 3 interleaved-transfer assessments
- 11/11 Deep Dives
- 33/33 required automated capability evidence cells

Combined private MVP package SHA-256:

`8ef60b71fe42112eeb91b09051e2ccf96a4cddd5dd10e62d77e6577ea73b5a52`

Source payload fingerprints:

- mastery: `59a91cd16fc5723ccc258e17cc314afa558d5b10ae56db2bd00724c8ac751d1c`
- cumulative: `461fd65dfd7bcfbad3a68c98f933597cbdf80441927ffdd0db270840bca560d2`

## Explicitly not done

- no private evaluator payload committed to GitHub
- no Supabase import
- no migration applied
- no production write
- no production deployment
- no merge to `main`

The complete private package is ready for controlled import only after an explicitly approved database target exists.