# OE-002 Reconciliation

Observation time: `2026-08-01T21:48:31Z` through `2026-08-01T21:49:07Z`.

Canonical source files captured read-only during the audit:

- `/api/system/version`
- `/api/dashboard/today`
- `/api/current-board?mode=current&limit=100`
- `/api/performance`
- `/api/operations/settlement-guarantee?includeValidation=true`
- `/api/operations/mlb-autonomous-operations`
- `/api/operations/health`

## July 31 MLB Event Table

| Event | Matchup | Start UTC | Stored Status | Discovered | Prediction Generated | Prediction Valid | Result Imported | Settlement | Learning | Performance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 78934 | NYY @ CHC | 2026-07-31T18:20:00Z | completed | yes | 3 rows | yes | no | blocked `RESULT_NOT_IMPORTED` | no | excluded |
| 78939 | PIT @ CIN | 2026-07-31T22:10:00Z | live | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78938 | PHI @ BAL | 2026-07-31T23:05:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78932 | STL @ TOR | 2026-07-31T23:07:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78930 | CHW @ TB | 2026-07-31T23:10:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78929 | ARI @ CLE | 2026-07-31T23:10:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78931 | MIA @ NYM | 2026-07-31T23:10:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78933 | WSH @ ATL | 2026-07-31T23:15:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78935 | TEX @ HOU | 2026-08-01T00:15:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78940 | KC @ COL | 2026-08-01T00:40:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78937 | MIL @ LAA | 2026-08-01T01:38:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78941 | DET @ ATH | 2026-08-01T01:40:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78942 | SF @ SD | 2026-08-01T01:45:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78943 | MIN @ SEA | 2026-08-01T02:10:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |
| 78936 | BOS @ LAD | 2026-08-01T02:10:00Z | scheduled | yes | 3 rows | yes | not final in captured scheduler coverage | not settled | no | pending final evidence |

## Counts

- Events discovered: 15.
- Events with predictions: 15.
- Prediction rows: 45.
- Valid pregame prediction rows: 45.
- Settlement guarantee completed prediction rows: 15.
- Settled completed rows: 12.
- Blocked completed rows: 3.
- Ready settlement rows: 0.
- Silent pending rows: 0.

The blocked rows were all tied to event `78934`; the shared root cause was missing canonical `game_results`.
