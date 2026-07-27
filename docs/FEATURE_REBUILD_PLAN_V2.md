# Feature Rebuild Plan V2

Status: Locally implemented as a plan-only and dry-run-ready contract.

`GET /api/data-foundation/feature-rebuild` exposes sport-aware, season-aware feature rebuild planning without rebuilding production features or mutating `historical_feature_snapshots`.

## Contract

The plan requires:

- sport-aware execution
- season-aware windows
- as-of-time safety
- no future information
- checkpointed batches
- resumability
- deterministic idempotency keys
- feature-definition versions
- data-source versions
- validation after each batch

## Local Fixture Certification

Local validation uses an in-memory MLB fixture:

- source timestamps are at or before `asOfTime`
- `asOfTime` is before or equal to prediction cutoff
- deterministic key is stable
- write executed: false

Local validation on 2026-07-27:

- validation checks: 8/8 passed
- sports planned: 8
- execution mode: `PLAN_ONLY`
- production execution allowed: false
- fixture write executed: false
- sports with existing feature snapshots observed locally: 0
- provider calls: 0
- remote mutations: 0

## Safety

- Provider calls: 0
- Remote mutations: 0
- Production feature rebuilds: 0
- Historical feature snapshot writes: 0
- Production execution allowed: false

## Certification

Certification markers:

`FEATURE_REBUILD_PLAN_V2_PASS`

`FEATURE_AS_OF_SAFETY_PASS`

`FEATURE_REBUILD_IDEMPOTENCY_PASS`
