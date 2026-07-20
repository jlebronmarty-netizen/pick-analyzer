# Production Readiness Audit V1

Pick Analyzer now exposes a read-only production certification contract at `/api/production-readiness/audit`.

The audit reuses existing systems:

- AI Performance Center / AI Brain for metrics, trust, report cards, history and goals.
- Current Board for active MLB candidate selection.
- MLB Market Capability Registry for market coverage.
- Adaptive Operations for freshness, scheduler and provider-budget status.
- Top Picks and recommendation policy outputs for official-pick readiness.

## Guardrails

- Provider calls made by audit: `0`.
- Remote mutations made by audit: `0`.
- Prediction mutations: `0`.
- Model weights, formulas, champion/challenger/V7, official thresholds, provider acquisition, settlement, learning and historical rows are unchanged.

## Certification Position

Current certification is:

- Public production ready: `NO`
- Closed beta ready: `YES`, with explicit limitations

Minimum blockers before public production:

1. Historical odds and settled production sample are not sufficient for mature calibration.
2. Confirmed lineup/player availability depth is still incomplete for production-grade MLB confidence.
3. Fresh official-pick odds cadence is not yet automated at a high enough pregame frequency.

The dashboard exposes this under Advanced Details -> Overview -> Final Certification Audit.
