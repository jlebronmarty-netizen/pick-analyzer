# MLB-03R5 Shadow Settlement Runtime

Status: `MLB_03_SHADOW_SETTLEMENT_RUNTIME_CERTIFIED_READY_FOR_PUBLICATION`

This phase stops MLB Current Era Shadow prediction accumulation at three clean canaries and prepares an isolated settlement runtime for that shadow cohort.

No production settlement execution was performed. No fourth canary was created.

## Scope

- Sport: `baseball_mlb`
- Prediction origin: `CURRENT_ERA_SHADOW`
- Model role: `shadow`
- Certification status: non-quarantined rows only
- Supported markets: moneyline, run line, total

The runtime is implemented in `src/services/mlb-current-era-shadow-settlement.service.ts` and defaults to dry-run. Future mutation requires explicit authorization through `MLB_CURRENT_ERA_SHADOW_SETTLEMENT_AUTHORIZED=true` plus execute mode.

## Result Authority

Settlement uses stored canonical evidence only:

- `sport_events` for event identity and final lifecycle state
- `game_results` for final score and result identity

No provider calls are made by the settlement runtime.

## Isolation

Shadow settlement preserves:

- `prediction_origin = CURRENT_ERA_SHADOW`
- `model_role = shadow`
- `is_current = false`
- `recommended_pick = false`
- `production_eligible = false`

It does not create Official Picks, product-visible recommendations, learning labels, calibration promotions, bankroll writes, notification writes, NFL writes, NBA writes, or historical replay writes.

## Market Semantics

- Moneyline: selected team wins if its final score is greater than opponent score.
- Run line: selected score plus exact persisted line is compared to opponent score.
- Total: combined final score is compared to the exact persisted total line using Over/Under selection.
- Cancelled, postponed, suspended, missing-result, and non-final events fail closed.

## Fingerprint Contract

The canonical immutable fingerprint version remains `mlb_current_era_shadow_canary_immutable_fingerprint_v1`.

Settlement lifecycle fields are intentionally excluded from the immutable fingerprint, so a future valid settlement can grade a row without rewriting price, probability, identity, or source evidence.
