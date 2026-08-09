# SDIO-EXIT-03A Natural MLB Official Shadow Proof

Status: `SDIO_EXIT_03A_REPOSITORY_REPAIR_READY_FOR_NATURAL_PROOF`

Starting commit: `3e160349b9a4ededd6e48466a28d14d11282ba21`

## Verdict

SDIO-EXIT-03A found a repository wiring gap: `MLB_DATA_SOURCE_MODE` was deployed and readable through `/api/operations/mlb-official-replacement`, but the normal protected operating-day scheduler did not invoke the official MLB schedule/starter shadow path. Production could therefore remain in `DUAL_READ` while recording zero natural `mlb_stats_api` shadow mappings.

Root cause: `MLB_OFFICIAL_NOT_WIRED`.

## Expected DUAL_READ Behavior

`DUAL_READ` now means:

- SportsDataIO remains product-authoritative for current MLB odds until separately promoted.
- The Odds API remains `STAGE_1_DUAL_READ` and shadow-only.
- The official MLB Stats API schedule endpoint runs as an additional shadow comparison during eligible operating-day market refresh actions.
- Official MLB rows are stored only as additive provider mappings and sync-job evidence.
- Canonical `sport_events`, prediction rows, Official Pick policy, settlement, learning and Performance are not promoted or overwritten by this shadow path.

## Scheduler Chain

Natural execution path:

`Vercel Cron`

`/api/cron/operating-day`

`runPostgameContinuity`

`runAdaptiveRefresh`

eligible `morning_sync` / `midday_refresh` / `final_refresh`

SportsDataIO canonical acquisition

The Odds API shadow acquisition

MLB Stats API official shadow schedule/status/starter acquisition

## Repair

Runtime repair:

- `src/services/adaptive-refresh-orchestrator.service.ts` now invokes `executeMlbOfficialShadowAcquisition` inside the existing eligible market-refresh branch.
- `src/services/mlb-official-replacement.service.ts` now exposes `executeMlbOfficialShadowAcquisition`.
- The official shadow acquisition uses one bounded date-level MLB Stats API schedule call.
- Matching is deterministic by team identity and start-time window.
- Additive event/player mappings are persisted to `provider_entity_mappings`.
- One `sports_sync_jobs` row records official provider accounting and comparison evidence.

## Accounting

Official MLB provider accounting is separate:

- provider: `mlb_stats_api`
- job type: `sdio_exit_03a_mlb_official_shadow_v1`
- action: scheduler-selected market refresh action
- HTTP calls: one schedule request per eligible execution
- rows fetched: official games returned
- rows persisted: additive official mappings plus sync-job audit row
- failures: unmapped and ambiguous games in sync-job metadata

## Safety

- SportsDataIO remains enabled and retained for rollback.
- The Odds API remains shadow-only.
- `MLB_OFFICIAL_PRIMARY` is not promoted.
- No prediction formulas changed.
- No Official Pick threshold changed.
- No settlement policy changed.
- No learning behavior changed.
- No post-start prediction writes are introduced by the official shadow path.

## Natural Proof Requirement

Final promotion gate remains external:

- at least 2 consecutive eligible natural official MLB shadow runs;
- schedule coverage healthy;
- event mappings unambiguous;
- duplicates equal 0;
- probable starter evidence useful;
- lifecycle differences observable;
- scheduler and settlement healthy.

Current classification: `MLB_OFFICIAL_SHADOW_PASS_MORE_OBSERVATION_REQUIRED`.
