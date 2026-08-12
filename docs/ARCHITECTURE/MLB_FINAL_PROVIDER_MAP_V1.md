# MLB Final Provider Map V1

Status: `MLB_FINAL_PROVIDER_MAP_CERTIFIED`

Observation commit: `71380918b2b9e5db7e538be2b2077e7f4a5df540`

Observation time: `2026-08-12T00:46:47Z`

## Provider Authority

| Domain | Primary | Role | Evidence | Status |
| --- | --- | --- | --- | --- |
| Current sportsbook odds | The Odds API | Product price authority | `/api/operations/odds-primary-authority` reports `STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT` and `productAuthority=THE_ODDS_API` | `PASS` |
| Schedule/status/results/starters | MLB Stats API | MLB official primary | `/api/operations/mlb-official-replacement` reports `activeMode=MLB_OFFICIAL_PRIMARY` | `PASS` |
| Settlement | Canonical `game_results` | Stored result authority | `/api/operations/settlement-guarantee?includeValidation=true` reports `guarantee=PASS` | `PASS` |
| Prediction history | `prediction_history` | Current V2 production scope | `/api/performance` reports Current V2 totals only by default | `PASS` |
| Calibration | HR-03 shadow layer | Read-only shadow diagnostics | `/api/model/shadow-calibration` reports `shadowOnly=true` | `PASS_SHADOW_ONLY` |
| SportsDataIO MLB | Retained rollback only | Not routine MLB runtime authority | Operations health shows SportsDataIO daily used `0` and SDIO-EXIT-05R suppresses Stage 3 routine odds calls | `ROLLBACK_ONLY` |

## Production State

Production `/api/system/version` returned HTTP 200 for commit `71380918b2b9e5db7e538be2b2077e7f4a5df540` with `providerCallsMade=0`.

Production health reported:

| Domain | Status |
| --- | --- |
| Scheduler execution | `HEALTHY` |
| Market freshness | `HEALTHY` |
| Provider budget | `HEALTHY` |
| Settlement closure | `HEALTHY` |
| Product readiness | `HEALTHY` |

The same response keeps `operationsProductionReady=false` while `closedBetaOperationsReady=true`. This is a pilot/readiness posture distinction, not a provider-map blocker.

## SportsDataIO Retention Rule

SportsDataIO is not cancelled by this closeout. Its MLB credential, adapters, provider IDs and lineage remain available for rollback during the retained rollback window.

Routine MLB SportsDataIO calls must remain `0` while:

- `ODDS_PRIMARY_AUTHORITY_STAGE=STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT`
- `MLB_DATA_SOURCE_MODE=MLB_OFFICIAL_PRIMARY`

Manual rollback or manual diagnostics require explicit human authorization.

## Certification Boundaries

This provider map made no prediction, settlement, learning, scheduler, provider-budget or Official Pick policy changes.

MLB-FINAL-01 keeps this provider map unchanged in authority terms: The Odds API is the MLB product odds authority, MLB Official is the primary non-odds MLB source and SportsDataIO remains rollback-only.
