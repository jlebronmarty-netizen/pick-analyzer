# NBA-02C Historical Model Diagnostics And Stake Policy Research

Status: `NBA_02C_DIAGNOSTICS_PASS_CURRENT_ERA_SHADOW_RECOMMENDED`

NBA-02C is a historical/shadow diagnostic only. It makes no NBA Current Era writes, no Official Picks, no production learning or calibration writes, no provider calls, and no MLB mutations.

## Why Moneyline Accuracy Still Lost Money

Moneyline finished at 64.3% accuracy but -8.58% ROI because the average selected price was -345.41. The average implied break-even probability was 69.39%, above the model's realized win-rate cushion after price tax.

## Walk-Forward Stake Research

Price-aware data exists only for 2024-25, so NBA-02C used an event-level chronological 70/30 walk-forward split within 2024-25. Discovery rows: 2334. Validation rows: 1002. The policy freeze point was 2025-02-25T02:00:00+00:00.

| Policy | Discovery ROI | Validation Bets | Validation ROI | Validation Net | Validation Drawdown | Ending Bankroll |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| FLAT_1U | -9.84 | 1002 | 2.31 | 11.8485 | 14.0871 | 111.8485 |
| CONFIDENCE_TIER | -7.92 | 1002 | 2.56 | 12.8757 | 11.2058 | 112.8757 |
| CONFIDENCE_TIER_C2 | -7.33 | 1002 | 2.85 | 14.6633 | 11.4903 | 114.6633 |
| PROBABILITY_TIER | -7.81 | 1002 | 2.81 | 14.1609 | 10.7301 | 114.1609 |
| EDGE_TIER | -7.17 | 402 | 3.83 | 15.5686 | 17.6724 | 115.5686 |
| EV_TIER | -6.54 | 402 | 4.58 | 19.6068 | 18.1372 | 119.6068 |
| COMBINED_EVIDENCE | -7.1 | 402 | 3.34 | 12.5367 | 15.4445 | 112.5367 |
| FRACTIONAL_KELLY_10 | -6.9 | 402 | 5.72 | 29.5054 | 22.7038 | 129.5054 |
| FRACTIONAL_KELLY_25 | -6.62 | 402 | 6.78 | 37.4045 | 23.4074 | 137.4045 |
| FRACTIONAL_KELLY_50 | -6.67 | 402 | 6.78 | 37.6768 | 23.9679 | 137.6768 |

Best in-sample policy: `EV_TIER`.
Best out-of-sample policy: `FRACTIONAL_KELLY_25`.
Recommended shadow policy: `COMBINED_EVIDENCE`.

The recommended policy is research-only because the price-aware validation history is one season and the baseline ROI is negative. It can be shadowed later, but it is not production stake advice.

## Risk Controls

- Starting bankroll: 100 units.
- Per-bet cap: 2% of bankroll.
- Same-day simultaneous exposure cap: 10%.
- Flat validation ROI: 2.31%.
- Combined-evidence validation ROI: 3.34%.
- Kelly 10% validation ROI: 5.72%.

## Current Era Readiness

Current Era shadow is `NBA_CURRENT_ERA_SHADOW_READY_WITH_LIMITATIONS` because the historical foundation, feature reconstruction, replay persistence, settlement, and price-aware evaluation are certified. User-facing production is `NBA_PRODUCTION_RECOMMENDATIONS_NOT_READY` because NBA Current Era scheduler, provider runtime, forward calibration, and Official Pick policy have not been certified.

## Bankroll Engine Design

NBA-02C recommends `RISK-01_BANKROLL_STAKE_ENGINE_SHADOW` as a future shadow-only phase. It should support user-entered or simulated bankroll, global bankroll with sport-level risk budgets, a 2% maximum single-bet cap, and a 10% maximum open-exposure cap. Automatic betting remains `NO`.

## Notification Design

Future notifications are deferred to `NOTIFY-01_ACTIONABLE_PICK_ALERTS`. They require Official Pick eligibility, acceptable/mature calibration, fresh exact price evidence, stake > 0, bankroll/exposure checks, pregame status, and deduplication by canonical opportunity/version. Automatic sportsbook execution remains `NO`.

## Provider Recommendation

The Odds API remains the target NBA odds provider. BallDontLie runtime should start with `ALL_STAR_FIRST_IF_RUNTIME_ENDPOINTS_CERTIFY`; GOAT is not required for runtime solely because it was useful for historical bootstrap.

## Next

Recommended next phase: `NBA-03A_CURRENT_ERA_SHADOW_FOUNDATION`. If forward samples show calibration or learning opportunity, follow with `NBA-03B_ONLINE_CALIBRATION_OR_LEARNING_CHALLENGER`. A generic stake engine should remain shadow-only until out-of-sample Current Era evidence exists.
