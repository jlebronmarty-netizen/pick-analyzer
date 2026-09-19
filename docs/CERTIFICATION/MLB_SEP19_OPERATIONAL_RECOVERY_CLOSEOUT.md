# MLB Operational Recovery Closeout — 2026-09-19

Status: `RESOLVED / NORMAL DAILY AUTOMATION RESTORED`

## 1. R6 `/api/cron/mlb-operational` recurring 503

Seven historical RUN rows existed with `status=FAILED`.

The current Supabase runtime authority already excluded six rows whose checkpoint disposition was:

`TERMINAL_PARTIAL_PRESERVED`

The remaining blocker was the Sep13 run:

`automation-884fdb346cfc5de32eae2b9b7362f6a24e8cd93e76abde08b770841b3d74aa39`

It was reviewed before disposition:

- run date: 2026-09-13
- failure: `DEPENDENCY_READ_FAILURE`
- failure stage: `SCOPE`
- scoped games: 14
- expired scoped games at review: 14/14
- frozen prediction rows: 0
- DML stages: 0
- Odds calls: 0
- Statcast calls: 0
- MLB Official calls: 1
- active lease: none

The row was not deleted. A fail-closed terminal disposition preserved the original failure, lineage, accounting and provider reservation.

Final historical census after closeout:

- FAILED RUN rows: 7
- FAILED + `TERMINAL_PARTIAL_PRESERVED`: 7
- authority-pending historical RUNs: 0

### Production proof

The first post-closeout Sep19 PREGAME run:

`automation-fafc660b461937eb95e71e5cfc1ddbe4fe34dc7fe8557fc5702e62b3c9fab920`

completed successfully with:

- status: `COMPLETE`
- failure: none
- 15 MLB games inserted
- readback: PASS

Subsequent Sep19 automation also created fresh INCREMENTAL, POSTGAME and PREGAME runs, proving the historical `AMBIGUOUS_PENDING_RUN` blocker was removed.

## 2. Statcast daily Sep18 recovery

The normal `/api/cron/mlb-statcast-daily` route returned HTTP 500 during its Sep18 catch-up attempts.

Independent checks confirmed:

- MLB Official Sep18 schedule: 15/15 games Final
- Baseball Savant source: HTTP 200
- source pitch rows: 4,541
- source games: 15
- all 15 official gamePk values present

A bounded one-shot repair ran under:

`mlb_statcast_sep18_one_shot_repair_v1`

Ledger:

`f72f95aa-efdc-406b-b5cb-37b9384f0041`

Result:

- status: completed
- target date: 2026-09-18
- Statcast source rows: 4,541
- inserted: 4,541
- reuses: 0
- conflicts: 0
- unexpected existing rows: 0
- source games: 15
- official final games: 15
- analytics refresh: success
- readiness: `DAILY_HISTORY_READY`
- stored rows: 4,541
- stored games: 15
- missing gamePk: 0
- unexpected gamePk: 0
- exact coverage: true
- analytics max game date: 2026-09-18
- sportsbook calls: 0
- historical Odds calls: 0
- Official Picks modified: false
- APOSTAR activated: false

The original 500 did not reproduce in the exact-date repair. The available evidence therefore supports a transient failure in the earlier daily execution rather than a persistent schedule, source-coverage, identity, or stored-data conflict. The repair route and cron were removed immediately after successful readback.

## 3. PA-12 Pitcher ER forward shadow

Sep18 settlement:

- model: `MLB_PITCHER_ER_PA12_FORWARD_SHADOW_V2`
- scored rows: 23
- MAE: 1.573805682351435
- RMSE: 2.018516345976814
- bias: -0.3449425144114985
- correlation: 0.14538181174077733
- average prediction: 2.350709659501545
- average actual: 2.6956521739130435

No retuning or probability calibration is authorized from this single day.

Sep19 fixed-clock freeze:

- frozen at 2026-09-19T14:45:53.723Z
- targets: 26
- eligible: 26
- blocked: 0
- status: `AWAITING_FINAL_OUTCOMES`

## 4. Run Line V2 forward shadow

Sep19 produced the first valid fixed-clock prospective freeze for:

`rl_v2_home_p15_alt_favorite_tsh_q92_v1`

- frozen at: 2026-09-19T14:46:18.538Z
- slate games: 15
- mapped events: 14
- component-complete: 15
- market-eligible: 6
- selected games: 0
- errors: 0

This is a valid no-selection observation, not a failed date.

## 5. Boundaries unchanged

- Official Picks untouched
- APOSTAR inactive
- no model retuning from forward evidence
- PA-12 probability layer unauthorized
- PA-12 market recommendations unauthorized
- PA-12 production eligibility false
- Run Line production eligibility false
- historical Pitcher ER ROI/CLV/EV still uncertified

Next valid work is continued fixed-clock forward accumulation and exact settlement.
