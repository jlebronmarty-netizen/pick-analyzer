# Sport Readiness Forecast

Date: 2026-07-29

Status: READ-ONLY FORECAST

## Summary

Only MLB currently has accepted training-ready evidence. NFL and NHL have preview evidence but no accepted production-settled training rows. NBA, Soccer, BSN, Tennis and UFC remain blocked for training readiness until production prediction, feature and settlement lifecycles create accepted rows.

| Sport | Total Rows | Accepted | Blocked | Score | State |
| --- | ---: | ---: | ---: | ---: | --- |
| MLB | 1,194 | 354 | 840 | 35.4 | Architecture review sample present |
| NBA | 27 | 0 | 27 | 0.0 | Evidence present, blocked |
| NFL | 966 | 0 | 966 | 0.0 | Preview evidence present, blocked |
| NHL | 258 | 0 | 258 | 0.0 | Preview evidence present, blocked |
| Soccer | 20 | 0 | 20 | 0.0 | Evidence present, blocked |
| BSN | 8 | 0 | 8 | 0.0 | Evidence present, blocked |
| Tennis | 0 | 0 | 0 | 0.0 | No stored training evidence |
| UFC | 0 | 0 | 0 | 0.0 | No stored training evidence |

## Forecast

MLB is the fastest path to 1,000 accepted rows because it already has 354 accepted samples and 596 recoverable rows. If all recoverable MLB-adjacent evidence is certified, the platform reaches 950 and needs only 50 additional accepted rows from normal production operation.

NFL and NHL can become meaningful only after their preview rows settle with authoritative results and are reviewed under production eligibility rules.

Other sports need canonical production prediction and settlement lifecycles before they can contribute training-ready rows.
