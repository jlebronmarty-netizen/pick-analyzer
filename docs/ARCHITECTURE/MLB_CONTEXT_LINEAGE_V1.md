# MLB Context Lineage V1

MLB-01 adds a pregame context lineage surface for current and forward MLB events without changing any prediction, recommendation, settlement, learning or calibration behavior.

## Authority Contract

- Official MLB schedule/status/starter/venue evidence: MLB Official.
- Odds evidence: The Odds API.
- SportsDataIO: rollback-only and excluded from MLB-01 context acquisition.
- Lineups: stored `sport_lineups` rows when present, otherwise projected from stored player stats and labeled as projected.
- Bullpen workload: stored `sport_game_stats` and `sport_player_stats` only.
- Weather: unavailable until an approved weather source is certified.
- Injuries: stored `sport_injuries` only; no new injury provider is certified in MLB-01.

## Snapshot Contract

`mlb_context_snapshots` stores deterministic, shadow-only context snapshots keyed by event, snapshot type and event start time.

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

Missing context is represented as `UNKNOWN` or explicit blockers. MLB-01 never fabricates weather, injuries, confirmed lineups, probabilities or odds.

## Temporal Safety

Context snapshots expose `temporal_status`. Pregame model consumers must use only snapshots whose `snapshot_timestamp` is before the target event start and before the configured prediction cutoff. Post-start evidence is diagnostic only.

## Product Safety

MLB-01 snapshots are `shadow_only=true` and `production_eligible=false`. Persisting a context snapshot does not create or update `prediction_history`, Official Picks, product recommendations, settlement rows, learning labels or calibration rows.

## Certification Result

The deployed code path is ready for shadow-input enrichment, but full production context remains partially blocked by unavailable approved weather and injury sources and by the absence of a certified confirmed-lineup provider.
