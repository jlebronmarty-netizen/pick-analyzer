# MLB Official Data Provider V1

Status: `SDIO_EXIT_03E_RESULT_CLOSURE_REPAIR_READY_FOR_NATURAL_PROOF`

The MLB official data provider centralizes public MLB Stats API access for SDIO-EXIT-03. It does not replace SportsDataIO in production by itself, does not promote The Odds API, and does not change prediction formulas.

## Adapter

Runtime module: `src/services/mlb-official-data-provider.service.ts`

Supported bounded capabilities:

| Capability | MLB Stats API Endpoint Family | Status |
| --- | --- | --- |
| Schedule | `/api/v1/schedule?sportId=1&date=...&hydrate=probablePitcher,team,venue` | Implemented |
| Game status | Same schedule feed status block | Implemented |
| Probable pitchers | Same schedule feed probablePitcher hydrate | Implemented |
| Boxscore | Future official boxscore endpoint | Documented blocker |
| Team game stats | Future boxscore-derived ingestion | Documented blocker |
| Player game stats | Future boxscore/stat endpoint ingestion | Documented blocker |
| Roster | Future official roster endpoint | Documented blocker |
| Standings | Future official standings endpoint or internal result derivation | Not required today |

The adapter returns normalized rows with:

- official MLB `gamePk`;
- official date and scheduled start;
- home/away team identity;
- venue;
- game number and doubleheader marker;
- canonical status mapping;
- probable pitcher identity where supplied;
- source timestamp and capture timestamp.

## Data Source Mode

Runtime config: `src/config/mlb-data-source-mode.config.ts`

Modes:

| Mode | Meaning |
| --- | --- |
| `SPORTSDATAIO` | Legacy/rollback behavior. |
| `DUAL_READ` | Official MLB replacement path can be observed while SportsDataIO remains available. |
| `MLB_OFFICIAL_PRIMARY` | Future promotion target after natural shadow proof and human authorization. |

Default: `DUAL_READ`.

## Canonical Mapping

`src/services/mlb-official-replacement.service.ts` builds idempotent candidate rows for existing tables:

- `sport_events`;
- `sports_teams`;
- `provider_entity_mappings`;
- `sport_lineups` for probable starting pitchers.

The current SDIO-EXIT-03 deployment is shadow/dry-run oriented. It exposes row builders and validation fixtures, but does not disable SportsDataIO and does not write production rows from the read-only status route.

SDIO-EXIT-03A wires the official MLB path into natural protected scheduler execution for eligible `morning_sync`, `midday_refresh` and `final_refresh` actions. Under `DUAL_READ`, the path remains shadow-only: it records additive `provider_entity_mappings` and a `sports_sync_jobs` audit row with `job_type = sdio_exit_03a_mlb_official_shadow_v1`, while leaving canonical `sport_events`, predictions, Official Picks, settlement, learning and Performance unchanged.

SDIO-EXIT-03B tightens official MLB event matching after natural shadow proof found 13/15 mapped games, 2 ambiguous games and 12 official-vs-canonical status differences. The matcher now applies this deterministic hierarchy:

1. existing `mlb_stats_api` gamePk crosswalk;
2. exact canonical team identity aliases for both home and away teams;
3. exact operating date;
4. game number when canonical doubleheader metadata exists;
5. bounded start-time tolerance;
6. fail-closed ambiguity when multiple candidates remain.

Team+date alone is not a valid mapping for MLB official promotion. Same-team doubleheaders, same-start adjacent games, rescheduled games and same-matchup adjacent dates must stay distinct. The repair adds full-name-to-abbreviation aliases for MLB teams, including `Chicago Cubs -> CHC`, `Kansas City Royals -> KC`, `Tampa Bay Rays -> TB` and `Seattle Mariners -> SEA`, while preserving `ATH/OAK` lineage. It does not write canonical `sport_events` statuses from official shadow evidence.

SDIO-EXIT-03C repairs the remaining production divergence where the canonical `sport_events` rows already contained exact `provider_ids.mlb_stats_api` / `provider_ids.mlb_stats_game_pk` values for CHC @ KC and TB @ SEA, but the natural shadow mapper consulted only the separate `provider_entity_mappings` crosswalk before fallback matching. The matcher now treats exact embedded `sport_events.provider_ids` gamePk values as deterministic identity evidence immediately after the durable crosswalk. Multiple canonical rows claiming the same gamePk fail closed as ambiguous.

SDIO-EXIT-03C also classifies official-vs-canonical status differences in shadow metadata. Official final/live/terminal statuses paired with canonical pregame statuses remain non-authoritative during `DUAL_READ`, but are visible as safety evidence and do not promote official status writes into canonical `sport_events`.

SDIO-EXIT-03E activates natural result closure from the already-fetched MLB Official schedule payload when exact `gamePk -> sport_event` identity is proven. This is a bounded result-source authority during `DUAL_READ`, not broad `MLB_OFFICIAL_PRIMARY` promotion. The path reuses `src/services/results-sync.service.ts` to normalize final scores into the existing `game_results` contract, update the matched canonical `sport_events` row to completed, and leave settlement/learning formulas unchanged.

The result-source contract is:

1. natural Vercel scheduler executes the existing operating-day protected endpoint;
2. event-level market refresh invokes the MLB Official shadow acquisition;
3. the shadow acquisition maps official `gamePk` to canonical `sport_event` by exact crosswalk or embedded provider ID;
4. final official rows with scores are handed to the existing MLB result persistence helper;
5. `game_results` is inserted, updated, or reused idempotently by `game_id`;
6. canonical final lifecycle fields are patched only for rows whose result evidence changed;
7. existing settlement and learning close from canonical result evidence.

This avoids the previous lifecycle deadlock where canonical status stayed `scheduled`, result sync was not naturally selected, and official completed games remained visible only as shadow status differences.

## Safety

- Unknown status is not treated as safely pregame.
- Final/live/postponed/cancelled statuses use the existing MLB status mapper.
- Final result writes require exact MLB `gamePk` identity and final score evidence.
- Repeated official result closure reuses existing `game_results` rows and does not duplicate settlement or learning labels.
- Probable pitcher identity uses official MLB player ID when available.
- Missing starter remains unavailable; no name-only permanent identity is created when official ID exists.
- Team and player stats are not declared complete until feature parity is proven.
- Injury data remains non-blocking for current MLB recommendations.
