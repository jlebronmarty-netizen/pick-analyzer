# OE-002 Operational Matrix

| Step | Status | Evidence | Root Cause | Repair | Verified |
| --- | --- | --- | --- | --- | --- |
| Event Discovery | PASS | July 31 scheduler coverage found 15 MLB events. | none | none | yes |
| Prediction | PASS | July 31 coverage: 45 prediction rows, 45 valid pregame rows. | none | none | yes |
| Odds Refresh | DEGRADED | Operations health blocker `odds_not_current`; current slate waiting for markets. | current-day market freshness, not closure root cause | none in OE-002 | read-only evidence |
| Live Transition | PARTIAL | July 31 stored statuses included one completed and one live row at capture. | result/status recovery did not prioritize prior completed missing-result rows | planner repaired result due condition | static verified |
| Result Import | FAILING_BEFORE_REPAIR | Settlement guarantee blocked 3 rows as `RESULT_NOT_IMPORTED`. | completed missing-result backlog was monitored but not actionable | completed missing-result rows now make `results` due | validator |
| Event Finalization | PARTIAL | Event `78934` was completed/scored in `sport_events`. | terminal event without canonical result was treated as non-actionable recovery | planner now detects this exact gap | validator |
| Settlement | PASS_WITH_BLOCKS | 0 ready rows, 0 silent pending rows, 3 explicit blocked rows. | blocked by missing result evidence | no settlement logic change | read-only evidence |
| Learning | PARTIAL | 12 settled rows available for learning evidence; blocked rows excluded. | missing result prevents settlement label | no learning change | read-only evidence |
| Performance | PARTIAL | Season settled 485, eligible pending 0; yesterday bucket 0 production-settled at capture. | missing result excludes valid completed rows from performance | result importer will be scheduled before settlement | read-only evidence |
| Daily Brief | PARTIAL | Dashboard current-day state synchronized with stored data. | closure evidence comes from operations endpoints, not dashboard final count | no dashboard logic change | read-only evidence |
| Current Board | PASS | Current Board read-only route returned 200 with stored candidates. | none | none | read-only evidence |
| Betting Workspace | PASS_NO_AUTH_SCOPE | Workspace route remained available after previous release. | none for closure | none | route evidence from deployment |
| History | PARTIAL | Performance history excludes `RESULT_NOT_IMPORTED` rows. | canonical result missing | result due planner repair | validator |
| Operations Health | DEGRADED | Health status degraded by `odds_not_current`; scheduler cadence healthy. | unrelated market freshness blocker | none in OE-002 | read-only evidence |
| Scheduler | REPAIRED_PLANNER | Prior scheduler selected odds while result import gap remained blocked. | missing-result backlog was not a due-domain input | `completedMissingResultRows` drives `sync_results` | validator |
