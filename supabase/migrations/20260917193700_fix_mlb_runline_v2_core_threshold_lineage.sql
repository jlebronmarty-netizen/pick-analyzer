-- Research-only Run Line V2 lineage correction.
--
-- The frozen Core threshold was persisted using a rounded display value
-- (1.00025535724664) instead of the canonical replay value
-- (1.0002553572466371). The rounded value excludes exactly one historical
-- development row (2026-07-29), so replay lineage no longer reproduced the
-- candidate set that was frozen for prospective shadow evidence.
--
-- This migration corrects metadata only. It does not change Official Picks,
-- APOSTAR eligibility, production eligibility, model weights, Transfer/P769,
-- or the prospective evidence start date.

DO $$
DECLARE
  v_core jsonb;
  v_union jsonb;
BEGIN
  SELECT rule_definition INTO v_core
  FROM public.mlb_runline_formula_search_v1
  WHERE formula_id = 'rl_v2_core_fixed_v1'
  FOR UPDATE;

  IF v_core IS NULL THEN
    RAISE EXCEPTION 'missing rl_v2_core_fixed_v1';
  END IF;

  IF coalesce(v_core->>'threshold', '') <> '1.00025535724664' THEN
    RAISE EXCEPTION 'unexpected existing Core threshold: %', v_core->>'threshold';
  END IF;

  SELECT rule_definition INTO v_union
  FROM public.mlb_runline_formula_search_v1
  WHERE formula_id = 'rl_v2_broad_union_fixed_v1'
  FOR UPDATE;

  IF v_union IS NULL THEN
    RAISE EXCEPTION 'missing rl_v2_broad_union_fixed_v1';
  END IF;

  UPDATE public.mlb_runline_formula_search_v1
  SET rule_definition = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              rule_definition,
              '{threshold}',
              to_jsonb(1.0002553572466371::numeric),
              true
            ),
            '{rule}',
            to_jsonb('market_p_dog >= 0.54 AND market_p_dog < 0.58 AND (recent_form + fatigue_travel)/sqrt(2) >= 1.0002553572466371'::text),
            true
          ),
          '{development_metrics}',
          '{
            "n": 70,
            "n_2025": 52,
            "n_2026": 18,
            "correct": 53,
            "accuracy": 0.757142857142857,
            "accuracy_2025": 0.75,
            "accuracy_2026": 0.777777777777778,
            "avg_market_p_dog": 0.562481401712791,
            "min_phase_accuracy": 0.733333333333333
          }'::jsonb,
          true
        ),
        '{replay_lineage_correction}',
        '{
          "type": "threshold_precision_restore",
          "canonical_threshold": 1.0002553572466371,
          "previous_rounded_threshold": 1.00025535724664,
          "affected_development_rows": 1,
          "affected_game_date": "2026-07-29",
          "prospective_rule_changed": false,
          "transfer_candidate_changed": false,
          "official_picks_changed": false,
          "apostar_changed": false
        }'::jsonb,
        true
      )
  WHERE formula_id = 'rl_v2_core_fixed_v1';

  UPDATE public.mlb_runline_formula_search_v1
  SET rule_definition = jsonb_set(
        jsonb_set(
          rule_definition,
          '{development_metrics}',
          '{
            "n": 143,
            "n_2025": 90,
            "n_2026": 53,
            "correct": 110,
            "accuracy": 0.769230769230769,
            "accuracy_2025": 0.766666666666667,
            "accuracy_2026": 0.773584905660377,
            "avg_market_p_dog": 0.595662868820477,
            "min_phase_accuracy": 0.723404255319149,
            "overlap_core_transfer": 6
          }'::jsonb,
          true
        ),
        '{replay_lineage_correction}',
        '{
          "type": "core_threshold_precision_restore",
          "core_canonical_threshold": 1.0002553572466371,
          "previous_core_rounded_threshold": 1.00025535724664,
          "union_added_development_rows": 1,
          "prospective_rule_changed": false,
          "transfer_candidate_changed": false,
          "official_picks_changed": false,
          "apostar_changed": false
        }'::jsonb,
        true
      )
  WHERE formula_id = 'rl_v2_broad_union_fixed_v1';
END
$$;
