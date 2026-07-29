# Provider Budget Policy V1

Date: 2026-07-29

Status: COMPLETE

Provider budget enforcement is handled by `provider-budget.service.ts` and is used by the adaptive execution bridge before any provider-backed work.

## Defaults

- Daily call budget: `1000`
- Soft reserve: `150`
- Usable daily budget: `850`
- Max calls per action: `3`
- Max refresh calls per hour: `12`
- Warning threshold: `80%`
- Stop threshold: `95%`

Environment aliases remain supported for MLB/provider-specific overrides.

## Forecast

| Scenario | Calls/day | Calls/month |
| --- | ---: | ---: |
| MLB 60-minute full-day | 24 | 720 |
| MLB 15-minute full-day | 96 | 2880 |
| MLB 10-minute full-day | 144 | 4320 |
| MLB 5-minute full-day, not recommended | 288 | 8640 |
| Adaptive game-day estimate | 30 | 900 |

The adaptive scheduler should use much less than flat full-day polling because it calls providers only when a domain is due.

## Protection

Budget fails closed when accounting is uncertain, malformed or exhausted. Dynamic throttling blocks or delays provider-backed refreshes when hourly, per-action, reserve or stop-threshold limits would be exceeded.

No model training, prediction mutation, settlement-rule change, Official Pick policy change or provider call is performed by budget status reads.
