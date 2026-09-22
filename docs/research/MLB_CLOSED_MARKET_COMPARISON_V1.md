# Closed market comparison before new architecture selection

Research-only. Baseline12de8d43; live main8df2a5ba. Read-only evidence aggregation, no old artifact or tracker changes.

Raw maxima and n>=60 references are separated. Cohorts differ; these are not controlled head-to-head results. NR means unavailable in the artifact. Coverage denominators are preserved in JSON, not invented. No external/forward outcome artifact or within-artifact candidate grid was used for ranking.

| Market | Best closed historical accuracy/n | Coverage | Worst month | Best n>=60 reference | Stability status | Last family | Blocker / failure |
|---|---|---|---|---|---|---|---|
|F1_3WAY|56.56% (n=221)|NR|45.61%|56.56% (n=221)|FAIL_OR_NOT_ESTABLISHED|honest regime tree|NO_BLOCKER_FOR_CERTIFIED_PRIOR_OUTCOMES; legacy wider feature sets not re-admitted; accuracy; monthly stability; closed historical evidence only|
|F1_ML|73.91% (n=69)|3.54%|63.16%|73.91% (n=69)|FAIL_OR_NOT_ESTABLISHED|honest regime tree|NO_BLOCKER_FOR_CERTIFIED_PRIOR_OUTCOMES; legacy wider feature sets not re-admitted; accuracy; monthly stability; closed historical evidence only|
|F1_NRFI|55.88% (n=340)|NR|39.13%|55.88% (n=340)|FAIL_OR_NOT_ESTABLISHED|joint NRFI boosting|NO_BLOCKER_FOR_OUTCOME_ONLY; older starter features excluded; accuracy; monthly stability; closed historical evidence only|
|F3_3WAY|60.27% (n=73)|NR|28.57%|60.27% (n=73)|FAIL_OR_NOT_ESTABLISHED|honest regime tree|NO_BLOCKER_FOR_CERTIFIED_PRIOR_OUTCOMES; legacy wider feature sets not re-admitted; accuracy; monthly stability; closed historical evidence only|
|F3_ML|71.43% (n=77)|NR|66.67%|71.43% (n=77)|MONTHLY_FLOOR_ONLY_MET|honest regime tree|NO_BLOCKER_FOR_CERTIFIED_PRIOR_OUTCOMES; legacy wider feature sets not re-admitted; accuracy; closed historical evidence only|
|F3_TOTALS|51.47% (n=715)|NR|49.12%|51.47% (n=715)|FAIL_OR_NOT_ESTABLISHED|reference-line study|EXACT_HISTORICAL_LINE_COVERAGE; accuracy; monthly stability; closed historical evidence only|
|F5_3WAY|100.00% (n=2)|0.05%|100.00%|63.10% (n=84)|FAIL_OR_NOT_ESTABLISHED|honest regime tree|NO_BLOCKER_FOR_CERTIFIED_PRIOR_OUTCOMES; legacy wider feature sets not re-admitted; sample; months; closed historical evidence only|
|F5_ML|100.00% (n=4)|0.15%|100.00%|68.18% (n=88)|FAIL_OR_NOT_ESTABLISHED|opponent-adjusted NB count|NO_BLOCKER_FOR_CERTIFIED_PRIOR_OUTCOMES; legacy wider feature sets not re-admitted; sample; months; closed historical evidence only|
|F5_TOTALS|54.64% (n=679)|NR|48.57%|54.64% (n=679)|FAIL_OR_NOT_ESTABLISHED|reference-line study|EXACT_HISTORICAL_LINE_COVERAGE; accuracy; monthly stability; closed historical evidence only|
|F7_3WAY|72.73% (n=33)|0.82%|0.00%|69.66% (n=89)|FAIL_OR_NOT_ESTABLISHED|honest regime tree; F7 frozen|F7_FROZEN_PENDING_NEW_INFORMATION; sample; accuracy; monthly stability; closed historical evidence only|
|F7_ML|84.62% (n=52)|1.72%|75.00%|78.57% (n=84)|FAIL_OR_NOT_ESTABLISHED|consensus/conformal/month-bootstrap; frozen|F7_FROZEN_PENDING_NEW_INFORMATION; sample; closed historical evidence only|
|F7_TOTALS|55.30% (n=642)|NR|51.79%|55.30% (n=642)|FAIL_OR_NOT_ESTABLISHED|reference-line study|F7_FROZEN_PENDING_NEW_INFORMATION; accuracy; monthly stability; closed historical evidence only|
|TOTALS|55.32% (n=479)|25.38%|52.63%|55.32% (n=479)|FAIL_OR_NOT_ESTABLISHED|CatBoost regression/classification|ARCHIVED_LINEAGE_MIX_REQUIRES_SEPARATE_ADMISSION; accuracy; monthly stability; months; closed historical evidence only|
|F3_SPREAD|NR|NR|NR|NR|BLOCKED_OR_EXCLUDED|See preserved closeouts|No adequate exact historical lines; No adequate exact historical lines|
|F5_SPREAD|100.00% (n=2)|9.09%|100.00%|NR|BLOCKED_OR_EXCLUDED|See preserved closeouts|PR186 fixed sample:2/2,coverage2/22=9.09%,one selected month; insufficient exact-line corpus; PR186 fixed sample:2/2,coverage2/22=9.09%,one selected month; insufficient exact-line corpus|
|F7_SPREAD|NR|NR|NR|NR|BLOCKED_OR_EXCLUDED|See preserved closeouts|F7 frozen; no adequate exact historical lines; F7 frozen; no adequate exact historical lines|
|PERIOD_ALTERNATE_SPREADS|NR|NR|NR|NR|BLOCKED_OR_EXCLUDED|See preserved closeouts|No exact historical lines; margins are not a sportsbook-line backtest; No exact historical lines; margins are not a sportsbook-line backtest|
|ALTERNATE_PERIOD_TOTALS|NR|NR|NR|NR|BLOCKED_OR_EXCLUDED|See preserved closeouts|No adequate exact historical lines; No adequate exact historical lines|
|TEAM_TOTALS_AND_ALTERNATES|NR|NR|NR|NR|BLOCKED_OR_EXCLUDED|See preserved closeouts|No adequate exact historical lines; team-run threshold classifier diagnostic only; No adequate exact historical lines; team-run threshold classifier diagnostic only|
|GAME_ALTERNATE_SPREADS_TOTALS|NR|NR|NR|NR|BLOCKED_OR_EXCLUDED|See preserved closeouts|No adequate exact historical lines; No adequate exact historical lines|
|GAME_3WAY|NR|NR|NR|NR|BLOCKED_OR_EXCLUDED|See preserved closeouts|Settlement semantics not certified; Settlement semantics not certified|
|LINEUP_DEPENDENT_MARKETS|NR|NR|NR|NR|BLOCKED_OR_EXCLUDED|See preserved closeouts|BLOCKED_LINEUP_FEATURE_LINEAGE; BLOCKED_LINEUP_FEATURE_LINEAGE|
|ALREADY_QUALIFIED_OR_OPERATIONAL_PROPS|NR|NR|NR|NR|BLOCKED_OR_EXCLUDED|See preserved closeouts|Outside below-target research continuation; no operational work; Outside below-target research continuation; no operational work|
|BATTER_RUNS_AND_OTHER_PARTICIPATION_PROPS|NR|NR|NR|NR|BLOCKED_OR_EXCLUDED|See preserved closeouts|Do not reopen from external outcomes; lineup/participation and exact-line admission required; Do not reopen from external outcomes; lineup/participation and exact-line admission required|

Full inventory, every normalized candidate, exact artifact paths, cohort labels and reported metric denominators: `artifacts/research/mlb_closed_market_inventory_v1.json`. Recently closed families (including F7 selectors and F5 opponent-count) stay frozen. A market does not inherit a passed gate from a different season/cohort or tiny raw maximum.
