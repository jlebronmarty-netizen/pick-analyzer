# MLB Provider Strategy

Status: Production Stable, Provider Limited
Version: MLB Production Complete v1.0.0

## Provider Model

MLB uses SportsDataIO through bounded, budget-aware, server-side provider routes and stored checkpoint evidence. Provider access is not treated as unlimited, and unavailable fields are never fabricated.

Verified provider-backed capabilities include:

- Stored schedule and event identity.
- Full-game moneyline, run line/spread and total where odds payloads are available.
- GamesByDate starter/weather/stadium evidence where verified.
- Player metadata cache and roster status availability from accessible player data.
- Provider capability audit and market capability registry.

Provider-limited capabilities:

- Confirmed lineups.
- Detailed injury diagnosis, body part, severity and expected return.
- Verified multi-book arbitrage.
- Unsupported markets such as props, NRFI/YRFI, team totals and first-five until ingestion, modeling, settlement and calibration exist.

## Budget And Safety

Provider calls must remain:

- Business-purpose specific.
- Budget checked.
- Checkpointed or ledgered where appropriate.
- Sanitized in API responses.
- Non-destructive.
- Separate from recommendation-policy mutation.

Production validation showed provider budget status is available at `/api/providers/budget/status` and returned HTTP 200 with mode `provider_budget_status_v1`.

## Refresh Strategy

The current refresh strategy is frozen:

- Use stored data before provider calls.
- Use operating-day automation stages for schedule, odds, predictions, results and settlement readiness.
- Use checkpoint/resume and idempotency keys for protected execution.
- Keep unsupported provider domains explicit rather than silent or synthetic.

Do not replace provider architecture without a future maintenance-mode provider-upgrade project.