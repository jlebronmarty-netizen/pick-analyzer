# Adaptive Refresh Policy V1

Date: 2026-07-29

Status: COMPLETE

The production scheduler now ticks every 10 minutes, but provider calls are still controlled by adaptive due-domain logic. The scheduler tick is not the provider-call cadence.

| Window | Refresh cadence | Runtime action | Provider rule |
| --- | ---: | --- | --- |
| More than 24h before first pitch | 60 minutes | status/morning sync when due | Avoid wasteful polling. |
| 2-24h before first pitch | 15 minutes | morning sync or midday refresh | Refresh only when market freshness is due. |
| Less than 2h before first pitch | 10 minutes | midday or final pregame refresh | Highest certified safe freshness. |
| After game starts | stop pregame odds | status/results only | No new pregame odds polling. |
| After final | 15 minutes until settled | sync results, settle, Performance | Switch to postgame lifecycle. |

## Integrity

- No duplicate snapshots: deterministic odds snapshot IDs and existing upsert/reuse behavior remain the write path.
- No retrospective predictions: refresh only operates current/future operating-day windows.
- No model changes: prediction formulas, confidence, Trust, Official Pick policy and model weights are unchanged.
- No provider waste: `SUCCESS_NO_CHANGE` cannot hide a missed provider-backed due refresh.
