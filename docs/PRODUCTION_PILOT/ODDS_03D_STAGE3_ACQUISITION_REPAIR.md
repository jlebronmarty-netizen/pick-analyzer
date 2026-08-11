# ODDS-03D Stage 3 Acquisition Repair

Status: `ODDS_03D_STAGE3_ACQUISITION_REPAIR_READY_FOR_DEPLOYMENT`

## Rollback Certification

Production was manually rolled back to `STAGE_1_DUAL_READ` by configuration and redeployed on commit `89c7a653d8da3a52e6250d8033a86c42cd6f4935`.

Read-only production evidence:

| Check | Result |
| --- | --- |
| `/api/system/version` | HTTP 200, commit `89c7a653d8da3a52e6250d8033a86c42cd6f4935`, provider calls `0` |
| `/api/operations/odds-primary-authority` | `STAGE_1_DUAL_READ`, product authority `SPORTSDATAIO`, The Odds API shadow-only |
| `/api/operations/health` | `DEGRADED`; scheduler `HEALTHY`, settlement `HEALTHY`, market freshness `DEGRADED`, provider budget `HEALTHY` |
| `/api/operations/settlement-guarantee?includeValidation=true` | `PASS`, settled rows `173`, ready rows `0`, blocked rows `0`, silent pending `0` |
| `/api/current-board?mode=current&limit=200` | SportsDataIO restored as product authority; stale rows fail closed as `WAIT_FOR_REFRESH` |

Certification reads made zero provider calls and zero production database mutations.

## Proven Root Cause

ODDS-03D production Stage 3 proof showed that product authority could read stored The Odds API evidence, but natural Stage 3 acquisition did not execute.

Repository cause:

`src/services/the-odds-api-current-odds-acquisition.service.ts` guarded natural The Odds API acquisition with a Stage 1-only branch:

`authority.stage !== 'STAGE_1_DUAL_READ' -> SKIPPED_STAGE_NOT_DUAL_READ`

The adaptive refresh orchestrator still invoked this shared acquisition service, so `STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT` skipped instead of acquiring fresh product-primary odds.

Classification: `STAGE_3_AUTHORITY_NOT_WIRED_TO_ACQUISITION`.

## Repair

The repair keeps one shared league-wide The Odds API acquisition primitive and makes stage semantics explicit.

Stage behavior:

| Stage | SportsDataIO | The Odds API | Product authority | R2 writer |
| --- | --- | --- | --- | --- |
| `STAGE_0_SPORTSDATAIO_AUTHORITY` | Product authority | Not acquired by this path | SportsDataIO | Non-persistent |
| `STAGE_1_DUAL_READ` | Product authority | Shadow acquisition executes | SportsDataIO | Non-persistent would-write |
| `STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT` | Rollback/context only | Product-primary acquisition executes | The Odds API | Persistent-capable when all gates pass |

The acquisition remains bounded to one MLB league-wide request per eligible 10-minute dedupe window and still uses h2h, spreads, and totals only. There is no per-event fanout and no per-book fanout.

Stage 3 provider accounting writes a distinct job type:

`odds03d_stage3_product_primary_v1`

Stage 1 keeps:

`odds03a_natural_dual_read_v1`

Persisted odds metadata now reflects the active authority:

| Field | Stage 1 | Stage 3 |
| --- | --- | --- |
| `authorityStatus` | `SHADOW_NON_AUTHORITATIVE` | `PRODUCT_AUTHORITATIVE` |
| `productPriceAuthority` | `false` | `true` |
| `productionAuthority` | `false` | `true` |
| `validation_status` | `shadow` | `product_primary` |
| `production_eligible` | `false` | `true` |

## Safety

- Stage 3 is not re-promoted by this commit.
- SportsDataIO remains enabled and available for rollback.
- MLB data-source mode remains unchanged.
- Official Pick thresholds remain unchanged.
- HR-03 calibration remains `SHADOW_ONLY`.
- Settlement, learning, ranking, probability, confidence, Kelly, Rent Play, Moneyline, Smart Parlay, and Performance policies are unchanged.
- If fresh exact-line evidence is unavailable, product surfaces must continue to fail closed.

## Deployment Gate

After deployment, Stage 3 re-promotion still requires explicit human authorization and a new production observation window proving:

- a natural `odds03d_stage3_product_primary_v1` job;
- The Odds API product-primary rows with fresh source timestamps;
- Current Board product prices sourced from those rows;
- R2 persistent behavior if natural line movement occurs;
- no SportsDataIO product-price leakage;
- scheduler, settlement, provider budget, rollback, and fail-closed safety pass.
