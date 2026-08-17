# NFL-01-START BallDontLie Live Executor Readiness

Status: `NFL_01_BALLDONTLIE_TRIAL_EXECUTION_READY`

Date: 2026-08-16

Starting commit: `4b7be6270d0398cc3ce33f492599fa2334d7b173`

## Scope

NFL-01-START prepares the live BallDontLie NFL historical importer executor for a future explicitly authorized 48-hour trial window. It does not activate the trial, call BallDontLie, normalize provider data, mutate Supabase, activate NFL production, enable an NFL scheduler, create NFL predictions, or change MLB/NBA runtime behavior.

The executor is now live-capable only behind hard gates:

- `BALLDONTLIE_API_KEY` must be present locally.
- `NFL_BALLDONTLIE_TRIAL_ACTIVE=true` must be set.
- `NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED=true` must be set.
- `--execute` must be supplied.
- `--maxCalls` and `--maxRuntimeMinutes` must be supplied.
- `--maxRequestsPerMinute` must remain at or below the certified trial-safe rate.

Having a local API key alone is intentionally insufficient.

## Execution Queues

| Queue | Entries | Estimated requests | Safe-rate runtime |
| --- | ---: | ---: | ---: |
| Probe | 3 | 3 max | 5 minutes cap |
| P0 | 21 | 1121 | 4.67 hours |
| P1 | 26 | 377 | 1.57 hours |

P0 includes teams, players, games/results, player game stats and team game stats. P1 includes validation/research feeds. P2 remains disabled by default.

## Future Commands

Dry run, zero provider calls:

```powershell
node --loader ./scripts/local-ts-loader.mjs scripts/nfl-01-balldontlie-historical-import-readiness.mjs --dry-run --p0 --all-certified-seasons
```

Connectivity/schema probe after the human activates the trial:

```powershell
$env:NFL_BALLDONTLIE_TRIAL_ACTIVE='true'; $env:NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED='true'; node --loader ./scripts/local-ts-loader.mjs scripts/nfl-01-balldontlie-historical-import-readiness.mjs --execute --probe --maxCalls=3 --maxRuntimeMinutes=5 --maxRequestsPerMinute=4
```

P0 historical queue after the probe passes:

```powershell
$env:NFL_BALLDONTLIE_TRIAL_ACTIVE='true'; $env:NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED='true'; node --loader ./scripts/local-ts-loader.mjs scripts/nfl-01-balldontlie-historical-import-readiness.mjs --execute --p0 --all-certified-seasons --resume --maxCalls=1200 --maxRuntimeMinutes=1440 --maxRequestsPerMinute=4
```

## Safety Certification

- Provider calls made by this phase: 0.
- Production database mutations made by this phase: 0.
- Local raw import artifacts created by this phase: 0 durable artifacts observed.
- SportsDataIO NFL expansion: no.
- The Odds API NFL historical calls: no.
- NFL Current Era / Official Picks / product activation: no.
- MLB and NBA runtime behavior: unchanged.

The next executable action is a separately authorized BallDontLie NFL GOAT trial activation and bounded probe. Do not start it from this certification commit.
