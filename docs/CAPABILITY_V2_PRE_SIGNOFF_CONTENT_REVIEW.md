# Capability V2 Pre-Signoff Content Review

## Status

- Review date: `2026-09-15`
- Branch: `proof/capability-engine-shadow-validation`
- Baseline package: complete 16-bank V2 candidate preserved unchanged
- Baseline decision: structurally valid, editorially blocked
- Private remediation candidate: V2R7
- V2R7 automated pre-signoff status: **passed current structural and editorial validator**
- Human doctrine sign-off: **not granted yet**
- Human review packets: **generated privately using blind-review / separate-key workflow**
- Proof import: not authorised
- Production: untouched

The original 16-bank, 895-item package remains preserved as the rejected pre-signoff baseline. Its hashes continue to identify that exact package and must not be reused for revised content.

A separate private V2R7 candidate has completed automated remediation and validation. This does not replace the required item-by-item human doctrine review.

## Original blockers

### 1. Cumulative Retrieval and Transfer banks were mechanically derived

The original five cumulative banks were produced by selecting items from mastery pools and applying fixed Retrieval or Transfer wrappers. This could satisfy structural coverage without establishing genuine delayed Retrieval or Transfer evidence.

### 2. Reused scenario pattern existed in eight mastery banks

Eight mastery banks reused the same underlying scenario for multiple predictable questions. The content was structurally valid but too repetitive for a private assessment pool.

### 3. Transfer-label blindness introduced language corruption

Global label replacement avoided direct Deep Dive leakage but introduced unnatural grammar and sometimes weakened the distinction the scenario was supposed to test.

### 4. Answer-style and evaluator cues remained detectable

Some distractors contained explanatory commentary or repeated linguistic patterns that made wrong answers distinguishable by style rather than doctrine.

## V2R7 remediation completed privately

The revised private candidate preserves the same 16-bank / 895-item release shape while replacing the rejected content patterns.

- 11 mastery banks: 495 items
- 2 delayed Retrieval banks: 160 items
- 3 interleaved Transfer banks: 240 items
- total: 16 banks / 895 items
- required evidence cells: 33/33
- unique item keys: 895/895
- unique normalized prompts: 895/895

### Mastery remediation

The duplicated scenario half in the eight affected mastery banks was rewritten into independent situations while preserving item identity, competency mapping, answer-key intent and critical-boundary mapping during the remediation process.

### Retrieval remediation

Both cumulative Retrieval banks were rewritten as retrieval-specific cases rather than mastery questions with a spacing wrapper. Their private pools now use broader canonical competency coverage per Deep Dive while retaining the planned Deep Dive coverage and form size.

### Transfer remediation

All three Transfer banks were rewritten as genuinely paired operating-condition cases. Formal Deep Dive labels and competency labels are not exposed in the prompts, while the scenarios still require the Specialist to preserve the relevant boundary across linked conditions.

### Editorial remediation

Explicit evaluator commentary was removed from answer choices. Repeated answer-style cues were normalised, transfer grammar defects were repaired, and answer-length / answer-position patterns were rebalanced.

## Automated pre-signoff validation

V2R7 passed the current private automated gate across all 16 banks.

- 4,800 deterministic forms validated: 100 fictional identities x 3 attempts x 16 banks
- minimum distinct retry forms per identity: 3
- every sampled form satisfied its required critical-boundary coverage
- cumulative retry overlap returned to the intended diversity range
- all four answer positions are used in every bank
- longest-correct-answer rate is at or below 35% across the revised package
- transfer formal-label leakage: 0
- explicit evaluator-cue options under the current validator: 0
- style-cue items under the current validator: 0

These checks validate structure, coverage, determinism and the failure modes encoded in the current validator. They do **not** establish doctrinal correctness or prove that no human-detectable test-taking cues remain.

## Adversarial pre-human review

A broader pre-human cue audit was run after the automated gate. It found residual lexical correlations that the current validator does not model. In particular, some words and permission/absolute constructions occur disproportionately in distractors. This is not proof that the keyed answers are doctrinally wrong, but it is a real assessment-quality risk that human reviewers must test rather than ignore.

The same audit also found repeated generic rule-definition stems in the mastery family. Those items may still be doctrinally valid, but reviewers must decide whether they test operating judgment strongly enough or remain too easy / too templated for a private capability bank.

This additional audit does not change the immutable V2R7 package. It changes the review standard applied to it.

## Human review method

Private review packets have been generated for all 16 banks using a blind-review workflow:

1. the reviewer answers every item without opening the candidate key;
2. the reviewer marks confidence and flags ambiguity, doctrine disputes, or copy issues;
3. only after the bank is complete does an adjudicator open the separate key and reconcile mismatches;
4. a reviewer/key mismatch is resolved against the current Deep Dive and live RI operating source of truth, not by automatically treating the reviewer as wrong.

This prevents the human gate from becoming a confirmation exercise.

## Current release decision

**V2R7 may proceed through blind human doctrine review. It may not yet be frozen, imported, activated or used as real Specialist evidence.**

The review must judge doctrinal correctness, unique answer defensibility, ambiguity, realistic operating judgment, and residual test-taking cues. Genuine doctrine disputes should be escalated to the methodology owner rather than silently resolved by editing the assessment to fit reviewer preference.

Only after all required human review is resolved may the candidate receive final frozen hashes and proceed through one atomic inactive import into Nenterprises RI Proof, persisted-source verification and separately approved activation.

## Boundary

The Capability Engine architecture remains valid. This content review does not reopen the engine design, readiness rules, practical-proof gates, authorization model or Proof infrastructure. Main and Production remain outside the remediation and review process.
