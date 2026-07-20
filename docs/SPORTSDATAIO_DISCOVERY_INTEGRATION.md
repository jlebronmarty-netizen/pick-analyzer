# SportsDataIO Discovery Integration

Status: Implemented
Version: V1
Provider calls added: 0
External data acquisition added: 0

## Purpose

The SportsDataIO MLB Discovery layer turns the existing endpoint catalog, provider capability audit and stored `sports_sync_jobs` evidence into one read-only capability contract.

It answers:

- Which MLB SportsDataIO endpoints are cataloged.
- Which are Discovery Lab accessible versus enterprise/subscription blocked.
- Which endpoints have HTTP 200 pilot evidence, empty payload evidence, stored table evidence or catalog-only status.
- Which retained fields are usable, identity-only, display-only, unknown or unsafe.
- Which data can feed future MLB features and which must remain unavailable.

## API

- `GET /api/providers/sportsdataio/discovery`
- `GET /api/providers/sportsdataio/discovery?includeValidation=true`
- `POST /api/providers/sportsdataio/discovery`

`GET` is always dry-run/read-only. `POST` is dry-run by default. `dryRun=false` requires `CRON_SECRET` authorization, but live provider transport is intentionally not enabled in V1.

## Sources

- `src/config/sportsdataio-endpoint-catalog.ts`
- `src/services/mlb-provider-capability-audit.service.ts`
- `sports_sync_jobs`
- Normalized tables: `sports_teams`, `sport_players`, `sport_events`, `sport_standings`, `sport_game_stats`, `sport_player_stats`, `sports_odds_snapshots`, `provider_entity_mappings`

## Guardrails

- No secrets are returned.
- Raw samples are omitted by default.
- Sanitized scalar samples only appear when `includeSamples=true`.
- Catalog support is not treated as recommendation support.
- Enterprise endpoints remain subscription blocked under Discovery Lab.
- Player props, first-five, first-inning, team totals and alternates remain unsupported until full ingestion, modeling, settlement, replay and dashboard support exists.
- Detailed injury data remains subscription blocked.
- Roster/player status must stay separate from injury diagnosis and expected-return data.

## Dashboard

Advanced Details > Provider includes the SportsDataIO Discovery Lab panel.

It shows endpoint counts, status buckets, field quality, identity mapping rows, projection activation blockers and capability-matrix evidence.
