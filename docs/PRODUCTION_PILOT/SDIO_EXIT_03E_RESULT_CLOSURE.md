# SDIO-EXIT-03E Result Closure

Status: `SDIO_EXIT_03E_REPAIR_READY_FOR_NATURAL_PROOF`

Starting commit: `fd861f6ca0a4b4afc0c73c1a1de8cc002c19c66e`

## Scope

SDIO-EXIT-03E investigates why MLB Official natural shadow runs proved completed games but canonical `game_results` stayed empty for those events. It does not promote `MLB_OFFICIAL_PRIMARY`, disable SportsDataIO, promote odds authority, change prediction formulas, change Official Pick policy, change settlement formulas, or create retrospective predictions.

## Baseline Evidence

SDIO-EXIT-03D certified MLB Official schedule/status mapping at 15/15 with 0 ambiguous events, 0 duplicate events, and 30/30 starter mappings. It also found:

| Evidence | Count |
| --- | ---: |
| Official completed games | 14 |
| Canonical `game_results` rows before final observation | 0 / 14 |
| Missing canonical results before final observation | 14 |
| Pending mapped predictions | 89 |

CHC @ KC mapped as `824078 -> baseball_mlb:mlb:sportsdataio:event:79060` with no result row and 6 pending predictions.

TB @ SEA mapped as `823104 -> baseball_mlb:mlb:sportsdataio:event:79066` with no result row and 4 pending predictions.

Production job evidence showed repeated natural `sdio_exit_03a_mlb_official_shadow_v1` runs. These jobs wrote provider mappings and status-difference metadata, but their metadata contained no `resultClosure` section and no result row counts. No natural `sync_results` job was selected in the same immediate shadow-observation window.

A later production read on the unchanged deployed commit showed normal result closure had eventually run: 14 canonical `game_results` rows were present, CHC @ KC and TB @ SEA had correct result rows, and 81 of 89 mapped predictions had settled. This proves the issue was not an absolute permanent deadlock. It was a shadow-path write gap and closure delay while the system waited for the separate result-sync path.

## Root Cause

Classification: `RESULT_CLOSURE_SHADOW_WRITE_PATH_NOT_EXECUTED`.

The existing MLB result sync implementation can write `game_results` and patch canonical final lifecycle from MLB Stats API evidence. Production later proved that path can close this slate. However, the natural event-level scheduler path invoked only:

- SportsDataIO canonical market acquisition;
- The Odds API shadow odds acquisition;
- MLB Official schedule/status/starter shadow acquisition.

The MLB Official path proved final status and exact identity, but did not hand final rows to the existing result persistence contract. Meanwhile canonical events remained `scheduled`, so result debt stayed outside the active natural action selected during market-refresh windows.

In short:

`official completed evidence -> shadow metadata only -> wait for later sync_results -> delayed game_results -> delayed settlement`.

## Repair

`src/services/results-sync.service.ts` now exposes `syncMlbStatsResultsFromOfficialGames`.

The helper:

- accepts already-fetched MLB Official schedule rows;
- requires an exact `gamePk -> sport_event` identity map when supplied;
- normalizes final scores into the existing `game_results` row shape;
- inserts, updates, or reuses rows by `game_id`;
- patches canonical `sport_events` only when result evidence is inserted or changed;
- reports inserted, updated, reused, and event-row update counts;
- makes 0 additional provider calls.

`src/services/mlb-official-replacement.service.ts` now calls that helper after exact mapping rows are prepared during natural `DUAL_READ` shadow acquisition. The official result source is explicitly scoped as `MLB_OFFICIAL_RESULT_SOURCE_DUAL_READ`.

## Safety

| Guardrail | Status |
| --- | --- |
| SportsDataIO remains enabled | PASS |
| MLB Official broad primary promotion | NOT PERFORMED |
| Odds authority promotion | NOT PERFORMED |
| Prediction formulas changed | NO |
| Official Pick policy changed | NO |
| Settlement formulas changed | NO |
| Learning weights changed | NO |
| Retrospective predictions created | NO |
| Post-start predictions created | NO |
| Result writes require final score evidence | PASS |
| Exact `gamePk` identity required | PASS |
| Duplicate result rows prevented | PASS |

## Natural Proof Gate

The repair is local/runtime-ready only until deployed and observed through normal Vercel scheduler activity.

Promotion verdict remains `MLB_RESULT_CLOSURE_PASS_MORE_OBSERVATION_REQUIRED` until natural proof shows:

- official completed games close into canonical `game_results` during the natural shadow acquisition window or are reused if already closed by the existing sync path;
- CHC @ KC and TB @ SEA close by exact `gamePk`;
- no duplicate results;
- no wrong-event results;
- pending predictions become settlement-eligible through the existing settlement path;
- learning labels do not duplicate;
- scheduler and settlement remain healthy;
- SportsDataIO rollback remains available.
