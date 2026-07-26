# MLB Starter Sync V1

Status: PARTIAL

MLB Starter Sync V1 is an additive canonical assignment layer for current MLB starting pitchers. It does not create a scheduler, does not alter the certified odds scheduler, and does not perform provider calls during normal page rendering.

## Source Matrix

| Field | Provider endpoint | Persisted table | Current coverage | Freshness | Provider calls required | Reliability |
|---|---|---|---:|---|---:|---|
| Probable home pitcher | `/api/mlb/odds/json/GamesByDate/{date}` | `sports_sync_jobs.metadata.rawPayload`, `sport_lineups` | 16 starter IDs after authorized refresh | Source timestamp before game start, <= 36h | 1 if ledger absent | Confirmed endpoint, projection gated |
| Probable away pitcher | `/api/mlb/odds/json/GamesByDate/{date}` | `sports_sync_jobs.metadata.rawPayload`, `sport_lineups` | 16 starter IDs after authorized refresh | Source timestamp before game start, <= 36h | 1 if ledger absent | Confirmed endpoint, projection gated |
| Confirmed starter ID | `/api/mlb/odds/json/GamesByDate/{date}` | `sports_sync_jobs.metadata.rawPayload`, `sport_lineups` | Populated where `StartingPitcherID` exists | Same | 1 if ledger absent | Confirmed endpoint |
| Starter name | `/api/mlb/odds/json/GamesByDate/{date}` | `sports_sync_jobs.metadata.rawPayload` | Populated for starter evidence rows | Same | 1 if ledger absent | Full-name only, never last-name-only |
| Handedness | `/api/mlb/fantasy/json/Players` | `sport_players.metadata` | Partial | Existing player metadata TTL | 0 for projection read | Stored metadata only |
| Historical pitcher ID | None | `historical_baseball_pitcher_appearances` | 11 mapped current slots | Historical immutable | 0 | Exact normalized full-name Retrosheet identity, ambiguous blocked |

## Current Slate Result

For 2026-07-26:

- Starter slots evaluated: 30
- Slots with provider evidence: 16
- Projection-safe mapped starter slots: 11
- Ambiguous mappings: 0
- Duplicate canonical mappings: 0
- Duplicate historical mappings: 0
- Name-only unsafe mappings: 0
- Team mismatch mappings accepted: 0
- Inactive player mappings accepted: 0
- Unexplained starter slots: 0

## Provider Call Ownership

Owner: existing MLB operating-day pregame/provider verification flow.

Starter sync is a substep candidate for operating-day pregame refresh. It must not create a second scheduler. Recommended cadence is morning, closer-to-first-pitch, and scratch/replacement refresh where supported, stopping after start.

One authorized GamesByDate refresh was run for proof:

- Endpoint: `/api/mlb/odds/json/GamesByDate/2026-JUL-26`
- Calls made: 1
- Rows received: 15 games
- Ledger row: `sports_sync_jobs` id `896de6d6-8216-4470-acbc-9fa522410c9b`
- Provider budget after call: estimated calls remaining 846

## APIs

- `GET /api/mlb/starters`
- `GET /api/mlb/starters/health`
- `GET /api/mlb/starters/validation`
- `POST /api/mlb/starters/sync`

POST defaults to dry-run. Production writes require the existing `CRON_SECRET` authorization pattern.

## Migration

Local migration only: `202607260002_mlb_starter_assignments_v1.sql`.

The migration creates `mlb_starter_assignments` for canonical current-starter evidence. It is additive and does not alter or drop existing certified platform tables.

RLS state: intentionally not enabled, matching the existing certified service-owned table pattern in this repository. Writes are performed by `service_role` through protected server APIs. Authenticated read access is canonical assignment evidence only, and UI/API workflows should continue to read through server-side routes. Rows are source evidence and must not be presented as betting advice.

Index coverage:

- `mlb_starter_assignments_active_event_team_idx` enforces one active assignment per event/team while preserving replacement history with `valid_until`.
- `mlb_starter_assignments_active_lookup_idx` supports current active assignment lookup by event/team.
- `mlb_starter_assignments_active_event_idx` supports active assignments by event.
- `mlb_starter_assignments_event_idx` supports event/status/role reads.
- `mlb_starter_assignments_pitcher_idx` supports canonical pitcher assignment history.
- `mlb_starter_assignments_provider_pitcher_idx` supports provider pitcher lookup while canonical player rows are pending.
- `mlb_starter_assignments_historical_pitcher_idx` supports Retrosheet identity traceability.
- `mlb_starter_assignments_source_updated_idx` supports source recency, scratch and replacement audits.

Not applied. Production application still requires explicit approval.

## Migration Rollback Notes

The migration should run after certified sports tables exist because it references `sport_events(id)` and `sports_teams(id)`. It should run before application deployment that persists starter assignments, and before pitcher projection persistence that depends on durable starter evidence.

Rollback limitation: dropping `mlb_starter_assignments` deletes persisted assignment history, including scratch/replacement audit evidence. Export rows before any destructive rollback. If rollback is required after code deployment, roll back the application first so production routes stop depending on the table, then perform any database rollback only with explicit destructive approval.
