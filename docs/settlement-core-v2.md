# Settlement Core V2

Settlement Core V2 adds reusable settlement primitives for common market grading.

## Scope

- moneyline
- spread
- total
- win
- loss
- push
- void
- pending
- overtime policy contract
- period market contract
- multi-sport deterministic fixture coverage for NBA, MLB, NFL, NHL and soccer

## Files

- `src/services/settlement-core.service.ts`
- `src/app/api/settlement/core/route.ts`
- `src/components/dashboard/SettlementCorePanel.tsx`

## API

`GET /api/settlement/core`

Returns deterministic local settlement self-tests and primitive readiness. It makes zero provider calls.

## NBA Compatibility

NBA Prediction Settlement V1 remains unchanged. The generic settlement primitives are additive and should be adopted incrementally only where behavior matches existing sport-specific rules.

Settlement alone does not make a prediction eligible for production backtesting, ROI, CLV or calibration. Those paths also require durable prediction-time feature lineage through pending migration `202607140001_historical_feature_snapshots_v1.sql`.

## Deterministic Validation

The status API checks:

- moneyline win
- spread cover
- total over
- total push
- pending event
- cancelled event void
- NBA moneyline, spread, total, first-half, first-quarter and overtime-inclusion contracts
- MLB moneyline, run line, total, first-five, extra-innings and postponed/suspended/void contracts
- NFL moneyline, spread, total, first-half, overtime and push contracts
- NHL moneyline including OT/shootout, regulation moneyline, puck line, total and first-period contracts
- Soccer 1X2, draw, total, first-half, extra-time/penalties, abandoned/canceled and two-leg aggregate contracts

These are deterministic local examples, not production settlement records.

Soccer draw, double chance, extra-time/penalties and two-leg aggregate remain contract-only where the generic primitive lacks dedicated result-type metadata. Props remain out of scope until grading feeds and result semantics are proven.

## Future Work

- Adopt shared primitives in NBA settlement where behavior matches exactly.
- Add period-market helpers for first-half and quarter settlement.
- Add sport-specific overtime policy adapters.
- Use the primitives for future NFL, NHL, soccer, tennis and UFC settlement modules.
