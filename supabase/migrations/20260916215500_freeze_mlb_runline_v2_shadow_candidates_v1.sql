-- MLB Run Line V2 prospective-shadow freeze.
-- 2025 and already-opened 2026 are development evidence only.
-- Only games on/after 2026-09-17 may contribute new prospective evidence.
-- Research-only: no production serving, Official Picks, or APOSTAR activation.

insert into public.mlb_runline_formula_search_v1(
  formula_id,family,status,direction,rule_definition,notes,frozen_at,created_at
) values
(
  'rl_v2_core_fixed_v1',
  'RUNLINE_V2_PROSPECTIVE_SHADOW',
  'FROZEN_FOR_PROSPECTIVE_SHADOW',
  'DOG',
  jsonb_build_object(
    'research_only',true,
    'production_eligible',false,
    'official_picks_eligible',false,
    'apostar_eligible',false,
    'development_seasons',jsonb_build_array(2025,2026),
    'prospective_evidence_start','2026-09-17',
    'rule','market_p_dog >= 0.54 AND market_p_dog < 0.58 AND (recent_form + fatigue_travel)/sqrt(2) >= 1.00025535724664',
    'threshold',1.00025535724664,
    'score','(recent_form + fatigue_travel)/sqrt(2)',
    'side','DOG +1.5',
    'development_metrics',jsonb_build_object(
      'n',69,'correct',53,'accuracy',0.768115942028985,
      'n_2025',52,'accuracy_2025',0.75,
      'n_2026',17,'accuracy_2026',0.823529411764706,
      'min_phase_accuracy',0.739130434782609,
      'avg_market_p_dog',0.562255028942701
    )
  ),
  'V2 uses 2025 and already-opened 2026 as development evidence. Historical metrics are not an external certification. Frozen only for future prospective shadow evaluation; no production serving, Official Picks, or APOSTAR.',
  now(),now()
),
(
  'rl_v2_transfer_fixed_v1',
  'RUNLINE_V2_PROSPECTIVE_SHADOW',
  'FROZEN_FOR_PROSPECTIVE_SHADOW',
  'DOG',
  jsonb_build_object(
    'research_only',true,
    'production_eligible',false,
    'official_picks_eligible',false,
    'apostar_eligible',false,
    'development_seasons',jsonb_build_array(2025,2026),
    'prospective_evidence_start','2026-09-17',
    'rule','dogfav_hand = L/R AND (market_z_v2 + history + fatigue_travel)/sqrt(3) >= 0.889684454234473',
    'threshold',0.889684454234473,
    'score','(market_z_v2 + history + fatigue_travel)/sqrt(3)',
    'side','DOG +1.5',
    'market_z_reference',jsonb_build_object('mu',0.57629591863738,'sd',0.0754955595992703),
    'development_metrics',jsonb_build_object(
      'n',79,'correct',62,'accuracy',0.784810126582278,
      'n_2025',42,'accuracy_2025',0.80952380952381,
      'n_2026',37,'accuracy_2026',0.756756756756757,
      'min_phase_accuracy',0.684210526315789,
      'avg_market_p_dog',0.62233266272298
    )
  ),
  'V2 uses 2025 and already-opened 2026 as development evidence. Historical metrics are not an external certification. Frozen only for future prospective shadow evaluation; no production serving, Official Picks, or APOSTAR.',
  now(),now()
),
(
  'rl_v2_broad_union_fixed_v1',
  'RUNLINE_V2_PROSPECTIVE_SHADOW',
  'FROZEN_FOR_PROSPECTIVE_SHADOW',
  'DOG',
  jsonb_build_object(
    'research_only',true,
    'production_eligible',false,
    'official_picks_eligible',false,
    'apostar_eligible',false,
    'development_seasons',jsonb_build_array(2025,2026),
    'prospective_evidence_start','2026-09-17',
    'selection','rl_v2_core_fixed_v1 OR rl_v2_transfer_fixed_v1',
    'side','DOG +1.5',
    'development_metrics',jsonb_build_object(
      'n',142,'correct',110,'accuracy',0.774647887323944,
      'n_2025',90,'accuracy_2025',0.766666666666667,
      'n_2026',52,'accuracy_2026',0.788461538461538,
      'min_phase_accuracy',0.7,
      'avg_market_p_dog',0.595786543087882,
      'overlap_core_transfer',6
    )
  ),
  'Union of the two frozen V2 shadow routes. 2025+2026 are development only; only prospective games after the freeze may support future certification. No production serving, Official Picks, or APOSTAR.',
  now(),now()
)
on conflict(formula_id) do nothing;
