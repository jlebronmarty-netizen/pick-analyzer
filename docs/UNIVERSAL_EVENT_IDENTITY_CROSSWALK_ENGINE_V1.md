# Universal Event Identity & Crosswalk Engine V1

Status: implemented as an additive extension of the existing Universal Event Identity service. No second crosswalk engine was created.

## Dependency Graph

Provider feeds and provider adapters flow into `provider_entity_mappings`, `sport_events.provider_ids`, `sports_teams.provider_ids`, `sport_players.provider_ids`, `sports_odds_snapshots` and `game_results`. Those canonical identity tables feed `prediction_history`, settlement, learning, performance and product surfaces.

The universal identity chain is:

Sport -> Competition -> Season -> Team/Player -> Event -> Market -> Selection -> Bookmaker/Player Prop -> Prediction -> Result -> Settlement -> Learning -> Performance.

## Existing Systems Reused

- `provider_entity_mappings` remains the canonical provider-to-internal mapping table.
- `sport_events`, `sports_teams` and `sport_players` remain the canonical entity tables.
- `sports_odds_snapshots` and `game_results` remain provider evidence/result evidence tables.
- `universal-event-identity.service.ts` remains the one identity engine and now exposes universal crosswalk coverage.
- The existing event identity audit route now supports `?universal=true`.
- MLB-specific The Odds API crosswalk and pitcher identity bridge remain provider/sport adapters, not separate universal engines.
- Multi-sport registry and season governance remain the sport/competition source of truth.

## Resolution Priority

1. Existing provider IDs and `provider_entity_mappings`.
2. Existing canonical event IDs.
3. Existing `sport_events.provider_ids`.
4. Verified aliases and exact participant identity where already present.
5. Time-window plus exact participant identity.

Ambiguous participant/time matches, provider collisions, soccer placeholder competitions and provider-native mappings are blocked. Fuzzy matching is not used.

## Coverage Snapshot

Read-only audit result from `getUniversalCrosswalkCoverageAudit()`:

| Sport | Canonical events | Provider event mappings | Provider-native mappings | Odds rows | Result rows | Identity coverage | Blockers |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| MLB | 4923 | 4952 | 20 | 53689 | 471 | 100% | provider-native mappings remain flagged |
| NBA | 14 | 14 | 0 | 540 | 0 | 100% | none in sampled provider evidence |
| BSN | 38 | 38 | 0 | 0 | 2 | 100% | result rows not canonical-event linked |
| NFL | 0 | 75 | 75 | 1978 | 0 | 0% | canonical events empty; provider-native mappings |
| NHL | 0 | 32 | 32 | 426 | 0 | 0% | canonical events empty; provider-native mappings |
| Soccer | 0 | 0 | 0 | 260 | 0 | 0% | canonical events and provider event mappings empty |
| UFC | 0 | 32 | 32 | 360 | 12 | 0% | canonical events empty; provider-native mappings; results not canonical-linked |

## Validation

- Universal identity fixtures: 16/16 passing.
- Provider calls: 0.
- Remote mutations: 0.
- Production mutations: 0.

## Certification Markers

- `UNIVERSAL_EVENT_IDENTITY_ENGINE_V1_PASS`
- `NO_SECOND_CROSSWALK_ENGINE_PASS`
- `PROVIDER_ENTITY_MAPPING_REUSE_PASS`
- `CANONICAL_EVENT_ID_REUSE_PASS`
- `SPORT_COMPETITION_SEASON_SCOPE_PASS`
- `DETERMINISTIC_IDENTITY_RESOLUTION_PASS`
- `AMBIGUOUS_MATCH_BLOCKED_PASS`
- `SOCCER_COMPETITION_SCOPE_ENFORCED_PASS`
- `NO_FUZZY_MATCHING_PASS`
- `NO_PROVIDER_CALL_PASS`
- `NO_DATABASE_MUTATION_PASS`
- `NO_PREDICTION_ENGINE_CHANGE_PASS`
- `NO_SETTLEMENT_ENGINE_CHANGE_PASS`
- `NO_LEARNING_ENGINE_CHANGE_PASS`
