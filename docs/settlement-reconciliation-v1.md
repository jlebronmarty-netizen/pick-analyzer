# Settlement Reconciliation V1

Implemented on 2026-07-21 as a production-safe dry-run and certification layer.

## Production Audit

- Total `prediction_history` rows examined: 1,276.
- Pending-like rows examined: 656.
- Pending sports: MLB 316, NFL 190, NCAAF 122, EPL 20, BSN 8.
- Categories found: `TEST_OR_FIXTURE_DATA` 300, `EXACT_EVENT_MAPPING_MISSING` 342, `POST_START_PREDICTION` 14.
- Deterministic settlement mutations eligible now: 0.
- Event-link repairs eligible now: 0.
- Provider calls: 0.
- Remote mutations: 0.

## Safety Result

No row was settled because no pending row currently satisfies the exact-event, pre-start, market-complete, final-result proof requirements. The route refuses non-zero write scope until a bounded executor review is added for that exact candidate set.

## API

- `GET /api/settlement/reconciliation`: read-only dry-run plan.
- `GET /api/settlement/reconciliation?validate=true`: deterministic fixture validation.
- `POST /api/settlement/reconciliation`: protected by `CRON_SECRET`; currently executes only the proven zero-mutation idempotency path.

## Certification

`SETTLEMENT_RECONCILIATION_PARTIAL`: audit and dry-run certification pass, but production settlement writes are blocked by zero deterministic eligible rows.
