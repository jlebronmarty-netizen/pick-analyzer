# Sync Reliability Framework V1

Sync Reliability Framework V1 adds reusable primitives for safer provider and persistence workflows.

## Scope

- bounded concurrency
- retry with exponential backoff
- jitter
- timeout handling
- retryable status classification, including 429
- circuit breaker state transitions
- partial-success reporting
- per-record error isolation
- resumable cursor contracts
- idempotency key generation

## Files

- `src/services/sync-reliability.service.ts`
- `src/app/api/sync/reliability/route.ts`
- `src/components/dashboard/SyncReliabilityPanel.tsx`

## API

`GET /api/sync/reliability`

Returns a local deterministic self-test and framework status. It makes zero provider calls.

## Provider Boundary

This module does not call external providers and is not wired into bulk sync execution yet.

Existing sync services should adopt the primitives incrementally when touched, starting with small provider-backed modules where retries, timeout and per-record isolation reduce real operational risk.

## Deterministic Validation

The status API runs a deterministic local self-test:

- one record succeeds
- one record fails
- failure is isolated
- partial-success counts are returned
- retry delays are computed without jitter for sample display
- sample circuit breaker transitions to `open`

## Future Work

- Adopt in NBA reconciliation Phase B after provider quota approval.
- Wrap provider fetches with timeout and retry policy.
- Persist circuit breaker state if cross-request memory becomes required.
- Add provider-specific retry policies.
- Emit observability events when a future operational events table exists.
