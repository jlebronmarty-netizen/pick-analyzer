# MLB-DATA-01C 2025 Canonical Game / Player / Team Mapping

Verdict: `MLB_DATA_01C_2025_CANONICAL_MAPPING_BLOCKED`

MLB-DATA-01C audited and partially executed identity-only canonical mapping for the imported 2025 Statcast raw table. Raw stability remained intact: 712,528 rows, 712,528 unique pitch identities, 0 duplicate identities, 2,430 source games, 30 source teams and date coverage from 2025-03-18 through 2025-09-28.

The mutable field allowlist was limited to Pick 2 mapping fields: `canonical_home_team_id`, `canonical_away_team_id`, `event_id`, `event_mapping_state`, `canonical_pitcher_id`, `canonical_batter_id`, `player_mapping_state`, `mapping_metadata` and `mapped_at`. Raw source identity, source player/team evidence, pitch measurements, score state, `raw_payload`, `raw_payload_digest`, ingest timestamps and created timestamps remained immutable.

Team mapping was deterministic and executed. All 30 source team abbreviations mapped to canonical MLB teams with exact aliases for `AZ -> ARI` and `CWS -> CHW`. Production readback confirms all 712,528 rows have canonical home and away team IDs. No source abbreviations were rewritten.

Game mapping was not executed. The canonical 2025 event inventory contains 2,462 MLB events, but no `sport_events` rows expose exact stored MLB gamePk values, only 227 provider crosswalk rows are available, and exact date/home/away produced 1,816 mapped source games, 305 unmapped games and 309 ambiguous games. Because the mapped subset did not pass unique canonical event identity and the unmapped/ambiguous games require repair, `event_id` remains unpopulated for all rows.

Player mapping was not executed. The 2025 source player inventory reconfirmed 1,469 unique MLBAM source persons, but existing canonical player storage/crosswalks did not provide a safe 2025 MLBAM-to-`sport_players.id` mapping path. All 1,469 source players remain unmapped. No canonical players were created in 01C.

No derived features, model rows, prediction rows, market-value rows, 2026 rows, provider calls, schema mutations, automation or cron changes were created. Production DML during 01C was limited to the 712,528 row-level team mapping updates. `MLB_DATA_01D_2025_FEATURE_BUILD_READY = NO` until event identity and MLBAM player identity repair are certified.

Certification artifact: `docs/CERTIFICATION/mlb-data-01c-2025-canonical-mapping.json`
