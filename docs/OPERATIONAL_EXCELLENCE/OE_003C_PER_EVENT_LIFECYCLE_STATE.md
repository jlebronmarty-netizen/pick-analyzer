# OE-003C Per-Event Lifecycle State

Status: production-certified.

OE-003C adds a deterministic, read-only per-event lifecycle contract for operations visibility. It is observability only. It does not start event-level provider refresh, increase cadence, change scheduler cron, generate predictions, settle rows, import results, create learning labels or alter recommendation policy.

## Contract

Canonical route: `/api/operations/event-lifecycle`

Default scope:

- `sportKey=baseball_mlb`
- current Puerto Rico operating date
- `limit=50`, bounded to a hard maximum of 200
- stored repository/database evidence only

The API returns event timing, lifecycle state, priority band, latest stored odds evidence, market freshness, prediction counts, recommendation relevance tags, result state, settlement state, learning/performance eligibility, provider source, dry-run budget authorization, next observational action, blockers, warnings and evidence timestamps.

## Lifecycle States

OE-003C defines explicit entry and exit rules for:

`DISCOVERED`, `PREVIEW`, `MARKET_OPEN`, `ACTIVE_REFRESH`, `HIGH_PRIORITY`, `LOCK_WINDOW`, `STARTED`, `LIVE`, `FINAL`, `RESULT_IMPORT`, `SETTLEMENT`, `LEARNING`, `PERFORMANCE`, `ARCHIVED`, `POSTPONED`, `CANCELLED`, `SUSPENDED`, `ABANDONED`, `UNKNOWN`.

Closure work outranks market refresh. A terminal event missing canonical `game_results` evidence becomes `RESULT_IMPORT`. A result-backed event with unsettled prediction rows becomes `SETTLEMENT` and `P0`.

`FINAL` is never inferred from elapsed time alone. MLB uses the existing `resolveMlbGameLifecycle` service, which preserves stale post-start rows as status-unconfirmed until fresh provider/canonical status or result evidence exists.

## Priority Bands

- `P0`: closure or recovery, including missing canonical results, settlement-ready rows, suspended/abandoned states and learning closure.
- `P1`: actionable lock-window or high-relevance pregame events.
- `P2`: pregame inside two hours without higher product relevance.
- `P3`: active same-day market monitoring.
- `P4`: future or informational event.
- `P5`: archived, terminal exception or no operational work.
- `UNKNOWN`: insufficient or contradictory evidence.

## Recommendation Relevance

Recommendation relevance is classification-only. Tags are derived from existing prediction rows and do not promote informational candidates or change selection:

`OFFICIAL_PICK`, `RENT_PLAY_CANDIDATE`, `MONEYLINE_CANDIDATE`, `SMART_PARLAY_DEPENDENCY`, `STRONG_LEAN`, `BEST_VALUE`, `MOST_LIKELY`, `INFORMATIONAL`, `NONE`, `UNKNOWN`.

## Persistence Decision

OE-003C uses dynamic derivation only.

No migration was added. Snapshot persistence is deferred until OE-003D or a later transition-audit package proves that audit history, recovery replay or scheduler determinism requires durable transition rows. This avoids creating a second event-status source of truth.

## Safety

- Provider calls introduced: 0.
- Provider credits consumed: 0.
- Database mutations: 0.
- Prediction writes: 0.
- Result writes: 0.
- Settlement writes: 0.
- Learning writes: 0.
- Scheduler cadence changed: false.
- Refresh cadence changed: false.
- Official Pick policy changed: false.
- Probability/model output changed: false.

## Multi-Sport Compatibility

The contract accepts any configured `sportKey`. MLB receives sport-specific lifecycle normalization through the existing MLB lifecycle adapter. Other sports use conservative generic status normalization and return honest empty or unknown evidence when current event data is unavailable.

OE-003D was not started.

## Production Certification

Production served commit `d7a1077eb5fc4c4dca00082a188c5908fe0aecae` and `/api/operations/event-lifecycle?sportKey=baseball_mlb` returned HTTP 200 with 15 current-day MLB events. Observed states were `HIGH_PRIORITY` 7 and `ACTIVE_REFRESH` 8; observed priorities were `P1` 7 and `P3` 8. Lifecycle reads reported provider calls 0, provider credits 0, database mutations 0 and no prediction/result/settlement/learning writes.
