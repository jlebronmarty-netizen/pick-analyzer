# OE-003E Canonical Acquisition And Bounded Active Execution

Status: implemented pending production certification.

OE-003E activates the OE-003D planner boundary for one controlled path: SportsDataIO MLB current operating-day pregame market refresh. It preserves per-event planning while executing with provider-efficient date-level batching.

## Scope

- Provider: SportsDataIO.
- Sport: `baseball_mlb`.
- Action: `odds_refresh`.
- Request granularity: `DATE`, using `GameOddsByDate/{operatingDate}`.
- Execution owner: protected `/api/cron/operating-day?dryRun=false` through `runAdaptiveRefresh`.
- Canonical persistence: `sports_odds_snapshots`.
- Evidence ledger: `sports_sync_jobs` with `canonical_acquisition_execution_v1`.

The Odds API remains shadow-only because current balance/reset/cost evidence is not certified for active refresh. BSN remains observational.

## Contract

The canonical acquisition contract records:

- acquisition id, deduplication key and idempotency key;
- provider, sport, operating date, action and execution mode;
- planned, eligible and excluded event counts;
- estimated calls and quota units before execution;
- actual calls and quota units after execution;
- budget authorization and reserve impact;
- provider response observed time;
- canonical market snapshot timestamp;
- inserted, updated, skipped and unchanged row counts;
- freshness before/after;
- status, reason codes, warnings and errors.

Estimated cost is never labeled as actual cost. Unknown values remain `null` or `UNKNOWN`.

## Deduplication

OE-003E uses a deterministic key:

`sportsdataio:baseball_mlb:odds_refresh:{operatingDate}:date:{boundedWindow}:current_pregame`

The bounded window is derived from the selected event cadence. This blocks duplicate scheduler ticks within the same protected acquisition window while allowing a later legitimate refresh.

## Active Guards

Active execution is allowed only when:

- the planner mode is `ACTIVE`;
- provider is SportsDataIO;
- sport is `baseball_mlb`;
- action is `REFRESH_MARKET`;
- events are current operating-day scheduled pregame events;
- P0 closure work is absent;
- provider budget approves one request;
- reserve remains protected;
- max/action and max/hour are respected by `provider-budget.service.ts`;
- no matching deduplication key is running or recently completed;
- `SPORTSDATAIO_MLB_API_KEY` is configured;
- execution occurs through the protected scheduler bridge.

Any failed guard returns an explicit blocker.

## Persistence

The active service normalizes SportsDataIO MLB odds with the existing `normalizeSportsDataIoMlbGameOdds` contract and upserts to `sports_odds_snapshots` on `id`.

Provider market time is stored as `snapshot_time` and `providerTimestamp`. Fetch time is stored separately as `fetchObservedAt` and `providerResponseObservedAt`.

Prediction rows, Official Pick policy, recommendation logic, settlement rules and learning rules are not changed.

## Product Surfaces

Today, Current Board, Rent Play, Moneyline Bet, Smart Parlay, Most Likely, Best Value, Betting Workspace and Game Intelligence continue to consume stored odds evidence. They do not acquire provider data independently.

## Operations Evidence

`/api/operations/event-refresh-plan` now exposes canonical acquisition readiness, latest active acquisition evidence, selected-event eligibility, deduplication template and activation blockers.

`/api/operations/adaptive-refresh/status` exposes the compact event refresh plan and canonical acquisition status.

The MLB Operations Center shows planner mode, execution status, request granularity, active eligible events, last active acquisition, actual calls and snapshots.

## Safety

- Provider calls during read-only checks: 0.
- Database mutations during read-only checks: 0.
- Prediction writes expected from acquisition: 0.
- Result writes expected from acquisition: 0.
- Settlement writes expected from acquisition: 0.
- Learning writes expected from acquisition: 0.
- Scheduler cadence changes: false.
- Refresh policy changes: bounded SportsDataIO MLB active execution only; cadence values unchanged.
- Official Pick changes: false.

OE-003F was not started.
