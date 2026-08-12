# NBA Historical Readiness V1

Status: `NBA_HISTORICAL_REPLAY_NOT_READY_MORE_IMPORT_REQUIRED`

NBA-01 prepares the historical-readiness contract. It does not execute historical replay.

## Target Seasons

Initial target: 2024-25 completed NBA season plus 2025-26 current-season scaffolding after source access is approved.

The current stored sample is not a full season:

| Season Scope | Events | Results | Stats | Odds | Classification |
| --- | ---: | ---: | ---: | ---: | --- |
| Stored sample | 14 | 13 completed event sample; canonical result coverage not production-certified | Partial | 0 certified price rows in coverage endpoint | `PARTIAL` |
| 2024-25 target | To import | To import | To import | Not approved | `MISSING` |
| 2025-26 target | To import when season data is available | To import | To import | Future live odds only after authorization | `MISSING` |

## Schedule And Status Contract

Canonical NBA event statuses:

- `scheduled`: event has not started.
- `live`: event is in progress.
- `completed`: final score is authoritative.
- `postponed`: event is delayed to a later date and must not settle.
- `cancelled`: event is void for settlement.

Rescheduled and suspended states must preserve original provider identity and source timestamps before any production use. NBA-01 does not activate a status authority; it documents the target contract for NBA-02 import validation.

## Replay Readiness Matrix

| Market | Eligible Seasons | Eligible Events | Feature Ready | Result Ready | Price Ready | Settlement Ready | Replay Type |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| Moneyline | Sample only | 14 sample events | Partial/trial | Partial/trial | No | Trial settlement exists | `PARTIAL_REPLAY` |
| Spread | Sample only | 14 sample events | Partial/trial | Partial/trial | No | Trial settlement exists | `PARTIAL_REPLAY` |
| Total | Sample only | 14 sample events | Partial/trial | Partial/trial | No | Trial settlement exists | `PARTIAL_REPLAY` |
| First Half Moneyline | None certified | 0 | No | Needs period scores | No | Not certified | `BLOCKED` |
| First Half Spread | None certified | 0 | No | Needs period scores | No | Contract exists, data not certified | `BLOCKED` |
| First Half Total | None certified | 0 | No | Needs period scores | No | Contract exists, data not certified | `BLOCKED` |

Historical odds do not need 100% coverage for future `MODEL_REPLAY`, but current NBA history is still insufficient for leakage-safe replay because full schedule, canonical result, team/player stat and feature reconstruction coverage are incomplete.

## NBA-02 Target

NBA-02 should be:

`NBA-02_COMPLETE_HISTORICAL_FEATURE_RECONSTRUCTION_AND_REPLAY`

Prerequisites:

- approved official/free source access;
- full target-season schedule/results import;
- team-game and player-game stat import;
- deterministic team/player/event crosswalks;
- period-score coverage for first-half markets;
- pregame-safe feature reconstruction;
- replay isolation from Current Era, Current Board, Official Picks, Performance defaults and learning;
- no historical odds fabrication.

Recommended first replay scope after import:

| Scope | Value |
| --- | --- |
| Seasons | 2024-25 completed season first |
| Markets | Moneyline, Spread, Total |
| First-half markets | Block until period-score coverage and feature contract pass |
| Replay type | `MODEL_REPLAY` first; `PRICE_AWARE_REPLAY` only after legitimate historical odds are approved |
| Batch strategy | dry-run, season/date cursor, checkpoint/resume, idempotent deterministic keys |

## NBA-01A Replay Cohort Update

NBA-01A separates replay into two cohorts:

| Cohort | Requirement | Current Status |
| --- | --- | --- |
| `MODEL_REPLAY` | complete schedule/results/team stats/player stats/boxscores with pregame-safe feature reconstruction | blocked by stat-source access/import |
| `PRICE_AWARE_REPLAY` | model replay plus legitimate pregame historical odds snapshots | blocked by odds budget/import |

The first deterministic target is 2024-25 regular-season `MODEL_REPLAY` for Moneyline, Spread and Total. `PRICE_AWARE_REPLAY` should begin with a one-daily-card-snapshot strategy only after explicit The Odds API historical budget approval.

NBA-02 must not use final result, target-game boxscore, target-game player stat, post-start odds, current injuries or future lineups as pregame inputs. Feature snapshots must be versioned and checkpointed by season, event, market, prediction cutoff, model version and feature-set version.
