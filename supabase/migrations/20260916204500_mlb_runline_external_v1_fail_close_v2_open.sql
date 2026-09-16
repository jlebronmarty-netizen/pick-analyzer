-- Research-only closeout for the sealed 2025 -> 2026 MLB Run Line external test.
-- This migration MUST NOT modify Official Picks, betting activation, V1 formulas, thresholds,
-- segments, or any 2025/2026 outcome evidence. It only makes the already-observed gate result
-- explicit and opens a separate V2 research family.

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.mlb_runline_formula_search_v1
  WHERE formula_id IN (
    'rl_2025_precision_b_v1',
    'rl_2025_stability_c_v1',
    'rl_2025_balanced_bcd_v1',
    'rl_2025_broad_abcd_v1'
  )
    AND n_2026_external IS NOT NULL
    AND accuracy_2026_external IS NOT NULL
    AND evaluated_2026_external_at IS NOT NULL;

  IF v_count <> 4 THEN
    RAISE EXCEPTION 'RUNLINE_V1_EXTERNAL_CLOSEOUT_BLOCKED: expected four evaluated frozen candidates, got %', v_count;
  END IF;
END $$;

UPDATE public.mlb_runline_formula_search_v1
SET status = 'FAILED_2026_EXTERNAL_HOLDOUT',
    notes = concat_ws(E'\n', notes,
      'External 2026 gate failed. Preserve this V1 formula unchanged; do not retune this ID against 2026. Any 2026-informed follow-up belongs to the separate V2 research family.')
WHERE formula_id IN (
  'rl_2025_precision_b_v1',
  'rl_2025_stability_c_v1',
  'rl_2025_balanced_bcd_v1',
  'rl_2025_broad_abcd_v1'
)
  AND accuracy_2026_external < 0.75;

UPDATE public.mlb_runline_external_test_ledger_v1
SET status = 'EXTERNAL_2026_FAILED_ALL_V1_CANDIDATES',
    notes = concat_ws(E'\n', notes,
      'Gate closeout: all four pre-2026-frozen V1 candidates finished below 75% external accuracy. V1 is closed without threshold/segment/component retuning. A new V2 research family may use 2026 only as explicitly post-holdout diagnostic evidence.')
WHERE test_id = 'RUNLINE_2026_EXTERNAL_V1_SINGLE_SEALED'
  AND outcome_read_at IS NOT NULL;

INSERT INTO public.mlb_runline_formula_search_v1 (
  formula_id,
  family,
  status,
  direction,
  rule_definition,
  notes
)
VALUES (
  'rl_v2_transfer_research_family_v1',
  'runline_transfer_v2',
  'V2_RESEARCH_OPEN_NOT_FROZEN',
  'DOG',
  jsonb_build_object(
    'research_only', true,
    'production_eligible', false,
    'official_picks_eligible', false,
    'apostar_eligible', false,
    'parent_external_test', 'RUNLINE_2026_EXTERNAL_V1_SINGLE_SEALED',
    'v1_ids_immutable', jsonb_build_array(
      'rl_2025_precision_b_v1',
      'rl_2025_stability_c_v1',
      'rl_2025_balanced_bcd_v1',
      'rl_2025_broad_abcd_v1'
    ),
    'diagnostic_findings', jsonb_build_object(
      'rule_A_accuracy_2025', 0.794117647058823,
      'rule_A_accuracy_2026', 0.600000000000000,
      'rule_B_accuracy_2025', 0.800000000000000,
      'rule_B_accuracy_2026', 0.581818181818182,
      'rule_C_accuracy_2025', 0.765957446808511,
      'rule_C_accuracy_2026', 0.642857142857143,
      'rule_D_accuracy_2025', 0.783333333333333,
      'rule_D_accuracy_2026', 0.540000000000000,
      'season_dog_cover_baseline_2026', 0.579394583112055,
      'season_market_p_dog_mean_2026', 0.587925255218370
    ),
    'next_questions', jsonb_build_array(
      'calibration drift between frozen component score and dog cover probability',
      'interaction instability across dog/favorite handedness and dog side',
      'price-bucket and month stability under 2026-informed diagnostics',
      'whether V2 should model residual edge over market probability instead of raw dog cover',
      'whether thresholds should be probability-calibrated rather than raw score quantiles'
    ),
    'forbidden_actions', jsonb_build_array(
      'retune any V1 id',
      'promote to production without a new explicit gate',
      'use postgame/full features as pregame inputs',
      'modify Official Picks',
      'activate APOSTAR'
    )
  ),
  'Opened only after the single-read 2026 external gate failed all four V1 candidates. This row defines a new research family/protocol, not a frozen candidate formula. Any future V2 candidate must receive a new ID and its own development/freeze/evaluation protocol.'
)
ON CONFLICT (formula_id) DO NOTHING;
