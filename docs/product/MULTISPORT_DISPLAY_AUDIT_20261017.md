# Multisport display audit — 2026-10-17

Read-only production UI/API audit of integrated MLB, NHL, NCAAB, Soccer and Table Tennis. No provider acquisition, database writes, training, model retuning, settlement writer or Official promotion.

| Sport | Observed | Finding |
| --- | --- | --- |
| MLB | Engines API AVAILABLE; 851 canonical research rows; regular 334W/150L, 69.01%; postseason 298W/34L, 89.76% | UI/API parity PASS, separate phases, Pick/Edge/Equilizer and exact-contract tables. Production official ML remains separate at 19W/23L. |
| NHL | 63 registered picks: 55 settled, 27W/28L, 8 pending; 49.09%, −5.3362u | UI/API parity PASS. WIN filter 27, LOSS 28, Hoy 8. Forecast coverage 10/13 upcoming, partial coverage disclosed. |
| NCAAB | 73 preseason forecasts, 108 abstentions; in-season model 0 forecasts; 0 settled | Published-checkpoint parity PASS. Null accuracy, Nov 2–3 dates, warmup/abstention controls work. Continuous sync and settlement are still unconnected; this is not full operational certification. |
| Soccer | 7 stored projections, all insufficient history, zero valid selections/settlements | Published-checkpoint parity PASS; VALID filter 0, raw edges do not bypass gates. Live source tracker is separately reachable but empty (0 forecasts, null last_updated_at). Pick still displays the prior frozen checkpoint, not the newly added operational tracker. Continuation belongs with Soccer's active workstream. |
| Table Tennis | Source expanded to 138 observations / 389 finals, including TT_SETS_OE_V1 | Regression reproduced: strict two-model parser rejected source extension and returned HTTP 503, hiding TT card/results and making global completeness unavailable. Fix scopes the known source extension out before full two-model validation, after verifying original source counts. |
| NFL | Preview page explicitly states no certified production Today/settlement surface | Expected unconnected state, not missing NHL data. NBA and other foundation/blocked cards remain outside integrated model totals. |

## Table Tennis compatibility correction

Source retained schema TT_READ_BRIDGE_V1 but began publishing an additional model. Pick's two-model integration must remain available without treating a third model as ML/Totals. The parser validates the full source envelope and original counts, explicitly excludes only TT_SETS_OE_V1, then fully validates and summarizes the integrated models. Unknown model IDs, incorrect counts, corrupt integrated forecasts, stale reads and invalid finals continue to fail closed. The page discloses excluded observations.

At the first reproduced extended read: 36 odd/even observations excluded, 102 integrated observations. Each integrated model has 24 forecasts, 27 abstentions, 4 evaluated and 20 pending; ML 3W/1L (75%, only four matches); Totals MAE 18.4212051082 points. Values may evolve with source captures. No odd/even picks, results or accuracy enter Pick V1.

Validation: 67 dashboard tests, scoped ESLint, immutable 107 MLB runtime pins / 37 R3 sources and full production build. Hosted/visual confirmation is recorded in the release PR. No source repository or database changes are needed for this compatibility fix.
