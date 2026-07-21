# Universal Event Identity V1

Last updated: 2026-07-21

## Status

Certification: `UNIVERSAL_EVENT_IDENTITY_V1_PARTIAL`

Universal Event Identity V1 adds a shared stored-data-only identity contract and diagnostics for event linkage across predictions, odds, results, team stats, player stats, settlement, replay and analyst surfaces.

## Production Audit Baseline

Read-only production audit against commit `a4b5d55fecf18d7ea3a7475d02d3494bfb5af75b` found:

- Prediction rows examined: 1,276
- Pending-like rows examined: 656
- Rows classified by settlement as `EXACT_EVENT_MAPPING_MISSING`: 342
- Safe deterministic event repairs available: 0
- Provider mappings to create: 0
- Prediction rows to update: 0
- Provider calls: 0
- Remote mutations: 0

Root cause classification for the 342 rows:

- `EVENT_NOT_IMPORTED`: 342

Affected sports:

- `americanfootball_ncaaf`: 122
- `americanfootball_nfl`: 190
- `baseball_mlb`: 10
- `soccer_epl`: 20

All 342 rows are stored moneyline predictions whose current event identifiers do not resolve to an imported canonical `sport_events` row or to an exact stored provider/result/stat mapping. No row had enough evidence for deterministic repair.

## Canonical Source

`sport_events.id` remains the canonical event identifier. Other subsystems link to it through:

- `prediction_history.game_id`
- `sports_odds_snapshots.event_id`
- `game_results.game_id`
- `sport_game_stats.event_id`
- `sport_player_stats.event_id`
- `provider_entity_mappings.internal_id`
- `sport_events.provider_ids`

## Resolver Contract

The resolver exposes deterministic confidence states only:

- `EXACT_PROVIDER_ID`
- `EXACT_SOURCE_MAPPING`
- `EXACT_LEGACY_MAPPING`
- `EXACT_MULTI_FIELD_MATCH`
- `CONFLICT`
- `AMBIGUOUS`
- `UNRESOLVED`

Display-name-only team/date matches are never trusted as repair evidence.

## Routes

- `GET /api/events/identity/audit`
- `GET /api/events/identity/audit?validate=true`
- `POST /api/events/identity/audit` protected by `CRON_SECRET`
- `GET /api/events/identity/unresolved`
- `GET /api/events/identity/conflicts`
- `GET /api/events/[eventId]/identity`

The current protected execution path is idempotent and performs zero mutations when no exact repairs exist. If future exact candidates appear, write execution is blocked until the scoped mutation set is reviewed.

## Mutations

No migration was created. No production mutation was performed for this module because the dry-run found zero deterministic repair candidates.

## Limitations

The remaining 342 rows cannot be repaired from current stored evidence. They require imported canonical events or exact provider/source mappings before settlement can advance.
