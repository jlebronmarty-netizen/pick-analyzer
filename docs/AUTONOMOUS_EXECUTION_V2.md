# Autonomous Execution V2

Status: Phase 0 locally implemented.

This document governs the Historical Sports Data Foundation V2 and Prediction Epoch Reset V2 autonomous run. It is intentionally local-first: this run may create commits, docs, services, API routes, fixtures and additive migration files, but it must not push, deploy, apply production SQL, delete prediction history, activate a new production epoch, enable new cron jobs, execute historical odds or mutate production data.

## Resume Procedure

1. Confirm repository and branch:
   - `cd C:\Projects\pick-analyzer`
   - `git status --short`
   - `git rev-parse HEAD`
2. Read the machine ledger:
   - `docs/autonomous-execution-v2.json`
3. Continue at the first phase whose `status` is not `completed`.
4. Before committing a phase, run:
   - focused validation for the phase
   - `npm.cmd run build`
   - `git diff --check`
5. Commit one phase at a time using:
   - `phase(data-foundation-v2): <phase description>`
6. Update the ledger in the next phase with completed phase evidence when a self-referential commit hash cannot be known at commit creation time.

## Phase Record Contract

Each ledger entry tracks:

- `phaseId`
- `phaseName`
- `status`
- `startedAt`
- `completedAt`
- `commit`
- `build`
- `validation`
- `providerCalls`
- `remoteMutations`
- `localMutations`
- `migrationsCreated`
- `blockers`
- `continuationDecision`

## Safety Gates

- Provider calls default to 0. Any live provider call must be explicitly bounded, justified and recorded.
- Production mutations are forbidden for this autonomous run.
- Additive migration files may be created, but production SQL must not be applied.
- Historical odds are forbidden unless a later owner approval explicitly authorizes a bounded call plan.
- Prediction history must remain auditable. Legacy rows may be classified or isolated by contract, never deleted or mass rewritten.
- New epoch activation must remain migration-ready/runbook-ready until manual approval and required SQL are applied.

## Commit Hash Ledger Note

A commit cannot include its own final hash inside a tracked file without changing that hash. For that reason, the phase being committed may use `pending_self_reference` in `docs/autonomous-execution-v2.json`. The next phase ledger update, and the final response, must record the exact committed hash.

## Certification

Phase 0 certification marker:

`AUTONOMOUS_GOVERNANCE_V2_PASS`
