# Capability V2 Pre-Signoff Content Review

## Status

- Review date: `2026-09-14`
- Branch: `proof/capability-engine-shadow-validation`
- Package under review: complete 16-bank V2 candidate
- Structural package status: passed automated package gates
- Editorial / construct status: **blocked pending revision**
- Human doctrine sign-off: not granted
- Proof import: not authorised
- Production: untouched

The 16-bank, 895-item package remains an important preserved candidate baseline. Its structural validation is real, but structural validation does not establish that the questions are release-grade assessment content.

## Confirmed blockers

### 1. Cumulative Retrieval and Transfer banks are mechanically derived

The five cumulative banks were produced by selecting items from the mastery pools and applying fixed Retrieval or Transfer wrappers to the existing prompt and options.

The authoring script also remaps cumulative competency coverage to only `system.authority` and `evidence.condition_integrity` within each covered Deep Dive.

This is sufficient to satisfy structural coverage rules, but it does not by itself establish the intended cumulative constructs:

- delayed Retrieval must require the Specialist to recover operating rules after spacing rather than recognise a mastery item with retrieval language added;
- Transfer must require the Specialist to identify and preserve the correct capability across genuinely interleaved subsystem conditions rather than answer a mastery item with a generic downstream wrapper added.

The cumulative family therefore requires authored scenarios designed for its own evidence purpose.

### 2. Reused scenario pattern remains in eight mastery banks

The following mastery banks contain 45 items built from 15 rule-definition prompts plus 15 underlying scenarios that are each reused for both an action question and a why-it-matters question:

- Controlled Discomfort
- Time Pressure Stability
- Intro Session Structure
- Logging System
- Session Flow Control
- Drill Library
- Handover Verification
- Tools Required

That pattern is structurally valid but editorially too repetitive for release. The same underlying scenario should not provide multiple predictable questions merely to fill the private pool.

Clarity, Structured Execution and Topic Conditioning do not show this same repeated-scenario pattern in the current candidate and should proceed to normal item-level doctrine review rather than automatic rewrite.

### 3. Transfer-label blindness introduced language corruption

Replacing formal Deep Dive names with a generic surface label successfully avoids direct label leakage, but the current mechanical replacement also damages grammar and, in some cases, removes distinctions required to understand the scenario.

Transfer blindness must be achieved through naturally authored blind scenarios, not global string substitution.

## Release decision

**Do not freeze or import the current 895-item candidate.**

The existing package hashes remain the immutable identity of this structurally complete but editorially blocked candidate. Any revised assessment content must receive new source and canonical hashes. The current hashes must not be reused for rewritten content.

## Required remediation

1. Preserve the current package and QA ledgers unchanged as the rejected pre-signoff baseline.
2. Rewrite the five cumulative banks from their assessment-plan purposes and Deep Dive blueprints rather than from wrapper transformations of mastery items.
3. Rewrite the repeated scenario pairs in the eight affected mastery banks so each private-pool item is an independent assessment situation.
4. Preserve competency allocations, critical-boundary requirements, form sizes, retry diversity and answer-key integrity while revising content.
5. Run the full structural and adversarial editorial validator over the revised 16-bank package.
6. Perform delegated item-by-item human doctrine review; escalate only genuine doctrine disputes to the methodology owner.
7. Freeze new hashes only after human sign-off.
8. Import the approved package atomically and inactive into RI Proof, verify persisted content against the frozen artifact, and activate separately.

## Boundary

The Capability Engine architecture remains valid. This review rejects content quality in the candidate package; it does not reopen the engine design, readiness rules, practical-proof gates, authorization model, or Proof infrastructure.
