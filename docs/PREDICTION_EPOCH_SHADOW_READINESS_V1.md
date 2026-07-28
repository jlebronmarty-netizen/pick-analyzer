# Prediction Epoch Shadow Readiness V1

Status: implemented locally, shadow-only.

This phase adds governance and observability for a future certified prediction epoch without activating the epoch and without changing current prediction, recommendation, settlement or learning behavior.

## Safety Contract

| Action | Status |
| --- | --- |
| Historical predictions deleted | no |
| Historical Replay executed | no |
| New epoch activated | no |
| `production_eligible=true` set | no |
| Prediction probabilities changed | no |
| Confidence or quality formulas changed | no |
| Official Pick thresholds lowered | no |
| Learning Brain weights changed | no |
| Production deployment | no |
| Provider calls in validation | 0 |
| Production mutations in validation | 0 |

## Governance Schema Contract

Migration artifact:

`supabase/migrations/202607280001_prediction_epoch_shadow_readiness_v1.sql`

The migration is additive and must not be applied in production without separate approval. It adds nullable future governance fields to `prediction_history`:

- `prediction_origin`: `LIVE_PREGAME`, `HISTORICAL_WALK_FORWARD_REPLAY`, `LEGACY_PRE_CERTIFICATION`
- `certification_status`: `SHADOW_PENDING`, `CERTIFIED`, `QUARANTINED`, `INVALID`, `REJECTED`
- `certification_metadata`: isolated future JSON evidence for lineage/readiness gates

Existing rows are not backfilled. Preview rows are not promoted.

## Shadow Classifier

Read-only endpoint:

`GET /api/prediction-epoch/shadow-readiness`

The classifier evaluates recent MLB predictions and reports:

- prediction ID;
- event ID;
- operating date;
- market and selection;
- generated time, cutoff time and odds timestamp;
- odds age at generation;
- feature snapshot timestamp;
- inferred prediction origin;
- every certification gate;
- shadow certification result;
- exact failed gates;
- current `production_eligible` value.

Gate set:

- `event_identity_verified`
- `market_mapping_verified`
- `cutoff_verified`
- `odds_lineage_verified`
- `odds_freshness_sla_met`
- `feature_lineage_verified`
- `settlement_compatible`
- `learning_label_compatible`
- `no_retrospective_prediction`
- `shadow_isolation_preserved`
- `critical_warnings_absent`

Shadow certification is observational only. It does not affect dashboards, calibration, Learning Brain, Trust, Official Picks or production eligibility.

## Activation Gate

Read-only endpoint:

`GET /api/prediction-epoch/activation-readiness`

The gate remains OFF by default. It returns `ready: false` while any blocker remains. Current expected blockers include:

- governance schema not applied;
- no shadow epoch seeded;
- recent rows not all shadow-certifiable;
- odds scheduler is shadow-only;
- deployment commit not verified in this local phase;
- settlement compatibility not certified for the new epoch;
- learning-label compatibility not certified for the new epoch;
- missed-opportunity recording not persisted;
- scheduler lock not proven in production.

Do not activate an epoch from this phase.

## Pregame Odds Refresh Cadence & Freshness SLA V1

Read-only endpoint:

`GET /api/operations/pregame-odds-refresh-sla`

Shadow cadence:

| Window | Cadence |
| --- | --- |
| More than 90 minutes before game start | every 10 minutes |
| Final 90 minutes before game start | every 5 minutes |
| Capture cutoff | stop 10 minutes before start |

Freshness SLA:

| Window | Target |
| --- | --- |
| Normal active pregame | odds age <= 12 minutes |
| Final 90 minutes | odds age <= 7 minutes |

Full-slate planning estimate:

| Estimate | Value |
| --- | ---: |
| Assumed games | 15 |
| Markets per event | 3 |
| 10-minute cadence calls/day | 360 |
| 10-minute plus final-90 5-minute calls/day | 495 |
| Market rows/day at combined cadence | 2,970 |

The estimates are planning numbers only. No provider calls are made by the endpoint.

## Scheduler Architecture Recommendation

Recommended owner: existing adaptive refresh scheduler with GitHub Actions orchestrating bounded route execution.

Requirements before live activation:

- one scheduler owner only;
- GitHub Actions concurrency group or equivalent distributed lock;
- no Vercel Cron overlap for the same MLB odds window;
- provider budget precheck before every call;
- idempotency key per operating day/window;
- deterministic odds snapshot key;
- retry-after handling and exponential backoff;
- maximum calls per operating day;
- missed-refresh observation records;
- process-level hard timeout;
- no overlapping executions.

Vercel Cron is not recommended for the 5-minute production cadence until runtime duration, overlap behavior, retry semantics and provider-budget locking are proven.

## Odds-Change-Triggered Prediction Refresh

Read-only endpoint:

`GET /api/operations/odds-change-refresh-readiness`

Shadow regeneration may be considered only when:

- no valid prediction exists for the current market snapshot;
- existing prediction odds are stale;
- required pre-cutoff features changed;
- prior generation failed;
- odds or line changed materially.

Material-change rules:

| Market signal | Rule |
| --- | --- |
| Moneyline price | absolute American price change >= 10, or implied probability change >= 1.0 pp |
| Run-line price | absolute American price change >= 10 |
| Run-line handicap | any handicap change |
| Total price | absolute American price change >= 10 |
| Total points line | points line change >= 0.5 |

The scheduler running by itself is not a regeneration trigger.

## Official Pick Promotion Readiness

Future Official Pick eligibility may only occur when all are true:

1. row-level certification passes;
2. market is production-ready;
3. model version is calibrated;
4. MLB sport-level readiness is approved;
5. existing Official Pick policy gates pass.

This phase does not bypass production data gate, calibration, probability threshold, edge threshold, EV, confidence, risk grade, quality/sufficiency or policy exclusions.

