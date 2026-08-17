# NFL-01 BallDontLie Historical Import Readiness

Status: `NFL_01_BALLDONTLIE_HISTORICAL_IMPORT_READINESS_CERTIFIED_WAITING_FOR_TRIAL`

This phase prepares the NFL historical sports-data foundation without starting the BallDontLie trial, calling providers, mutating production data, activating NFL scheduler automation or exposing NFL recommendations.

## Provider Authority

| Domain | Authority | Status |
| --- | --- | --- |
| Historical schedules/results/statistics | BallDontLie NFL | Prepared, waiting for trial |
| Current sports/stat data after trial | BallDontLie NFL ALL-STAR where possible | Feasible for core feeds |
| Betting markets and sportsbook price evidence | The Odds API | `americanfootball_nfl`, h2h/spreads/totals |
| SportsDataIO | None for new NFL work | Legacy docs only |

SportsDataIO is not part of the new NFL provider architecture. Existing SportsDataIO NFL catalog/checkpoint artifacts are preserved as legacy documentation and are not a dependency for NFL-01.

## Official BallDontLie Contract Evidence

The BallDontLie NFL documentation says NFL data covers 2002-current, uses `Authorization` API-key auth, cursor pagination with max `per_page` 100, and has a 48-hour GOAT trial at 5 requests/minute. The tier table identifies Teams, Players and Games as Free; Player Injuries, Active Players, Standings, Stats, Season Stats, Team Stats and Team Season Stats as ALL-STAR; and Advanced Passing/Rushing/Receiving, Plays, Betting Odds, Player Props, DFS and Team Roster as GOAT.

The local NFL plan intentionally uses GOAT trial time to capture historical evidence but designs ongoing day-to-day operation around ALL-STAR core feeds plus The Odds API prices.

## Historical Scope

Recommended seasons: `2021, 2022, 2023, 2024, 2025`.

Estimated volume:

| Item | Estimate |
| --- | ---: |
| Regular season games | 1,360 |
| Playoff games | 70 |
| Total games | 1,430 |
| Core predictions at 3 markets/game | 4,290 |

These are NFL structure estimates, not provider row-count proof. Exact counts must be reconciled during the trial schema probe and download.

## P0 / P1 / P2 Download Plan

P0 must be captured first:

| Feed | Tier | Reason |
| --- | --- | --- |
| Teams | Free | Canonical identity |
| Players | Free | Player identity and stat ownership |
| Games/results | Free | Event identity, schedule, status and final scores |
| Player game stats | ALL-STAR | Core player history |
| Team game stats | ALL-STAR | Core team offense/defense history |

P1 follows if time remains:

| Feed | Tier | Reason |
| --- | --- | --- |
| Season stats | ALL-STAR | Validation/research only unless as-of reconstructed |
| Standings | ALL-STAR | Forward context; historical final standings are not pregame-safe |
| Advanced passing/rushing/receiving | GOAT | Research/challenger features |
| 2025 rosters/depth chart | GOAT | Docs indicate roster data begins in 2025 |

P2 is deferred:

| Feed | Tier | Reason |
| --- | --- | --- |
| Injuries | ALL-STAR | Forward-only unless historical timestamps are proven |
| Plays | GOAT | High request/storage load |
| BallDontLie odds | GOAT | The Odds API remains market authority |
| Player props | GOAT | Out of scope |

## Raw Preservation

Every provider response must be written as sanitized immutable raw JSON below:

`data/imports/balldontlie/nfl/`

Raw payloads are the durable source for normalization, feature reconstruction, replay, settlement, calibration and diagnostics after the trial expires. Provider authorization headers and API keys must never be persisted.

## Leakage Contract

For a historical game at kickoff `T`, all prediction features must be derived strictly before `T`.

Never use:

- same-game final stats;
- future season aggregates;
- postgame injury state;
- fabricated odds or lines;
- retrospective predictions.

Historical outcomes may be attached only after prediction generation for settlement/evaluation.

## The Odds API Separation

BallDontLie is not treated as betting-market authority. The Odds API remains the betting evidence source for `americanfootball_nfl` Moneyline (`h2h`), Spread (`spreads`) and Total (`totals`). Historical ROI requires legitimate historical price evidence. Model training/calibration may proceed with sports features and outcomes even where historical odds are absent.

## Downloader State

The NFL-01 CLI is disabled by default:

```powershell
node --loader ./scripts/local-ts-loader.mjs scripts/nfl-01-balldontlie-historical-import-readiness.mjs --dry-run
```

The `--execute` path is intentionally blocked in NFL-01 unless future START authorization supplies all gates. It still performs 0 provider calls in this phase.

## Trial Activation Checklist

1. Activate the BallDontLie NFL GOAT trial.
2. Confirm `BALLDONTLIE_API_KEY` is present without printing it.
3. Confirm tier/plan and rate limit from provider response headers or dashboard.
4. Run one bounded connectivity/schema probe.
5. Persist sanitized raw probe payloads.
6. Recompute exact manifest from returned schema and cursors.
7. Start P0 download queue.
8. Checkpoint every cursor/page.
9. Normalize only after raw payload durability.
10. Track request count, retries, failures and trial time remaining.
11. Stop on auth/tier errors, schema mismatch, runaway pagination, rate-limit failure or storage/write failure.

## Next Phase

`NFL-01-START_BALLDONTLIE_CONNECTIVITY_SCHEMA_PROBE_AND_P0_DOWNLOAD`

Do not redesign after trial starts. The trial window is for data acquisition.
