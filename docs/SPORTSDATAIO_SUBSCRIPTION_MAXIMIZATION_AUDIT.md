# SportsDataIO Subscription Maximization Audit

Date: 2026-07-21

Status: `SPORTSDATAIO_AUDIT_PARTIAL`

Route: `/api/providers/sportsdataio/maximization-audit?includeValidation=true`

## Result

The audit inventory is implemented as a read-only data engineering surface. It catalogs the SportsDataIO endpoints already represented in the repository, classifies current use, storage coverage, ignored datasets, ROI, entitlement evidence and implementation gates.

Implementation of new ingestion was not started because exact full subscription entitlement remains partial under the approved 10-call safe probe cap.

## Exact Subscription Evidence

Known from local repository/environment configuration:

- `SPORTSDATAIO_MLB_API_KEY` is configured as a server-only key name.
- `SPORTSDATAIO_NBA_API_KEY` is configured as a server-only key name.
- MLB is modeled as `sportsdataio_discovery_lab` with `fantasy` and `odds` products.
- NBA has prior trial evidence for enterprise-style `/v3/nba/...` scores, stats, projections and odds endpoints.

Not known:

- SportsDataIO account plan/tier.
- Full entitlement matrix for every active key.
- Provider-enforced rate limits per key.
- Whether catalog-only NFL, NHL or Soccer endpoints are included in the current paid subscription.

Therefore the exact subscription is `PARTIAL_ACCOUNT_EVIDENCE`, not fully certified.

## Safe Entitlement Discovery

The entitlement discovery pass made exactly 10 external SportsDataIO calls, caused 0 remote mutations and exposed no secrets.

Verified entitled representative domains:

- MLB metadata/current season
- MLB teams
- MLB GamesByDate schedule/results/starters/weather payload
- MLB standings
- MLB players
- MLB player game stats endpoint access
- MLB team season stats
- MLB current odds/GameOddsByDate
- NBA teams
- NBA injuries

No unavailable endpoint was newly proven by the 10-call probe set. Exact endpoint-by-endpoint entitlement remains partial because 117 cataloged endpoints were intentionally not probed.

## Inventory Coverage

Read-only smoke result:

- Endpoints cataloged: 127
- Used: 7
- Partially used: 22
- Not used: 98
- Estimated weighted utilization before: 14.2%
- Estimated weighted utilization after: 14.2%
- Provider calls made by audit: 0
- Remote mutations made by audit: 0

The full endpoint-by-endpoint inventory is returned by `/api/providers/sportsdataio/maximization-audit?includeValidation=true`.

Each endpoint row includes:

- endpoint
- description
- sport
- category
- provider variant
- product
- rate-limit evidence
- historical availability
- realtime status
- current implementation
- `USED` / `PARTIALLY_USED` / `NOT_USED`
- stored table evidence
- ignored flag
- potential Pick Analyzer value
- ROI rank and stars
- implementation gate
- entitlement status
- probe evidence where available
- prior repository evidence
- historical extraction policy

## High-Value Gaps

Critical ROI domains:

- Schedules and game lifecycle
- Results and completed scores
- Odds and line movement
- Team/player/game statistics

High ROI domains:

- Players
- Injuries
- Lineups/depth charts/starters
- Standings

Current blockers:

- `exact_sportsdataio_subscription_plan_not_verified`
- `provider_endpoint_entitlement_matrix_not_exported_from_account`
- `rate_limits_not_verified_per_active_key`

## Implementation Decision

New Critical/High ingestion was not implemented.

Reason: the user explicitly required the audit to complete before implementation. The repository can prove catalog and prior pilot evidence, but cannot prove the exact purchased subscription tier or complete entitlement matrix without account/provider evidence.

## Data Lake Requirements Preserved

Any future implementation must store new datasets permanently with:

- source
- provider
- timestamp
- version
- lineage
- idempotent upsert
- historical retention
- no destructive overwrite

Existing destination tables identified by the audit include:

- `sports_teams`
- `sport_events`
- `sport_standings`
- `sport_players`
- `sport_player_stats`
- `sport_game_stats`
- `sport_lineups`
- `sport_injuries`
- `sports_odds_snapshots`
- `provider_entity_mappings`
- `sports_sync_jobs`

## Validation

Build:

- `npm.cmd run build`: PASS

Smoke:

- `/api/providers/sportsdataio/maximization-audit?includeValidation=true`: PASS, `SPORTSDATAIO_AUDIT_PARTIAL`, 127 endpoints, validation 10/10, provider calls 0, remote mutations 0.
- `/api/operations/validation`: PASS, SportsDataIO maximization validation 10/10, provider calls 0, remote mutations 0.

## Certification

Inventory: PARTIAL

Coverage: PARTIAL

Unused endpoints: IDENTIFIED FROM CURRENT CATALOG

Implemented endpoints: NONE IN THIS PROJECT

Remaining opportunities: 98 not-used endpoints plus 22 partial endpoints, pending exact entitlement verification.

Subscription utilization before: 14.2%

Subscription utilization after: 14.2%

Final status: `SPORTSDATAIO_MAXIMIZATION_PARTIAL`
