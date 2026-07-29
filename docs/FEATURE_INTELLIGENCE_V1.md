# Feature Intelligence V1

Date: 2026-07-29

Status: READ-ONLY FEATURE INTELLIGENCE

No model training. No production mutation. No provider calls.

## Inventory

- Feature snapshots read: 73,719
- Unique feature keys observed: 449
- Sports represented: americanfootball_nfl, baseball_mlb, basketball_nba, icehockey_nhl
- Markets represented: historical_mlb_feature_store, moneyline, spread, total
- Average data quality score: 86.34
- Average data sufficiency score: 86.43

## Category Matrix

| Category | Feature keys | Average coverage % | Priority | High-signal keys | High/critical leakage flags |
| --- | --- | --- | --- | --- | --- |
| Historical performance | 20 | 19.07 | Recommended | 5 | 1 |
| Home/Away | 145 | 2.51 | Recommended | 0 | 4 |
| Unknown | 27 | 12.81 | Experimental | 0 | 0 |
| Schedule | 17 | 14.77 | Recommended | 3 | 2 |
| Pitching | 86 | 2.57 | Must use | 0 | 6 |
| Batting | 6 | 20.39 | Recommended | 2 | 0 |
| Team strength | 73 | 1.55 | Must use | 0 | 6 |
| Roster | 4 | 16.51 | Optional | 0 | 0 |
| Weather | 12 | 5.05 | Recommended | 1 | 0 |
| Odds | 28 | 1.51 | Must use | 0 | 4 |
| Market | 11 | 3.37 | Must use | 0 | 0 |
| Rest | 3 | 5.35 | Recommended | 0 | 0 |
| System | 11 | 1.07 | Training exclude | 0 | 11 |
| Opponent quality | 2 | 4.95 | Optional | 0 | 0 |
| Meta | 3 | 1.51 | Training exclude | 0 | 2 |
| Streaks | 1 | 2.87 | Optional | 0 | 0 |

## Redundancy Findings

- market_price_aliases: 2 related keys. Canonical recommendation: Keep one canonical odds price and one explicitly computed implied probability per market side.
- team_recent_form_windows: 114 related keys. Canonical recommendation: Retain last3/last5/last10 as separate regularized groups; avoid duplicate hotCold/trend aliases unless encoded deterministically.
- identity_and_lineage_metadata: 27 related keys. Canonical recommendation: Keep for audit joins and freeze validation; exclude from model features.
- home_away_symmetry: 210 related keys. Canonical recommendation: Prefer matchup deltas and side-relative encodings over separate duplicated home/away raw fields where future training supports it.

## Feature-Set Direction

- First model: Regularized Logistic Regression using Odds, Market, Pitching, Team strength, Batting, Schedule, Home/Away, Rest, Weather after approved training threshold and cutoff validation.
- Second model: Gradient Boosting challenger with expanded roster/opponent/streak/standing context after larger walk-forward evidence.
- Future model: Future ensemble after genuine line-movement history and multi-season validation exist.

## Guardrails

The audit does not train, fit, calculate model-derived feature importance, change probabilities, change confidence, change Trust, change Official Picks, change settlement, change Learning Brain weights, activate epochs, consume providers or mutate production data.
