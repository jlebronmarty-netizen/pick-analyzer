# NBA Data Foundation V1

Status: `NBA_DATA_FOUNDATION_PARTIAL_MORE_IMPORT_REQUIRED`

Certification commit: `bf89777ad5f97f8e7fb40ac1835b29424182ca20`

NBA-01 audits and preserves the existing NBA foundation. It does not rebuild NBA, call providers, mutate production data, generate historical predictions or activate NBA production surfaces.

## Existing Foundation Classification

| Subsystem | Status | Action |
| --- | --- | --- |
| NBA Data Sync V1 | `STILL_VALID_PARTIAL` | `REUSE_WITH_CERTIFICATION` |
| NBA Prediction Engine V1 | `STILL_VALID_PREVIEW` | `REUSE_WITH_CERTIFICATION` |
| NBA Settlement V1 | `STILL_VALID_TRIAL_SCOPE` | `REUSE_WITH_CERTIFICATION` |
| Model Health V2 | `STILL_VALID_WATCH` | `REUSE_WITH_CERTIFICATION` |
| Backtesting / Calibration | `STILL_VALID_TRIAL_ONLY` | `REUSE_WITH_CERTIFICATION` |
| Feature Store | `STILL_VALID_PARTIAL` | `REUSE_WITH_CERTIFICATION` |
| Current Board | `NOT_PRODUCTION_ACTIVATED` | `EXTEND_LATER` |
| Performance | `TRIAL_SCOPE_ONLY` | `EXTEND_LATER` |
| Scheduler | `CONTRACT_EXISTS_NOT_ACTIVATED` | `PLAN_ONLY` |

## Stored Data Evidence

Production read-only NBA endpoints report:

| Dataset | Rows / Status | Certification |
| --- | ---: | --- |
| Teams | 30 / 30 | `GREEN` |
| Players | 579 | `YELLOW` |
| Events | 14 | `YELLOW_TRIAL_SAMPLE` |
| Completed games | 13 | `YELLOW_TRIAL_SAMPLE` |
| Game stats | 9 of expected 13 in coverage endpoint | `YELLOW` |
| Player stats | 918 | `YELLOW_TRIAL_SAMPLE` |
| Injuries | 6 | `YELLOW_SOFT_CONTEXT` |
| Lineups | 758 | `YELLOW_TRIAL_SAMPLE` |
| Standings | 30 | `GREEN_FOR_SAMPLE` |
| Odds snapshots | 0 in coverage endpoint; legacy docs record 540 trial odds rows | `RED_FOR_REPLAY_PRICE` |
| Predictions | 27 trial/non-production | `YELLOW_TRIAL_ONLY` |
| Settled predictions | 27 trial/non-production | `YELLOW_TRIAL_ONLY` |
| Feature snapshots | 47 trial snapshots | `YELLOW_TRIAL_ONLY` |
| Production-eligible feature snapshots | 0 | `RED_FOR_PRODUCTION_REPLAY` |

## Canonical Identity

| Domain | Status |
| --- | --- |
| Team identity | 30/30 canonical teams exist |
| Player identity | 579 players exist, but broader official ID coverage needs import review |
| Event identity | 14 event sample exists; full season mapping not certified |
| Provider mappings | Existing mapping evidence is large enough for sample validation, but full official crosswalk is not certified |

Production settlement and replay must not use name-only identity. Exact provider or deterministic canonical crosswalks are required.

## Source Access Boundary

NBA-01 identifies official/free NBA sources as the target non-odds strategy but does not bulk import from them because public access, rate behavior and terms must be reviewed before historical ingestion.

No new paid subscription is required or added in NBA-01.

## NBA-01A Bootstrap Addendum

NBA-01A does not change the stored row counts. It adds a deterministic path to convert the partial foundation into a replay-ready foundation:

| Area | NBA-01A Result |
| --- | --- |
| Stat source | NBA Stats public endpoint family selected as primary candidate pending access/terms review |
| Historical odds | The Odds API selected for core price history pending explicit credit budget |
| Initial season | 2024-25 regular season |
| Core markets | Moneyline, Spread, Total |
| First-half markets | deferred until period-score and provider market coverage are certified |
| Props | deferred; no historical prop backfill recommended |
| Import status | no import executed in NBA-01A |
| Production activation | still inactive |

The foundation remains `PARTIAL_MORE_IMPORT_REQUIRED` until a full target-season schedule, result, period-score, boxscore, team-stat and player-stat import is authorized and completed.
