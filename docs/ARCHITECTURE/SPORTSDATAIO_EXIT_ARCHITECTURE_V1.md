# SportsDataIO Exit Architecture V1

Status: `SDIO_EXIT_01_DEPENDENCY_AUDIT_COMPLETE_CANCEL_BLOCKED`

SDIO-EXIT-01 audits whether Pick Analyzer can safely cancel SportsDataIO after ODDS-03R certified that The Odds API can become the primary odds provider only after bounded repair. The answer is intentionally split by data domain: odds can move after ODDS-03, but full SportsDataIO cancellation is not safe today because non-odds live/future dependencies remain.

## Current Provider Boundary

| Domain | Current SportsDataIO Role | Production Reachable | Scheduler Invoked | Replacement State | Cancellation Risk |
| --- | --- | --- | --- | --- | --- |
| Odds | Active MLB current-day `GameOddsByDate` authority through protected canonical acquisition | Yes | Yes, via protected operating-day scheduler | The Odds API after ODDS-03 repairs | Medium until ODDS-03 |
| Schedule / game identity | MLB Discovery Lab `GamesByDate` / `Games` and stored `sport_events` identity | Yes for stored rows and verification ledgers | Indirect, through sync/verification paths | MLB Stats API candidate, The Odds API event metadata insufficient alone | Critical |
| Event status | Stored `sport_events.status`, SportsDataIO GamesByDate ledger, MLB Stats API result status | Yes | Yes for result closure via MLB Stats API | MLB Stats API already used for MLB result closure | High until schedule/status replacement certified |
| Results / final scores | Current MLB settlement path uses MLB Stats API, not SportsDataIO, then persists `game_results` | Yes | Yes | MLB Stats API is current replacement for MLB final results | Low for MLB, high for non-MLB |
| Settlement | Depends on persisted `game_results`, `sport_events`, prediction line identity, and market-specific rules | Yes | Yes | MLB result source already not SportsDataIO, but schedule/status still matters | Medium |
| Team stats | SportsDataIO catalog and historical import executor support team season/game stats | Partially | Not active for current production betting decisions unless feature sync is approved | MLB public/stat sources or stored historical snapshots required | High for future feature refresh |
| Player stats | SportsDataIO player stats paths and historical/player projection services exist | Partially | Not active for current production core picks | MLB public/stat sources or lower-cost stats provider required | High for props and player models |
| Starting pitchers | `mlb-starter-sync.service.ts` reads stored lineups and SportsDataIO GamesByDate ledger evidence | Yes, read-only health/assignment surfaces | Optional refresh path exists | MLB Stats API probable pitchers or another roster/probable starter source required | Critical for starter-aware models |
| Lineups | SportsDataIO/NBA depth chart and MLB lineup foundation exists | Foundation / partial | Not core MLB official-pick gate today | MLB public feeds or alternate lineup provider needed | Medium |
| Injuries | SportsDataIO injury tables/routes exist mainly foundation/NBA confidence paths | Foundation / partial | Not core MLB official-pick gate today | Alternate injury source needed before injury-aware modeling | Medium |
| Player props | SportsDataIO and The Odds API prop audit paths exist; no production prop recommendations | No official production props | No | The Odds API Business props can be evaluated later | Low today, high for future props |
| Provider mappings | SportsDataIO IDs are embedded in `provider_entity_mappings`, `sport_events.provider_ids`, odds IDs, replay lineage | Yes | Read/write by sync jobs | Must be retained indefinitely for lineage | Critical if deleted |

## Runtime Consumers

The audit classifies these runtime consumers:

- `src/services/canonical-acquisition.service.ts`: active protected SportsDataIO MLB odds writer. Endpoint pattern: `/api/mlb/odds/json/GameOddsByDate/{date}`. Writes `sports_odds_snapshots` and `sports_sync_jobs`; scheduler invoked; prediction surfaces read the stored evidence.
- `src/services/sportsdataio-mlb-normalization.service.ts`: normalizes SportsDataIO odds and line movement payloads. No provider calls by itself.
- `src/services/sportsdataio-discovery-lab-url.service.ts`: constrains Discovery Lab URLs to `/api/mlb/...` and prevents enterprise `/v3` paths from being used with the Discovery Lab key.
- `src/services/mlb-games-by-date-verification.service.ts`: protected verification path for GamesByDate payload shape, starters, weather and venue fields. Writes verification ledger only when explicitly confirmed.
- `src/services/mlb-starter-sync.service.ts`: reads stored `sports_sync_jobs` GamesByDate payload and `sport_lineups`; can optionally trigger provider refresh through the GamesByDate verifier.
- `src/services/sportsdataio-mlb-historical-import-executor.service.ts`: historical/import executor for teams, players, schedules, standings, team/player stats, odds, line movement and validation gates.
- `src/services/sportsdataio-runtime-adapter.service.ts`: disabled runtime adapter/capability model. It returns empty typed pages and zero provider calls.
- `src/services/sportsdataio-historical-import-readiness.service.ts`: NBA and multi-sport historical/import readiness and execution planning.
- `src/services/live-provider-verification.service.ts`, `src/services/mlb-missing-intelligence.service.ts`, `src/services/sportsdataio-subscription-maximization-audit.service.ts`: provider verification/audit surfaces that can be production reachable when explicitly invoked.
- `src/app/api/providers/sportsdataio/**`: read-only status/capability/readiness routes plus protected discovery execution route.
- `src/app/api/mlb/provider-verification/games-by-date/route.ts`, `src/app/api/mlb/starters/sync/route.ts`: MLB verification and starter sync wrappers.
- `src/app/api/nba/sync/**`, `src/services/nba-data-sync.service.ts`: NBA SportsDataIO trial/foundation sync surfaces. Not part of MLB production odds authority, but relevant to account-level cancellation.
- `scripts/live-multi-sport-acquisition-v1-*.mjs`: manual acquisition scripts with SportsDataIO env gates. Not scheduler-owned production code.

## Data Domain Matrix

| Domain | Current Source | Current Storage | Historical Persisted | Future Refresh Required | Consumers | Freshness Requirement | Replacement Required |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Schedule | SportsDataIO Games/GamesByDate, stored `sport_events`; MLB Stats API can supply schedule evidence | `sport_events`, `provider_entity_mappings`, `sports_sync_jobs` | Partially | Yes | dashboard, lifecycle, scheduler, current board | Daily/current slate | Yes |
| Game identity | SportsDataIO provider IDs plus canonical IDs | `sport_events.provider_ids`, `provider_entity_mappings` | Yes | Yes for future games | mapping, odds, settlement | Before prediction | Yes |
| Start time | SportsDataIO and stored event rows | `sport_events.start_time` | Yes for persisted games | Yes | cutoff, lifecycle, prediction | Pregame exact enough for cutoff | Yes |
| Event status | SportsDataIO ledger, `sport_events.status`, MLB Stats API final status | `sport_events`, `game_results` | Yes for imported rows | Yes | lifecycle, settlement, dashboard | Live/final closure | Yes |
| Final score/results | MLB Stats API current path, persisted `game_results` | `game_results`, `sport_events.home_score/away_score` | Yes for imported rows | Yes | settlement, learning, performance | After final | MLB Stats API already candidate |
| Standings | SportsDataIO catalog/import paths | `sport_standings` | Partial | Optional/current features | feature/admin surfaces | Daily/season | Yes if used |
| Team stats | SportsDataIO team stats, historical snapshots | `team_stats`, `sport_game_stats`, `historical_feature_snapshots` | Yes for replay snapshots | Yes for live feature refresh | model features, dashboards | Daily or pregame | Yes |
| Player roster | SportsDataIO player identity and mappings | `sport_players`, `provider_entity_mappings` | Partial | Yes for props/starters | player/starter/projection services | Daily/season | Yes |
| Player season stats | SportsDataIO player stats and historical snapshots | `sport_player_stats`, `historical_feature_snapshots` | Yes for replay snapshots | Yes for props/player models | player projections, features | Daily/season | Yes |
| Player game stats | SportsDataIO/Retrosheet historical, player stat tables | `sport_player_stats`, historical baseball tables | Yes for historical replay | Yes for props settlement/features | player models, props | Postgame | Yes |
| Starting pitchers | SportsDataIO GamesByDate ledger and `sport_lineups` | `sports_sync_jobs.rawPayload`, `sport_lineups`, `mlb_starter_assignments` | Partial | Yes | starter sync, pitcher features | Pregame within 36h | Critical replacement |
| Bullpen data | Historical feature snapshots/derived features | `historical_feature_snapshots` | Yes for replay | Yes for current refinement | feature store/model | Pregame/current | Replacement or stored-only mode |
| Injuries | SportsDataIO injury foundation | `sport_injuries` | Partial | Optional today, important later | NBA confidence, missing intelligence | Daily/pregame | Yes before injury-aware picks |
| Lineups | SportsDataIO depth/lineup foundation and MLB starter paths | `sport_lineups` | Partial | Optional today, important later | game intelligence, starters | Pregame | Yes |
| Historical features | Retrosheet/historical snapshots | `historical_baseball_*`, `historical_feature_snapshots` | Yes: 2,430 games and 70,470 snapshots | No for preserving current dataset | replay, calibration | Immutable | No |
| Odds | SportsDataIO today; The Odds API shadow | `sports_odds_snapshots` | Current snapshots persisted, historical odds incomplete | Yes | current board, homepage, opportunities | 5-15 minute actionability | ODDS-03 |
| Player props | SportsDataIO foundation, The Odds API docs/capture candidates | `sports_odds_snapshots`, projection tables | No production prop history | Yes for props | future props | Pregame/near real time | Yes |
| Provider mappings | SportsDataIO and The Odds API crosswalks | `provider_entity_mappings`, metadata | Yes | Yes for new events/players | all ingestion | Before writes | Retain |
| Settlement dependencies | Result rows, event status, line identity | `game_results`, `prediction_history`, `sport_events` | Yes for settled rows | Yes | settlement/learning/performance | After final | Results/status replacement |
| Learning dependencies | Settled prediction evidence | `prediction_history`, learning artifacts | Yes where settled | Yes | performance/model memory | After settlement | Indirect |

## Persisted Historical Ownership

HR-01 certifies:

- 2,430 historical MLB games.
- 70,470 historical feature snapshots.
- 7,290 full replay predictions.
- 2,430 events with valid pregame lineage and final results.
- 0 replay provider calls and 0 SportsDataIO calls during certification.

Therefore the existing historical replay dataset is owned locally and does not require future SportsDataIO access to preserve or re-read. Classification: `HISTORICAL_DEPENDENCY_REMOVED`.

## Cancellation Impact If `SPORTSDATAIO_MLB_API_KEY` Disappears Tomorrow

| Runtime Path | Expected State | Impact |
| --- | --- | --- |
| Current Board reads | `CONTINUES_FROM_STORED_DATA` | Existing rows render until stale/actionability gates block them. |
| Homepage decision surfaces | `DEGRADES_GRACEFULLY` | Reads stored dashboard/current-board data; stale odds become non-actionable. |
| Active odds refresh | `BLOCKED` | Protected canonical acquisition cannot call SportsDataIO and ODDS-03 is not yet complete. |
| Today's future slate discovery | `BLOCKED_OR_STALE` | Stored rows remain, but future slates/status need replacement. |
| MLB result settlement | `CONTINUES_WITH_MLB_STATS_API` | Current result sync path uses MLB Stats API, not SportsDataIO. |
| Starter-aware features | `BLOCKED_OR_STALE` | Existing starter evidence can be read, but new/current probable starter refresh needs replacement. |
| Team/player stat freshness | `BLOCKED_OR_STALE` | Historical snapshots remain; new stat refresh requires replacement. |
| Historical replay | `CONTINUES_FROM_STORED_DATA` | Replay dataset is persisted and isolated. |
| NBA SportsDataIO readiness/sync | `BLOCKED` | NBA trial/foundation SportsDataIO paths require their own replacement or deactivation plan. |
| Provider mapping lineage | `CONTINUES_IF_CODE_RETAINED` | Existing IDs must not be deleted. |

## Fail-Closed Migration Policy

- Never fabricate schedule, results, odds, starters, injuries or stats.
- If odds source fails after ODDS-03, mark `NO_FRESH_PRICE` or `WAIT_FOR_REFRESH`; do not fall back to stale SportsDataIO prices as actionable.
- If schedule/status source is unavailable, keep stored rows visible with explicit stale/unknown lifecycle and block new prediction generation for unverified events.
- If result source is unavailable, keep predictions pending or explicitly blocked; do not synthesize settlement.
- If starters/team/player stats are unavailable, either use immutable feature snapshots for historical/replay or downgrade/block starter/stat-dependent current predictions.
- Provider mappings must remain readable forever for audit lineage.

## Replacement Architecture Options

| Option | Description | Public Cost Evidence | Risk |
| --- | --- | --- | --- |
| A | Keep SportsDataIO + The Odds API | SportsDataIO Discovery Lab published at $99/mo per Fantasy or Odds, $149/mo combined; The Odds API Pro $29/mo and Business $99/mo | Lowest engineering risk; highest duplicate-provider cost. |
| B | The Odds API + public MLB data | The Odds API Pro/Business public pricing; MLB Stats API has no repo-certified cost contract | Best odds economics; schedule/status/results need hardening and legal/terms review. |
| C | The Odds API + lower-cost stats provider | Unknown until provider selected | Potentially lower than SportsDataIO, but migration complexity and quality risk. |
| D | SportsDataIO commercial/Leagues API only | SportsDataIO commercial pricing quote-based | Better SLA/live data, likely higher cost and not cancellation. |

Official source notes:

- The Odds API documentation describes `/events`, `/odds`, historical odds/settlements, and Business-tier player props: https://theoddsapi.com/docs/
- The Odds API pricing page lists Free, Professional and Business plans: https://theoddsapi.com/pricing
- SportsDataIO’s developer page describes Discovery Lab as next-day delayed personal-use data with published Discovery Lab pricing and commercial Leagues/API access as sales-led: https://sportsdata.io/developers
- Repository code already uses `statsapi.mlb.com/api/v1/schedule` for MLB results/status evidence. SDIO-EXIT-01 treats MLB public data as feasible but not yet fully certified for schedule/status/starter/stat replacement.

## Minimum Cancellation Gates

SportsDataIO cannot be cancelled until every critical gate passes:

1. `ODDS_REPLACED`: ODDS-03 deploys The Odds API as primary odds source with rollback.
2. `SCHEDULE_REPLACED`: current/future MLB slate discovery no longer depends on SportsDataIO.
3. `STATUS_REPLACED`: started/final/postponed/cancelled/suspended status is certified without SportsDataIO.
4. `RESULTS_REPLACED`: MLB result settlement has sustained proof from non-SportsDataIO source.
5. `STARTERS_REPLACED_OR_NOT_REQUIRED`: starter-aware model behavior is either replaced or safely disabled.
6. `TEAM_STATS_REPLACED_OR_STORED`: current team-stat feature dependency is replaced or certified stored-only.
7. `PLAYER_STATS_REPLACED_OR_STORED`: current player-stat feature dependency is replaced or certified stored-only.
8. `INJURIES_LINEUPS_CLASSIFIED`: injury/lineup paths are either replaced, disabled, or foundation-only.
9. `MULTI_SPORT_IMPACT_RESOLVED`: NBA/NFL/NHL/Soccer SportsDataIO usage is separately addressed.
10. `DAILY_AUTONOMY_PROVEN`: one pilot window proves morning sync, prediction, settlement, learning and performance without SportsDataIO.
11. `ROLLBACK_PLAN_READY`: SportsDataIO code and lineage are retained through a rollback window.

## Recommended Migration Phases

- `SDIO-EXIT-02 / ODDS-03`: The Odds API primary odds cutover with lifecycle-scoped mapping, line-versioned prediction, feature flag and rollback.
- `SDIO-EXIT-03`: Schedule and event-status replacement using MLB Stats API/public MLB data or another certified source.
- `SDIO-EXIT-04`: Results and settlement replacement hardening, including postponed/cancelled/suspended cases.
- `SDIO-EXIT-05`: Starters, team stats, player stats, injuries and lineups replacement or stored-only certification.
- `SDIO-EXIT-06`: SportsDataIO disabled shadow observation window.
- `SDIO-EXIT-07`: Cancellation certification after sustained no-SportsDataIO production operation.

## Retention And Deletion Policy

Do not delete SportsDataIO code immediately after migration. Keep provider adapters, normalizers, provider IDs and lineage documents for at least one full MLB operating cycle and one historical replay audit cycle after SportsDataIO is disabled. Only archive/remove runtime adapters after rollback is unnecessary and all provider IDs remain readable through canonical mappings.

## Multi-Sport Impact

`SPORTSDATAIO_MLB_API_KEY` is MLB-specific in active production odds paths, but the repository also references generic, NBA, NFL and NHL SportsDataIO environment names and catalogs multi-sport SportsDataIO endpoints. Cancellation must distinguish the current MLB Discovery Lab subscription from any shared SportsDataIO account or future NBA/NFL/NHL products. MC-03 remains not started.
