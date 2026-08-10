# MLB Final Provider Map V1

Status: `DRAFT_READY_AFTER_SDIO_EXIT_04`

This is the target provider map after SportsDataIO MLB exit. It is not a statement that SportsDataIO has been cancelled.

| Domain | Final Primary Source | Current State | Rollback |
| --- | --- | --- | --- |
| Odds, moneyline/run line/total | The Odds API certified book set | Shadow dual-read, SportsDataIO product authority | SportsDataIO retained. |
| Market exact-line binding | Stored canonical odds snapshots with source timestamp | Exact-line policy deployed | Existing SportsDataIO snapshots retained. |
| Schedule | MLB Official Stats API schedule | Shadow parity-review ready | SportsDataIO event IDs retained. |
| Event identity | Canonical `sport_events` plus MLB gamePk mappings | 15/15 natural mapping certified | Provider mappings retained. |
| Status | MLB Official status mapper | Active shadow/readiness path | Stored status guarded. |
| Results/final score | MLB Official result sync | Natural result insertion certified | Existing `game_results` retained. |
| Settlement | Canonical result and prediction line identity | Provider independent | Existing settlement policy retained. |
| Learning | Settled prediction evidence | Provider independent | Existing learning policy retained. |
| Probable starters | MLB Official probablePitcher | 30/30 mapping certified | Retained SportsDataIO starter lineage. |
| Team aggregates | Internal completed-game history and stored team stats | Current production no routine SportsDataIO calls | Stored tables retained. |
| Player stats | Stored/future official source | Foundation only, not current production-critical | Stored tables retained. |
| Bullpen | Internal derived/stored workload when certified | Not current production-critical | Fail closed to unavailable. |
| Lineups | Future official lineup source | Not current production-critical beyond starters | Fail closed to unavailable. |
| Injuries | Future injury provider if approved | Not current production-critical | Fail closed to unavailable. |
| Historical replay | Persisted historical data + Retrosheet | Independent | Immutable evidence retained. |

## Current Commercial Decision

Do not cancel SportsDataIO yet. The final blocker is not MLB result/status/starter parity; it is routine product odds authority. Cancellation becomes ready only after the odds authority promotion and a natural SportsDataIO-off window prove zero MLB SportsDataIO calls.
