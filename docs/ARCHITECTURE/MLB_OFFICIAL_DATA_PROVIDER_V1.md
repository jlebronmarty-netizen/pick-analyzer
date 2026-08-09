# MLB Official Data Provider V1

Status: `SDIO_EXIT_03A_REPOSITORY_REPAIR_READY_FOR_NATURAL_PROOF`

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

## Safety

- Unknown status is not treated as safely pregame.
- Final/live/postponed/cancelled statuses use the existing MLB status mapper.
- Probable pitcher identity uses official MLB player ID when available.
- Missing starter remains unavailable; no name-only permanent identity is created when official ID exists.
- Team and player stats are not declared complete until feature parity is proven.
- Injury data remains non-blocking for current MLB recommendations.
