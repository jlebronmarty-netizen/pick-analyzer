# SDIO-EXIT-03 MLB Official Replacement

Status: `SDIO_EXIT_03_PARTIAL_READY_FOR_SHADOW_OBSERVATION`

Starting commit: `a524148d6aef062438d0e42d88b06186b88761fa`

## Verdict

SDIO-EXIT-03 implements the first centralized official MLB replacement path and a SportsDataIO-off dry-run fixture. It does not make MLB SportsDataIO cancellation ready yet.

The new official MLB adapter covers schedule, lifecycle status and probable pitcher normalization from MLB Stats API. It adds an explicit MLB data-source mode contract and a read-only operations route for replacement readiness. Team/player stat replacement remains partial because current model feature semantics still need parity proof before promotion.

## Replacement Status

| Domain | Status | Evidence |
| --- | --- | --- |
| Official MLB adapter | `PASS` | Central service exists with timeouts and deterministic normalization. |
| Schedule replacement | `READY_FOR_SHADOW` | Schedule row builder maps official `gamePk` to canonical event IDs. |
| Event identity | `READY_FOR_SHADOW` | Provider mappings are additive and preserve SportsDataIO IDs. |
| Doubleheader safety | `PASS_FIXTURE` | Fixture preserves `gameNumber` and `doubleHeader`. |
| Status replacement | `PASS` | Existing MLB status mapper is reused. |
| Postponement safety | `PASS_BY_MAPPER` | Non-final/suspended/cancelled states fail closed through mapper policy. |
| Results replacement | `PASS_EXISTING` | Existing result sync already uses MLB Stats API. |
| Settlement | `PASS_EXISTING` | Settlement consumes canonical `game_results`. |
| Starter replacement | `READY_FOR_SHADOW` | Probable pitchers normalize from official player IDs into starter lineup rows. |
| Starter mapping | `READY_FOR_SHADOW` | Official player IDs map to additive `provider_entity_mappings`. |
| Starter change handling | `PARTIAL` | A deterministic starter change key exists; production regeneration is not activated. |
| Roster replacement | `BLOCKED_FUTURE` | Roster endpoint ingestion is not required for current starter fixture and remains a gate. |
| Player stats replacement | `MORE_OBSERVATION_REQUIRED` | Do not replicate unused SportsDataIO fields. |
| Player game stats | `MORE_OBSERVATION_REQUIRED` | Requires boxscore/stat parity before promotion. |
| Team game stats | `MORE_OBSERVATION_REQUIRED` | Future boxscore-derived ingestion needed. |
| Team aggregate stats | `PARTIAL` | Existing API Sports/internal stored data remains separate; semantic parity is not complete. |
| Bullpen | `PARTIAL_STORED_ONLY` | Depends on player/team pitching inputs. |
| Standings | `NOT_REQUIRED_CURRENT_EXIT` | Not a critical current official-pick blocker. |
| Lineups | `NOT_REQUIRED_EXCEPT_STARTERS` | Full batting lineup ingestion is not built. |
| Injuries | `NOT_REQUIRED_CURRENT_PRODUCTION` | SDIO-EXIT-02 conclusion preserved. |

## SportsDataIO-Off Dry Run

Fixture classification:

| Step | Classification |
| --- | --- |
| schedule | `PASS_WITH_OFFICIAL_MLB` |
| event identity | `PASS_WITH_OFFICIAL_MLB` |
| status | `PASS_WITH_OFFICIAL_MLB` |
| starters | `PASS_WITH_OFFICIAL_MLB` |
| team stats | `GRACEFUL_DEGRADE` |
| player stats | `GRACEFUL_DEGRADE` |
| odds path metadata | `PASS_FROM_STORED_DATA` |
| prediction prerequisites | `GRACEFUL_DEGRADE` |
| result import | `PASS_WITH_OFFICIAL_MLB` |
| settlement prerequisites | `PASS_FROM_STORED_DATA` |

No critical fixture step is silently fabricated.

## Scheduler Integration

The existing Vercel operating-day scheduler remains the only scheduler. SDIO-EXIT-03 introduces replacement readiness through `/api/operations/mlb-official-replacement`, but it does not activate production writes from that route. Future integration should add a bounded planner action only after natural shadow evidence proves schedule/starter/stat parity.

## Remaining Critical Gates

- ODDS-03C multi-event natural proof and explicit promotion authorization.
- Natural official MLB schedule shadow observation across real slates.
- Starter identity coverage across real slates.
- Team-game and player-game stat feature parity.
- Roster crosswalk for future player/starter models.
- One SportsDataIO-off natural operating window.

## Safety Accounting

- SportsDataIO manual calls: 0.
- The Odds API manual calls: 0.
- MLB Stats API calls during certification: 0.
- Database mutations during certification: 0.
- SportsDataIO disabled/cancelled: false.
- Odds authority promoted: false.
- Prediction formulas changed: false.
- Official Pick policy changed: false.
- HR-04, Player Props and MC-03: not started.

Final classification: `SDIO_EXIT_03_PARTIAL_READY_FOR_SHADOW_OBSERVATION`.
