# Market Outcome Completeness And Performance Consistency V1

Date: 2026-07-24
Starting commit: `463004f0008f966d7fa43afe73635ab858765ac9`

## Scope

This pass fixes product semantics across Most Likely, Best Value, Current Board, Performance and AI Feed without changing prediction probabilities, Learning Brain, Official Pick policy, settlement, Historical Replay, Historical Feature Store or cutoff enforcement.

Provider calls: 0.
Remote data mutations: 0.

## Outcome Completeness Findings

Supported markets are Moneyline, Run Line and Totals. Persisted `prediction_history` rows store a selected-side model probability, not a full multi-row distribution object. For current binary markets, the user-facing distribution is therefore:

- Outcome A: stored selected-side probability.
- Outcome B: deterministic complement `100 - selected probability`.
- Push: `null` because the current supported surfaced lines do not store a separate push model.
- Total probability: 100.

No probability was fabricated and no model output was rewritten. The complement is exposed as derived market semantics for ranking and display only.

## Corrections

- Most Likely now ranks the highest-probability outcome for the market, not the stored row side or the first Official Pick.
- Model-only fallback also flips to the binary complement when the stored selected side is below 50%.
- Current Board now exposes `outcomeCompleteness` metadata for each candidate: stored side, opposite side, push probability, total probability and highest-probability outcome.
- AI Feed `MOST_LIKELY` items now use Current Board `outcomeCompleteness` so they explain the corrected highest-outcome view.
- Best Value now ranks actionable positive EV/edge from aligned fresh market inputs. It treats `STALE`, `EXPIRED` and `UNKNOWN` freshness as not actionable, and distinguishes negative EV from missing/stale odds.
- Freshness classification now uses the same canonical market freshness timestamp used by display/market alignment, preventing a recently ingested market from simultaneously showing fresh age and `STALE_ODDS`.
- Performance public routes now derive Trust, Sports, Report Card, Evolution, sport detail and the page headline metrics from the same cutoff-safe `performance-scope-v2` product scope used by Prediction History.
- Calibration Error is absolute confidence-vs-accuracy gap. Calibration Bias is signed confidence-vs-accuracy gap. Brier Score remains mean squared probability error. Confidence Reliability is the trust component derived from absolute calibration error.
- Today metrics remain `null`/`N/A` when no settled production Win/Loss sample exists.
- Sports with zero settled production predictions report unavailable Performance Trust; Data Readiness is separated.

## Files Changed

- `src/services/current-board.service.ts`
- `src/services/market-opportunity-suite.service.ts`
- `src/services/best-value-scanner.service.ts`
- `src/services/mlb-ai-picks-feed.service.ts`
- `src/services/performance-scope-v2.service.ts`
- `src/services/performance-product-contract.service.ts`
- `src/app/api/performance/route.ts`
- `src/app/api/performance/[sport]/route.ts`
- `src/app/api/performance/trust/route.ts`
- `src/app/api/performance/evolution/route.ts`
- `src/app/api/performance/report-card/route.ts`
- `src/app/api/performance/sports/route.ts`

## Validation

Local production build passed with `npm.cmd run build`.

Certifications:

- `MARKET_OUTCOME_COMPLETENESS_PASS`
- `MOST_LIKELY_CORRECTNESS_PASS`
- `BEST_VALUE_CORRECTNESS_PASS`
- `PERFORMANCE_SCOPE_CONSISTENCY_PASS`
- `PRODUCT_SEMANTIC_CONSISTENCY_PASS`
