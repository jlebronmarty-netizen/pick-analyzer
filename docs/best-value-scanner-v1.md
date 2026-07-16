# Best Value Scanner V1

Status: Completed as a read-only Current Board consumer.

Best Value Scanner ranks stored, current, actionable candidates by modeled value signals from the Current Board. It is presentation/orchestration only: it does not change prediction calculations, persist new rows, query providers, or alter the official recommendation policy.

## Source

Best Value consumes `getCurrentBoardCached()` as the trusted source for current-slate filtering, safe odds selection, anomaly checks, stale-row exclusion, dedupe, event status and official eligibility. It does not query raw `prediction_history` directly for candidate selection and does not run a broad odds scan.

If Current Board cannot be loaded, Best Value returns an explicit scanner state instead of claiming there are no value candidates:

- `scanCompleted`
- `dataAvailable`
- `errorCode`
- `errorMessageSafe`
- `candidatesScanned`
- `positiveValueCount`

The UI shows `DATA TEMPORARILY UNAVAILABLE` for scanner errors. The text `No positive modeled-value candidate is available` is reserved for completed scans with data available and zero positive-value candidates.

## Ranking Signals

The display score prefers:

- positive expected value
- positive edge
- confidence
- reliability
- feature quality
- data sufficiency
- odds freshness

The categories are display-only:

- `Strong Modeled Value`
- `Developing Value`
- `Thin Value`
- `No Modeled Value`

`MODELED VALUE` is not an official pick. Official picks still require Production Data Gate V1 plus Recommendation Eligibility Policy V1 approval.

## Current Expected Output

For the current `NYM @ PHI` prospective slate:

- Default Best Value view: 0 returned candidates, because no current candidate has positive edge/EV.
- Show passes enabled: 3 returned candidates, all `No Modeled Value`.
- Official picks: 0.
- Provider calls: 0.
- Remote mutations: 0.

The scanner preserves the Current Board distinction between analyzed preview candidates and official recommendations.
