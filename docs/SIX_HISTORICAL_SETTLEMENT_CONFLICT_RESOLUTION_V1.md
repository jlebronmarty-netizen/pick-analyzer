# Six Historical Settlement Conflict Resolution V1

Date: 2026-07-28

Status: COMPLETE

## Scope

This phase repaired exactly six allowlisted historical MLB prediction rows that were already identified by Historical Settled Status Reconciliation V1 as stored-settled/deterministic-result conflicts.

Target rows:

- `0cf650e1-08b8-51ff-ad79-55a6f2f595b1`
- `583d8788-2bd5-5305-af4c-8569438d4dbc`
- `2355ad93-3def-5e9a-8d7f-48217fc1abd3`
- `60868978-2a82-5e1d-a35b-36ed06034e01`
- `7d8e67e1-ba78-5b6d-a102-0fba3448d7b5`
- `9bd2f825-fac2-590f-8b13-31c7c068bce3`

No other prediction rows were eligible for mutation.

## Root Cause

The six predictions belonged to two canonical SportsDataIO MLB events:

- `baseball_mlb:mlb:sportsdataio:event:78852` - ATH @ MIN, final MIN 2, ATH 0
- `baseball_mlb:mlb:sportsdataio:event:78860` - CIN @ STL, final STL 7, CIN 0

The rows were linked to authoritative `game_results` rows from earlier same-team events:

- `baseball_mlb:mlb:sportsdataio:event:78837` - ATH @ MIN, final ATH 2, MIN 0
- `baseball_mlb:mlb:sportsdataio:event:78845` - CIN @ STL, final CIN 4, STL 2

That stale cross-event linkage made the stored `status` diverge from the deterministic outcome for each row's own canonical `game_id`.

## Repair

The approved repair updated only the six allowlisted `prediction_history` rows:

- `status`
- `result`
- `profit`
- `stake`
- `result_id`
- `settlement_market`
- `settlement_source`
- `settlement_version`
- `settled_at`
- `settlement_details`

The repair source/version is `six_historical_settlement_conflict_resolution_v1`.

No provider calls, learning writes, model-weight mutations, probability changes, confidence changes, Trust changes, Official Pick policy changes, SQL changes, feature rebuilds, imports, epoch activation or Vercel deployment occurred.

## Evidence

Primary evidence:

- `docs/six-historical-settlement-conflict-resolution-v1.json`
- `scripts/six-historical-settlement-conflict-resolution-v1.mjs`
- `scripts/six-historical-settlement-conflict-resolution-v1-validate.mjs`

Execution summary:

- Dry-run before apply: 6 target rows, 0 blocked after stale cross-event linkage was classified, 0 mutations.
- Apply: 6 target rows, 6 mutations, 0 provider calls.
- Dry-run after apply: 6 target rows, 0 blocked, 0 mutations.
- Final classification: 6 `STORED_SETTLED_AND_DETERMINISTIC_SETTLED`.

## Certification

Markers:

- SIX_HISTORICAL_SETTLEMENT_CONFLICT_RESOLUTION_PASS
- SIX_ROW_ALLOWLIST_ONLY_PASS
- STALE_CROSS_EVENT_RESULT_LINKAGE_REPAIRED_PASS
- CANONICAL_RESULT_ID_ALIGNMENT_PASS
- DETERMINISTIC_OUTCOME_REPRODUCIBILITY_PASS
- SETTLEMENT_IDEMPOTENCY_PASS
- NO_PROVIDER_CALL_PASS
- NO_LEARNING_WRITE_PASS
- NO_MODEL_WEIGHT_CHANGE_PASS
- NO_PROBABILITY_CHANGE_PASS
- NO_OFFICIAL_PICK_POLICY_CHANGE_PASS
- NO_CERTIFIED_PLATFORM_REGRESSION_PASS
