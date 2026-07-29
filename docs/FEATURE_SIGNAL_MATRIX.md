# Feature Signal Matrix

Date: 2026-07-29

Status: DOMAIN AND COVERAGE SIGNAL ESTIMATE

No model training. No production mutation.

| Category | Priority | Feature keys | Average coverage % | Very-high signal | High signal |
| --- | --- | --- | --- | --- | --- |
| Historical performance | Recommended | 20 | 19.07 | 0 | 5 |
| Home/Away | Recommended | 145 | 2.51 | 0 | 0 |
| Unknown | Experimental | 27 | 12.81 | 0 | 0 |
| Schedule | Recommended | 17 | 14.77 | 0 | 3 |
| Pitching | Must use | 86 | 2.57 | 0 | 0 |
| Batting | Recommended | 6 | 20.39 | 0 | 2 |
| Team strength | Must use | 73 | 1.55 | 0 | 0 |
| Roster | Optional | 4 | 16.51 | 0 | 0 |
| Weather | Recommended | 12 | 5.05 | 0 | 1 |
| Odds | Must use | 28 | 1.51 | 0 | 0 |
| Market | Must use | 11 | 3.37 | 0 | 0 |
| Rest | Recommended | 3 | 5.35 | 0 | 0 |
| System | Training exclude | 11 | 1.07 | 0 | 0 |
| Opponent quality | Optional | 2 | 4.95 | 0 | 0 |
| Meta | Training exclude | 3 | 1.51 | 0 | 0 |
| Streaks | Optional | 1 | 2.87 | 0 | 0 |

## Top Candidate Features By Coverage

- batting_order: High, 59.33% coverage, Domain-relevant contextual signal with useful observed coverage.
- bb_rate: Medium, 59.33% coverage, Potentially useful, but coverage or redundancy needs more review.
- field_position: Medium, 59.33% coverage, Potentially useful, but coverage or redundancy needs more review.
- gdp_rate: Medium, 59.33% coverage, Potentially useful, but coverage or redundancy needs more review.
- hr_rate: Medium, 59.33% coverage, Potentially useful, but coverage or redundancy needs more review.
- k_rate: Medium, 59.33% coverage, Potentially useful, but coverage or redundancy needs more review.
- last10_avg: High, 59.33% coverage, Domain-relevant contextual signal with useful observed coverage.
- last10_ops_proxy: High, 59.33% coverage, Domain-relevant contextual signal with useful observed coverage.
- last10_pa: High, 59.33% coverage, Domain-relevant contextual signal with useful observed coverage.
- last20_ops_proxy: High, 59.33% coverage, Domain-relevant contextual signal with useful observed coverage.
- player_id: Medium, 59.33% coverage, Potentially useful, but coverage or redundancy needs more review.
- sb_attempt_rate: High, 59.33% coverage, Domain-relevant contextual signal with useful observed coverage.
- season_avg: High, 59.33% coverage, Domain-relevant contextual signal with useful observed coverage.
- season_obp_proxy: High, 59.33% coverage, Domain-relevant contextual signal with useful observed coverage.
- season_ops_proxy: High, 59.33% coverage, Domain-relevant contextual signal with useful observed coverage.
- season_pa: High, 59.33% coverage, Domain-relevant contextual signal with useful observed coverage.
- season_slg_proxy: High, 59.33% coverage, Domain-relevant contextual signal with useful observed coverage.
- availability_tier: Medium, 6.59% coverage, Potentially useful, but coverage or redundancy needs more review.
- batting_order_coverage: Very Low, 6.59% coverage, Observed values are constant in this sample.
- consecutive_game_days: Low, 6.59% coverage, Limited observed coverage or indirect relationship to outcomes.
- days_rest: Low, 6.59% coverage, Limited observed coverage or indirect relationship to outcomes.
- days_since_last_appearance: Low, 6.59% coverage, Limited observed coverage or indirect relationship to outcomes.
- extra_inning_games_last14: Very Low, 6.59% coverage, Observed values are constant in this sample.
- fatigue_score: Low, 6.59% coverage, Limited observed coverage or indirect relationship to outcomes.
- high_pitch_last_start_flag: Low, 6.59% coverage, Limited observed coverage or indirect relationship to outcomes.
- last10_run_diff_per_game: Low, 6.59% coverage, Limited observed coverage or indirect relationship to outcomes.
- last10_win_pct: Low, 6.59% coverage, Limited observed coverage or indirect relationship to outcomes.
- last3_start_pitch_count_avg: Low, 6.59% coverage, Limited observed coverage or indirect relationship to outcomes.
- last30_days_games: Low, 6.59% coverage, Limited observed coverage or indirect relationship to outcomes.
- last5_run_diff_per_game: Low, 6.59% coverage, Limited observed coverage or indirect relationship to outcomes.

## Interpretation

Signal quality is estimated from domain relevance, observed coverage, variance and leakage disposition only. No trained feature importance, coefficient ranking or model fitting was performed.
