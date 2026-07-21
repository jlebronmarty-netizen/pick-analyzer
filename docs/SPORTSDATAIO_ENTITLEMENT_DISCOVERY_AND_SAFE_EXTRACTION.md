# SportsDataIO Entitlement Discovery And Safe Extraction

Date: 2026-07-21

Status: `SPORTSDATAIO_MAXIMIZATION_PARTIAL`

Route: `/api/providers/sportsdataio/maximization-audit?includeValidation=true`

## Mission Result

This was a read-only data engineering certification pass. BSN was not started, and no prediction, recommendation, Current Board, settlement, dashboard, scheduler or provider-refresh logic was changed.

The configured MLB and NBA SportsDataIO keys were safely probed with a hard cap of 10 external entitlement calls. The probes verified representative MLB and NBA domains, but they do not prove every cataloged SportsDataIO endpoint in the repository. Because exact full entitlement remains partial, no new extraction or database write was performed.

## Safe Probe Evidence

External calls made: 10

Remote mutations made: 0

Secrets exposed: false

Probe generated at: `2026-07-21T01:30:23.7530480Z`

Probe date: `2026-07-20`

Verified entitled probes:

- MLB current season metadata: HTTP 200, 1 row.
- MLB teams: HTTP 200, 30 rows.
- MLB GamesByDate schedule/results/starter/weather payload: HTTP 200, 15 rows.
- MLB standings: HTTP 200, 30 rows.
- MLB players: HTTP 200, 7530 rows.
- MLB player game stats by date: HTTP 200, 0 rows. Empty payload still proved endpoint entitlement for the requested date.
- MLB team season stats: HTTP 200, 30 rows.
- MLB GameOddsByDate current odds: HTTP 200, 15 rows.
- NBA teams: HTTP 200, 30 rows.
- NBA injuries: HTTP 200, 8 rows.

No 401, 403, 404, 429, billing warning or rate-limit response was observed in the safe probe set. Provider quota headers were not returned, and the local provider budget precheck returned HTTP 500, so this certification treats credits consumed as exactly 10 external SportsDataIO requests rather than an account-level quota balance.

## Entitlement Classification

Endpoint/domain rows now carry one of:

- `ENTITLED_VERIFIED`
- `NOT_ENTITLED_VERIFIED`
- `AVAILABLE_FROM_PRIOR_SUCCESS`
- `UNKNOWN_NOT_PROBED`
- `UNSUPPORTED_BY_PRODUCT`
- `ENDPOINT_NOT_CONFIRMED`
- `NEEDS_SAFE_PROBE`

The audit also records probe evidence, prior repository evidence and a dry-run historical extraction policy for each cataloged endpoint.

## Extraction Decision

New ingestion implemented: none.

Reason: existing MLB Discovery Import execution already covers the verified Critical/High MLB domains that are currently safe to use, including schedule, standings, team/player statistics, player identity and odds. Exact full entitlement for every cataloged endpoint remains incomplete under the 10-call cap, and no account entitlement export or rate-limit evidence is available.

Large historical import performed: false.

Historical depth confirmed: current-season and single-date access only. Earliest accessible historical date was not proven.

Recommended future dry-run order:

1. `teams_static_if_stale`
2. `season_schedule`
3. `standings`
4. `team_season_stats`
5. `players_static_if_stale`
6. `player_season_stats`
7. `game_odds_by_date_by_current_window`
8. `team_game_stats_by_date`
9. `player_game_stats_by_date`

Estimated call plan:

- Season-wide verified domains can start at roughly 5 calls.
- Date-by-date game stats and odds cost one call per domain per date.
- Previous-season backfill requires explicit season/date scope approval and provider budget reserve.

## Coverage

Catalog coverage remains:

- Endpoints cataloged: 127
- Used: 7
- Partially used: 22
- Not used: 98
- Estimated subscription utilization before: 14.2%
- Estimated subscription utilization after: 14.2%

Utilization did not increase because the mission stopped at the required safe entitlement gate and performed no extraction.

## Validation

The audit route is read-only:

- Provider calls during route read: 0
- Remote mutations during route read: 0
- Fixture validation includes safe-probe cap, no-mutation and no-secret checks.

## Remaining Blockers

- Full SportsDataIO account plan/tier is not exported into the repository.
- Full endpoint entitlement matrix is not available.
- Provider-enforced rate limits per active key are not verified.
- Provider quota headers were not observed during probes.
- Local provider budget route returned HTTP 500 during precheck.
- Historical depth beyond the current season/single-date probes is not proven.
- 117 cataloged endpoints remain unprobed by this 10-call safe discovery pass.

## Certification

Final status: `SPORTSDATAIO_MAXIMIZATION_PARTIAL`

This is not a failure. It is the truthful certification outcome for the approved 10-call, no-write discovery scope.
