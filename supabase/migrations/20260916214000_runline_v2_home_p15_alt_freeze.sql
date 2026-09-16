-- Research-only record of the frozen Run Line V2 HOME +1.5 alternate candidate.
-- No production routing, Official Picks, or APOSTAR changes.

insert into public.mlb_runline_formula_search_v1 (
  formula_id,
  family,
  status,
  direction,
  rule_definition,
  n_2025_full,
  accuracy_2025_full,
  coverage_2025_full,
  notes,
  frozen_at
)
values (
  'rl_v2_home_p15_alt_favorite_tsh_q92_v1',
  'runline_home_p15_alt_v2',
  'FROZEN_RESEARCH_ONLY_AWAITING_VERIFIED_FORWARD',
  'HOME +1.5 ALT',
  jsonb_build_object(
    'market_scope', 'primary HOME -1.5; target wager is alternate HOME +1.5 only when a real pregame quote is available',
    'primary_market_condition', 'home_line = -1.5',
    'target_label', 'home_p15_cover',
    'feature_branch', 'PREGAME',
    'feature_normalization', '2025-frozen cross-year components',
    'score_formula', '(team_strength + starter + history) / sqrt(3)',
    'score_threshold', 2.065112,
    'threshold_origin', '2025 primary-home-favorite score 92nd percentile',
    'development_window_2025', '2025 full regular season market-covered games',
    'development_window_2026', 'through 2026-09-10 only',
    'pricing_status', 'historical alternate HOME +1.5 price not certified; ROI and EV intentionally null',
    'future_gate', 'requires verified pregame alternate HOME +1.5 quote plus untouched forward outcomes; do not retune this formula after freeze',
    'production_eligible', false,
    'official_picks_eligible', false,
    'apostar_enabled', false
  ),
  107,
  0.85981308411215,
  0.0440329218106996,
  'Selected from V2 research after cross-year and temporal-stability comparison. 2025: 92/107 = 85.98%; 2026 through Sep10: 49/62 = 79.03%; minimum complete 30-pick temporal block = 76.67%. Baseline HOME favorite +1.5 cover rate was 68.60% in 2025 and 68.42% in 2026 opening-proxy market. Research-only freeze. No historical alternate-line ROI claim.',
  timestamptz '2026-09-16 21:00:43.769939+00'
)
on conflict (formula_id) do update set
  family = excluded.family,
  status = excluded.status,
  direction = excluded.direction,
  rule_definition = excluded.rule_definition,
  n_2025_full = excluded.n_2025_full,
  accuracy_2025_full = excluded.accuracy_2025_full,
  coverage_2025_full = excluded.coverage_2025_full,
  notes = excluded.notes,
  frozen_at = excluded.frozen_at;
