# Capability Engine Sprint 7 - Shadow Proof

Status: proof sprint only. Stacked on `feat/capability-engine-sprint-6`.

The purpose of this sprint is to prove the existing Capability Engine before adding more feature volume. It does not merge to `main`, apply the Capability Engine migration to production, deploy a production Capability Engine, or alter the current Battle Test / Sandbox Mock Gate authority.

## What changed to make the engine provable

Three production decision boundaries were extracted into dependency-free or database-free cores and the live services now call those same cores:

1. `shared/capabilityEvidenceSelection.ts`
   - selects latest assessment evidence by assessment key
   - requires the latest assessment attempt to pass on the currently active private bank version
   - selects latest practical evidence by proof key
   - requires the latest practical to be approved on the current proof version
   - requires the latest Oral Integrity Defense to be approved on the current defense version

2. `server/capabilityOralDefenseCore.ts`
   - converts stored question/practical evidence into oral-defense risk signals
   - prioritises integrity escalations, critical-boundary misses, practical repeat decisions, then ordinary incorrect responses
   - retains the three integrity baseline probes
   - adds at most two non-baseline evidence-risk probes
   - creates the evidence fingerprint and deterministic `briefId`

3. `server/capabilityPublicProjection.ts`
   - produces the Specialist-facing digital assessment form
   - produces the Specialist-facing submitted result
   - excludes scoring keys, critical-fail option keys, competency labels, explanations, question-level results and answer lineage

Reviewer scope was also extracted to `shared/capabilityReviewerScope.ts`. The live readiness service uses that shared rule for TD pod access.

## End-to-end proof harness

`server/capabilityShadowJourney.test.ts` exercises the complete shadow journey using the real test/design assessment fixtures and the same pure decision cores used by the server.

The seeded path is intentionally not a perfect happy path:

1. Start with no capability evidence -> `NOT_READY`, 8 requirements missing.
2. Specialist fails the first Clarity mastery attempt.
3. Specialist later passes Clarity mastery.
4. Specialist passes delayed Clarity retrieval.
5. Specialist passes Structured Execution mastery.
6. Specialist passes the interleaved Clarity / Structured Execution transfer assessment.
7. Public assessment projections are checked for answer-key / competency / explanation leakage.
8. Readiness remains `NOT_READY` with the three practical approvals and oral defense still missing.
9. Prepare, Execute and Evidence practicals are approved on their current versions.
10. Readiness remains `NOT_READY` with only `oral_defense.approved` missing.
11. Oral targeting reads the historical failed Clarity attempt and adds that competency as an evidence-risk probe even though the latest Clarity attempt passed.
12. The generated oral brief remains bounded to 3-5 probes.
13. All issued oral probes are recorded Clear with no integrity concern -> oral outcome `approved`.
14. Current evidence is reselected -> final shadow readiness becomes `READY` with zero missing requirements.
15. The harness confirms the gate remains `authoritative: false` and does not touch the seeded authoritative Battle Test / Sandbox / Trial / certification / operational-mode snapshot.
16. TD pod-scope rule accepts the assigned TD and rejects another TD.

A second proof case independently checks that each of these breaks readiness or brief validity:

- a newer failed digital attempt after an older pass
- an active assessment bank-version rotation after a pass on the retired bank
- a newer `repeat_required` practical after an older approval
- an evidence-state change after an oral brief is issued

## Executed proof in this session

A network-independent smoke run was executed against mirrored copies of the newly extracted production decision cores because this runtime cannot resolve `github.com` for a branch checkout.

The emitted JavaScript completed successfully with this result:

```json
{
  "ok": true,
  "probes": 4,
  "ready": true,
  "staleBriefInvalidated": true,
  "tdCrossPodBlocked": true,
  "latestFailureInvalidates": true
}
```

This is genuine executable evidence for the extracted readiness selector, oral targeting / brief identity, Oral Defense evaluator and reviewer-scope rule. It is not represented as a full repository build or a full execution of every Sprint 7 test file.

## Full branch execution status

Full branch checkout in this runtime remains blocked because DNS cannot resolve `github.com`. No second clone retry is being used as a substitute for proof.

GitHub Actions is also still blocked before test execution. The latest `Capability Engine CI` run triggered by the Sprint 7 workflow update completed as failure, but its only job contains zero executed steps. This is the same runner-allocation failure observed in previous Capability Engine sprints, not a reported test assertion or TypeScript failure.

Therefore the current verification statement is:

- extracted production decision cores: **EXECUTED - PASS**
- Sprint 7 end-to-end test harness: **IMPLEMENTED - NOT EXECUTED IN THIS RUNTIME**
- source/boundary review: **IMPLEMENTED AND UPDATED FOR THE REFACTOR**
- GitHub Actions: **BLOCKED BEFORE EXECUTION**
- full repository TypeScript/build proof: **NOT YET ESTABLISHED**
- production/staging database proof: **NOT RUN**

## Test coverage added in Sprint 7

- `shared/capabilityEvidenceSelection.test.ts`
- `shared/capabilityReviewerScope.test.ts`
- `server/capabilityOralDefenseCore.test.ts`
- `server/capabilityPublicProjection.test.ts`
- `server/capabilityShadowJourney.test.ts`
- existing Capability Engine boundary tests updated to follow the extracted production cores
- Capability Engine CI workflow expanded to include all Sprint 7 proof files

## What Sprint 7 does not prove yet

The current proof deliberately does not claim database/runtime integration success. Before this engine can become authoritative, RI still needs an isolated staging execution with:

- the migration applied to a non-production database
- a private assessment bank seeded outside the public repository
- a seeded Specialist, pod and TD relationship
- real HTTP calls through the registered routes
- practical submission/review persistence
- oral brief issuance and stale-brief rejection against persisted evidence
- final shadow readiness checked from persisted records
- confirmation that existing Battle Test, Sandbox Mock Gate, Trial and certification records remain unchanged

That staging execution should be the next proof boundary. It should not be replaced by more feature development.

## Review boundary

Review Sprint 7 against `feat/capability-engine-sprint-6`, not against `main`.

Ref: #15.
