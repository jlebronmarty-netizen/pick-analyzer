# Personal Wager Data Model

Status: RELEASE 13 ADDITIVE SCHEMA

## Tables

### user_wagers

Owner-scoped parent row for a user-entered wager.

Key fields:

- `id`
- `user_id`
- `client_created_id`
- `created_at`
- `updated_at`
- `placed_at`
- `sportsbook`
- `bet_type`
- `stake`
- `currency`
- `potential_payout`
- `actual_payout`
- `status`
- `result`
- `notes`
- `source_category`
- `model_snapshot`
- `model_probability`
- `confidence`
- `total_entered_odds`
- `is_archived`
- `archived_at`

`client_created_id` is unique per user and is used for idempotent local-to-remote migration.

### user_wager_legs

Child rows for selections inside singles or parlays.

Key fields:

- `wager_id`
- `event_id`
- `prediction_id`
- `sport`
- `league`
- `matchup`
- `event_start_time`
- `market`
- `selection`
- `user_entered_line`
- `user_entered_odds`
- `canonical_line_snapshot`
- `canonical_odds_snapshot`
- `model_probability_snapshot`
- `confidence_snapshot`
- `evidence_grade`
- `result`
- `status`

## Separation

The data model stores stable references and minimum decision-time snapshots only. It does not copy complete prediction records and it does not update model settlement, learning, calibration or performance tables.
