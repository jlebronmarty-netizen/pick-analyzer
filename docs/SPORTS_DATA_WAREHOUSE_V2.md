# Sports Data Warehouse Contract V2

Status: Locally implemented as an architecture contract.

This contract defines the canonical warehouse layers for Historical Sports Data Foundation V2 without creating duplicate storage. Existing tables remain the source of truth until an additive migration is explicitly approved.

## Layers

| Layer | Purpose | Existing tables |
| --- | --- | --- |
| Provider raw/staging | Provider job evidence, sanitized extracts, checkpoints and import attempts | `sports_sync_jobs`, historical import checkpoint/job metadata |
| Canonical entities | Sports, leagues, teams, players and provider identity mappings | `sports_teams`, `sport_players`, `provider_entity_mappings` |
| Canonical events/results | Schedules, event identity, scores, period/inning/quarter scores and final results | `sport_events`, `game_results` |
| Statistics and boxscores | Team game stats, player season/game stats, lineups, injuries and starter evidence | `sport_game_stats`, `sport_player_stats`, `sport_lineups`, `sport_injuries`, `mlb_starter_assignments` |
| Market data | Pregame odds, current odds snapshots, player props and provider market metadata | `sports_odds_snapshots` |
| Feature store | Point-in-time feature snapshots and feature definitions | `historical_feature_snapshots`, feature store services |
| Prediction and settlement | Prediction rows, versions, settlements, outcomes and lifecycle status | `prediction_history`, settlement services |
| Audit and provenance | Validation findings, coverage, readiness, data quality, sync evidence and decision history | `sports_sync_jobs`, docs, governance APIs |

## Required Lineage Fields

Every persisted or future persisted warehouse row should be traceable through:

- provider
- provider entity ID
- canonical entity ID
- source timestamp
- ingestion timestamp
- effective timestamp
- deterministic key
- data version
- confidence
- completeness
- lineage metadata
- validation state
- correction state

Existing tables may store some of these fields directly and others in `metadata` or service-level evidence. Future migrations should add nullable columns only when they reduce ambiguity and do not invalidate existing rows.

## Deterministic Keys

Deterministic keys should be stable across retries:

- Teams: `sport_key`, `league_key`, provider team ID or normalized team identity.
- Players: `sport_key`, `league_key`, provider player ID or certified deterministic bridge key.
- Events: `sport_key`, `league_key`, season, provider event ID or canonical home/away/start identity with ambiguity checks.
- Stats: sport, season, stat type, event/player/team identity and provider source.
- Odds: sport, event, sportsbook, market, outcome, line and provider timestamp class.
- Predictions: prediction group key, model role, version and event/market identity.
- Features: sport, event, as-of timestamp, feature set version and source lineage.

Provider timestamps must not be used in keys when doing so would create duplicate current rows for the same provider/book/player/line/outcome state. Provider timestamps still remain required lineage fields.

## Validation States

Warehouse consumers should distinguish:

- `validated`: deterministic identity, complete required fields and no temporal contamination detected.
- `partial`: useful stored data exists, but a non-critical field or optional domain is missing.
- `review_required`: normalized-only, ambiguous, conflicting or provider-only identity evidence exists.
- `blocked`: data is unavailable, unlicensed, unsafe, post-event contaminated or structurally ambiguous.
- `deprecated`: superseded legacy row remains auditable but should not feed new active epoch metrics.

## Correction States

Correction workflows should be additive and auditable:

- `original`: first stored provider/canonical observation.
- `corrected`: a newer evidence row or metadata correction exists.
- `superseded`: a newer version replaces operational use while preserving auditability.
- `rejected`: row is retained for audit but excluded from production use.

Mass deletion is not a warehouse correction strategy.

## Sport-Specific Notes

- MLB: highest priority; existing Retrosheet, SportsDataIO, The Odds API event/player prop evidence and pitcher projection tables map into these layers.
- NBA: trial/pilot rows must remain isolated from production metrics until real-data promotion criteria are met.
- NFL/NHL: contracts may exist before canonical coverage exists; empty coverage is not a failure.
- Soccer: competition key is mandatory for warehouse identity.
- BSN: CSV/public-source adapters must provide deterministic IDs and provenance.
- Tennis/UFC: event, tournament/fight-card and participant identity are first-class; team-season keys are invalid.

## Certification

This phase is documentation/contract only:

- provider calls: 0
- remote mutations: 0
- migrations required: none

Certification markers:

`SPORTS_DATA_WAREHOUSE_CONTRACT_V2_PASS`

`DATA_LINEAGE_CONTRACT_PASS`
