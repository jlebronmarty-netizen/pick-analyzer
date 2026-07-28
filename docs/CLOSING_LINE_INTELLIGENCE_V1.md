# Closing Line Intelligence V1

Status: Foundation.

Closing Line Intelligence V1 creates a read-only foundation for comparing stored prediction-time prices with grounded closing candidates.

## Scope

- Page: `/closing-line-intelligence`
- API: `/api/closing-line/intelligence`
- Validation: `scripts/closing-line-intelligence-v1-validate.mjs`
- Source tables: `prediction_history`, `sports_odds_snapshots`, `sport_events`

## Closing Candidate

The canonical closing candidate is the latest valid aligned stored price before event start for the same event, market, selection and bookmaker scope.

The service excludes post-start prices, unmatched sides, unmatched markets, invalid American odds and missing event-start evidence.

## CLV Method

CLV is calculated only when both prediction-time and closing-candidate prices are valid and aligned.

The method is `decimal_price_ratio_and_implied_probability_change`:

- prediction decimal price divided by closing decimal price
- closing implied probability minus prediction implied probability
- American odds movement from prediction price to closing candidate

Positive CLV does not guarantee profit.

## Safety

- Provider calls: 0
- Remote mutations: 0
- Database mutations: 0
- Estimated closing lines: none
- Post-start prices: excluded
- Prediction/model changes: none
- Settlement-policy changes: none

## Certification Markers

- `CLOSING_LINE_INTELLIGENCE_V1_PASS`
- `CLOSING_CANDIDATE_ALIGNMENT_PASS`
- `CLOSING_PRESTART_CUTOFF_PASS`
- `CLOSING_PROVENANCE_PASS`
- `CLV_METHOD_DISCLOSURE_PASS`
- `CLV_PRODUCTION_SCOPE_PASS`
- `NO_FAKE_CLOSING_LINE_PASS`
- `NO_POST_START_PRICE_LEAKAGE_PASS`
- `NO_PROVIDER_CALL_PASS`
- `NO_REMOTE_MUTATION_PASS`
- `NO_MODEL_CHANGE_PASS`
- `NO_CERTIFIED_PLATFORM_REGRESSION_PASS`
