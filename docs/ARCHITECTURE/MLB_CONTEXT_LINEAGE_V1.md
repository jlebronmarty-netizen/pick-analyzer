# MLB Context Lineage V1

MLB-01 adds a pregame context lineage surface for current and forward MLB events without changing any prediction, recommendation, settlement, learning or calibration behavior.

## Authority Contract

- Official MLB schedule/status/starter/venue evidence: MLB Official.
- Odds evidence: The Odds API.
- SportsDataIO: rollback-only and excluded from MLB-01 context acquisition.
- Lineups: MLB Official live feed boxscore batting-order evidence when available, stored `sport_lineups` rows when present, otherwise projected from stored player stats and labeled as projected.
- Bullpen workload: stored `sport_game_stats` and `sport_player_stats` only.
- Weather: unavailable until an approved weather source is certified.
- Injuries: stored `sport_injuries` only; no new injury provider is certified in MLB-01.

## Snapshot Contract

`mlb_context_snapshots` stores deterministic, shadow-only context snapshots keyed by event, snapshot type and event start time.

MLB-01R2 evaluates every row independently before persistence. A stale, post-start, final, cancelled or unmapped event is skipped with an explicit decision instead of blocking safe current-forward rows. The write path pre-reads deterministic keys and inserts only new eligible snapshots; it does not use broad upsert semantics that could overwrite earlier context evidence.

Supported snapshot types:

- `MORNING`
- `FINAL_PREGAME`
- `CURRENT_PROBE`

Every snapshot records:

- canonical event identity;
- event start and pregame temporal status;
- starter evidence;
- lineup evidence;
- bullpen evidence;
- park identity;
- weather and injury availability;
- source lineage;
- feature lineage;
- completeness and blockers.

Missing context is represented as `UNKNOWN` or explicit blockers. MLB-01 never fabricates weather, injuries, confirmed lineups, probabilities or odds. MLB Official batting-order rows are `PROJECTED` unless the provider response exposes an explicit confirmation state.

## Temporal Safety

Context snapshots expose `temporal_status`. Pregame model consumers must use only snapshots whose `snapshot_timestamp` is before the target event start and before the configured prediction cutoff. Post-start and post-cutoff evidence is diagnostic only.

## Product Safety

MLB-01 snapshots are `shadow_only=true` and `production_eligible=false`. Persisting a context snapshot does not create or update `prediction_history`, Official Picks, product recommendations, settlement rows, learning labels or calibration rows.

## Certification Result

The R2 runtime path is ready to skip unsafe rows independently and to acquire bounded MLB Official lineup evidence without SportsDataIO. Production snapshot persistence remains blocked until `public.mlb_context_snapshots` is visible through the Supabase/PostgREST schema cache.
