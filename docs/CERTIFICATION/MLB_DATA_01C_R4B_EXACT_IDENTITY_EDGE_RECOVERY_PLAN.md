# MLB-DATA-01C-R4B Exact Identity Edge Recovery Plan

Status: `MLB_DATA_01C_R4B_EXACT_IDENTITY_EDGE_RECOVERY_PLAN_CERTIFIED`

R4B is a zero-write planning phase. It accepts the R4A negative proof: the seven remaining event gaps lack exact stored game_pk edges, the 1,292 existing-player candidates have no exact provider-ID path to current `sport_players.id`, the 16 ambiguous players remain unresolved, and the 161 true-missing players remain the only safe future create set.

## Event Edge Plan

- Seven unresolved events preserved: 7
- Missing edge type: doubleheader/event provider edge missing for all seven
- Event provider calls required for legacy-link recovery: YES
- Event recovery plan ready: YES

The minimum safe output is exactly one `MLB game_pk -> sport_events.id` edge per game, or an explicit no-legacy-edge result that routes the game to a separately authorized Pick 2 gamePk-rooted event fallback.

## Player Edge Plan

- Existing-player gap count: 1292
- Exact current canonical links: 0
- Name-audit-only candidates: 1292
- Ambiguous players: 16
- Safe future player-create set: 161

R4B forbids name-based recovery. The acceptable player edge is `MLBAM person_id -> exact provider player ID -> sport_players.id`, or an equally deterministic stored identity chain.

## Recommended R4C

`MLB_DATA_01C_R4C_EXTERNAL_EXACT_EDGE_ACQUISITION`

Run the smallest exact-edge acquisition first, beginning with a read-only identity-only SportsDataIO MLB Players contract probe. If the payload cannot expose an exact MLBAM-to-SportsDataIO bridge, switch to a Pick 2 MLBAM-rooted canonical namespace plan instead of weakly linking legacy players.

## Boundaries

`MLB_DATA_01C_R5_PERSISTENCE_READY = NO`

`MLB_DATA_01D_2025_FEATURE_BUILD_READY = NO`

Provider calls, production DML/schema mutations, crosswalk writes, canonical inserts, raw mapping writes, feature/model/prediction writes, 2026 imports, automation and cron changes are all 0.
