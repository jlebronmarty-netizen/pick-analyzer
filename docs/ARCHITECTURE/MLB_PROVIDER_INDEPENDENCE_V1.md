# MLB Provider Independence V1

Status: `SDIO_EXIT_04_STATS_PARITY_PASS_OFF_WINDOW_BLOCKED_BY_ODDS_AUTHORITY`

Observation date: 2026-08-10

Starting commit: `72e82e21db15a60032d0f06e479ee2b2eceec662`

This document records the SDIO-EXIT-02 MLB-only provider independence audit and the SDIO-EXIT-03 official MLB replacement implementation. It does not cancel SportsDataIO, does not promote The Odds API, does not change model formulas and does not make provider calls. The goal is to identify which MLB runtime domains can already run without SportsDataIO, which can degrade from stored data, and which remain cancellation blockers.

SDIO-EXIT-03 update: `src/services/mlb-official-data-provider.service.ts` centralizes MLB Stats API schedule/status/probable-pitcher normalization, `src/services/mlb-official-replacement.service.ts` builds additive canonical event/team/player/starter mapping rows, and `/api/operations/mlb-official-replacement` exposes read-only replacement status. This makes schedule, event identity and starter replacement ready for shadow observation, but full cancellation remains blocked by natural shadow proof, ODDS-03C promotion, team/player stat feature parity and one SportsDataIO-off operating window.

## Executive Verdict

MLB is not yet fully SportsDataIO-independent.

Historical replay and current MLB result ingestion are already independent of SportsDataIO. Current odds are in dual-read migration, but SportsDataIO remains the production product odds authority. Schedule, event identity, starter evidence, provider-player identity, player stats and some future feature refresh paths still depend on SportsDataIO lineage or SportsDataIO-backed ledgers.

Final SDIO-EXIT-02 classification: `MLB_SPORTSDATAIO_EXIT_PARTIAL`.

## Replacement State By Domain

| Domain | Current SportsDataIO Runtime Dependency | Replacement State | SDIO-EXIT-02 Classification |
| --- | --- | --- | --- |
| Historical data | None required for certified historical replay assets | Retrosheet and stored historical feature snapshots | `PASS` |
| Odds | `canonical-acquisition.service.ts` active SportsDataIO `GameOddsByDate` product-authority writer | The Odds API is deployed as shadow dual-read only | `PARTIAL_ODDS_03C_WAIT` |
| Schedule | SportsDataIO `GamesByDate` / stored `sport_events` are still the slate foundation | MLB Stats API status endpoint can read schedule-shaped data, but slate discovery replacement is not integrated | `BLOCKED` |
| Event identity | SportsDataIO IDs remain embedded in `sport_events.provider_ids` and provider mappings | The Odds API crosswalk exists for odds, MLB Stats API IDs are written by status/results paths | `PARTIAL` |
| Start time | Stored event rows and provider IDs remain canonical | MLB Stats API exposes game dates in status/results paths | `PARTIAL_NOT_SCHEDULE_PRIMARY` |
| Event status | Current protected `status_refresh` uses MLB Stats API | DB-safe status mapper certified for MLB Stats API statuses | `PASS_FOR_STATUS_REFRESH` |
| Results/final score | Current MLB result sync uses MLB Stats API | `results-sync.service.ts` persists canonical `game_results` | `PASS_FOR_CURRENT_MLB_RESULTS` |
| Settlement | Uses persisted `game_results`, prediction line identity and stored event status | Compatible with MLB Stats API results | `PASS_DEPENDS_ON_RESULT_IMPORT` |
| Starting pitchers | `mlb-starter-sync.service.ts` reads stored `sport_lineups` and SportsDataIO GamesByDate ledger evidence | No integrated MLB Stats API probable-pitcher persistence path yet | `BLOCKED_CRITICAL` |
| Team stats | Historical snapshots and `team_stats` exist; current sync path uses `API_SPORTS_KEY`, not SportsDataIO | Needs feature parity certification before SportsDataIO removal | `PARTIAL` |
| Team game stats | SportsDataIO historical/import executor supports team game stats | Internal derivation from final results is possible but not implemented as a production refresh replacement | `BLOCKED_FOR_FEATURE_REFRESH` |
| Player roster | SportsDataIO player IDs remain primary lineage in player tables and mappings | MLB Stats API/official roster crosswalk not implemented | `BLOCKED_CRITICAL` |
| Player stats | SportsDataIO historical/import paths and stored player stats exist | Retrosheet covers historical replay; current/future official player stat refresh not implemented | `BLOCKED_FOR_PROPS_AND_PLAYER_MODELS` |
| Player game stats | SportsDataIO and Retrosheet historical paths exist | Current production replacement not integrated | `BLOCKED_FOR_PLAYER_MODELS` |
| Bullpen | Mostly derived/stored feature evidence today | Future live bullpen refresh depends on player/team stat replacement | `PARTIAL_STORED_ONLY` |
| Injuries | Not a current MLB official-pick requirement | No reliable free public production replacement certified | `NOT_REQUIRED_CURRENT_PRODUCTION` |
| Lineups | Lineup foundation exists; starter handling is the critical subset | No certified current lineup source replacement | `FOUNDATION_ONLY_BLOCKED_FOR_LINEUP_AWARE_MODELS` |
| Standings | SportsDataIO catalog/import paths exist; current team stats path uses API Sports | Not critical for current official-pick policy, but replacement source must be certified if used | `PARTIAL` |
| Provider mapping | SportsDataIO IDs must remain for lineage | Cross-provider mapping must be additive | `RETAIN_LINEAGE` |

## Historical Independence

Certified historical assets remain independent and must not be re-imported by this phase:

- 2,430 historical MLB games.
- 70,470 historical feature snapshots.
- 7,290 historical replay predictions.

Classification: `HISTORICAL_DEPENDENCY_REMOVED`.

## MLB Stats API Replacement Coverage

The repository already contains production paths using MLB Stats API:

- `src/services/operating-day.service.ts` uses `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=...&hydrate=probablePitcher,team,venue` for protected `status_refresh`.
- `src/services/results-sync.service.ts` uses `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=...&endDate=...&hydrate=team,venue` for MLB result sync.
- `src/services/mlb-event-status-mapper.service.ts` maps MLB Stats API statuses to constrained `sport_events.status` values.

Those paths prove status and result replacement viability, not full schedule/starter/player/stat independence.

## SportsDataIO-Off Simulation

| Pipeline Step | Classification | Reason |
| --- | --- | --- |
| Existing homepage/current-board reads | `PASS_FROM_STORED_DATA` | Stored predictions and odds render until freshness gates block actionability. |
| Active market refresh | `BLOCKED` | SportsDataIO remains product odds authority while ODDS-03C waits for multi-event proof. |
| The Odds API shadow acquisition | `PASS_SHADOW_ONLY` | ODDS-03A natural dual-read stores non-authoritative shadow rows. |
| New slate discovery | `BLOCKED` | No production-integrated non-SportsDataIO slate discovery writer exists. |
| Status refresh | `PASS_WITH_REPLACEMENT` | MLB Stats API path exists and maps DB-safe statuses. |
| Result import | `PASS_WITH_REPLACEMENT` | MLB Stats API path exists for final scores. |
| Settlement | `PASS_WITH_REPLACEMENT` | Uses canonical result rows, not SportsDataIO directly. |
| Learning/performance | `PASS_FROM_STORED_DATA` | Derived from settled predictions. |
| Starter feature refresh | `BLOCKED` | Existing starter sync still reads SportsDataIO GamesByDate ledger evidence. |
| Team/player stat refresh | `GRACEFUL_DEGRADE_OR_BLOCKED` | Stored/historical data can be read; current feature refresh parity not certified. |
| Injury/lineup-aware modeling | `GRACEFUL_DEGRADE` | Not required for current official-pick policy; future feature use remains blocked. |

## Source Mode Recommendation

Do not switch to `PUBLIC_MLB_PRIMARY` in this phase.

Recommended future staged config:

| Mode | Product Use | Purpose |
| --- | --- | --- |
| `SPORTSDATAIO` | Current fallback/rollback for MLB odds and SportsDataIO-backed data | Preserve existing behavior. |
| `DUAL_READ` | Current ODDS-03A state for odds; future status/stats replacements can be shadowed | Compare public MLB/The Odds API against stored SportsDataIO-era behavior. |
| `PUBLIC_MLB_PRIMARY` | Future, after SDIO-EXIT-03/04/05 pass | Use MLB Stats API/internal derived data for schedule/status/results/stats where certified. |

## Cancellation Gates

| Gate | Status | Evidence |
| --- | --- | --- |
| Historical independence | `PASS` | Stored historical replay assets certified. |
| Odds replacement | `PARTIAL` | ODDS-03A dual-read deployed; ODDS-03C waits for multi-event window. |
| Schedule replacement | `BLOCKED` | `morning_sync` still routes through SportsDataIO prospective preview. |
| Status replacement | `PASS` | Protected MLB Stats API status refresh exists. |
| Results replacement | `PASS` | MLB Stats API result sync exists. |
| Settlement replacement | `PASS` | Settlement consumes canonical result rows. |
| Starter replacement | `BLOCKED` | Starter sync depends on SportsDataIO GamesByDate ledger or stored rows. |
| Team stats replacement | `PARTIAL` | Existing `API_SPORTS_KEY` team stats path is separate but not feature-parity certified. |
| Player stats replacement | `BLOCKED` | Current/future player stat refresh replacement not implemented. |
| Injuries replacement or not required | `NOT_REQUIRED_CURRENT_PRODUCTION` | No current MLB official-pick dependency proven. |
| Lineups replacement or not required | `PARTIAL` | Full lineups not current official-pick critical; starters remain blocked. |
| Daily autonomy | `PARTIAL` | Vercel scheduler active; full no-SportsDataIO day not certified. |
| Provider fail-closed | `PARTIAL` | Stored reads fail closed; schedule/starter/stat replacement still incomplete. |
| Rollback | `PASS` | SportsDataIO code and provider IDs retained. |
| Multi-sport isolation | `PASS_FOR_MLB_SCOPE` | MLB key is isolated, but account-level cancellation remains unresolved. |

## Non-Negotiable Safety Result

- SportsDataIO calls during this certification: 0.
- The Odds API manual calls during this certification: 0.
- Database mutations during this certification: 0.
- SportsDataIO cancellation: not performed.
- ODDS authority promotion: not performed.
- HR-03 calibration mode: remains shadow only.
- MC-03: not started.
