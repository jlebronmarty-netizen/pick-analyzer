# Provider Budget Intelligence

OE-003D update: `/api/operations/event-refresh-plan` consumes the OE-003B provider authorization contract in shadow mode. SportsDataIO MLB projected refresh costs are estimated from event plans and provider-efficient batching while preserving the configured reserve. The Odds API remains shadow-only when current balance/reset/cost evidence is unknown, and BSN remains observational until a certified active provider path exists.

Status: OE-003B implemented the first normalized contract. Later event-level planning remains proposed only.

OE-003 separates provider budget health from market freshness. A stale market is not proof of provider exhaustion, and an available provider budget is not proof that markets are fresh.

## Provider Pools

| Provider | Covered scope | Current repository evidence | Budget class |
| --- | --- | --- | --- |
| SportsDataIO | MLB operating data, with NBA readiness routes present but gated | `provider-budget.service.ts`, operating-day lifecycle ledger, SportsDataIO provider routes | CONFIGURED_ONLY for allowance/reset; PROVEN for application ledger accounting |
| The Odds API | Multi-sport odds/scores discovery for non-MLB sports | The Odds API routes, dry-run default, bounded live audit service, prior project status evidence | UNKNOWN for current remaining/reset; PROVEN prior header capture, not rechecked in OE-003 |
| MLB Stats API | Status/results support in health evidence | health/status refresh fallback labels | UNKNOWN external quota; likely public/status-oriented |
| BSN sources | Official homepage, CSV/manual, future provider placeholders | basketball source framework | not The Odds API-certified |

## Canonical Budget Fields

Every provider pool should expose:

- provider id;
- sports covered;
- current period id;
- reset semantics source;
- configured allowance;
- proven allowance;
- remaining credits/calls;
- used credits/calls;
- protected reserve;
- usable remaining after reserve;
- per-action max;
- rolling-hour max;
- endpoint cost model;
- latest quota-header evidence;
- accounting certainty;
- largest current consumer;
- retry/fallback policy.

OE-003B now exposes the additive `provider_budget_ledger_v1` contract from `provider-budget.service.ts` through `/api/providers/budget/status`. Unknown quota evidence remains `UNKNOWN` or `null`; configured-only evidence remains labeled `CONFIGURED_ONLY`; request counts and quota/credit units are distinct fields.

The existing `/api/operations/provider-budget-forecast` route is the read-only dry-run forecast surface. It returns `provider_budget_dry_run_forecast_v1`, estimated HTTP requests, estimated quota units, reserve impact and `provider_budget_authorization_v1` without provider calls or mutations.

## Current SportsDataIO Model

Repository defaults:

- daily call budget: 1000;
- soft reserve: 150;
- max calls per action: 3;
- max refresh calls per hour: 12;
- warning threshold: 80%;
- stop threshold: 95%;
- local accounting timezone: `America/Puerto_Rico`.

This is an application budget model, not proof of the provider account allowance or reset time.

## Current The Odds API Model

Repository defaults:

- bounded live audit hard cap: 12 calls;
- credit reserve: 2000;
- dry-run by default for quota, catalog, coverage and capability routes;
- headers captured when live calls are explicitly confirmed: `x-requests-remaining`, `x-requests-used`, `x-requests-last`.

OE-003 did not perform a live quota call, so current remaining quota and reset period remain unknown.

## Budget Modes

| Mode | Meaning | Allowed behavior |
| --- | --- | --- |
| NORMAL | Plenty of usable budget after reserve. | P0-P3 work allowed by event state. |
| CONSERVATIVE | Usable remaining is low but not critical. | P0/P1 only; P2/P3 downgrade. |
| CRITICAL | Only emergency or closure work remains. | P0 only. |
| EXHAUSTED | Reserve or stop threshold reached. | No provider calls; stored-data fallback. |
| UNKNOWN | Quota/reset semantics cannot be proven. | Fail closed for paid extraction unless explicitly approved. |

## Simulation Summary

### SportsDataIO MLB

| Scenario | Conservative | Balanced | Aggressive |
| --- | ---: | ---: | ---: |
| MLB normal day, 15 games | 18-28 calls/day | 28-45 calls/day | 60-90 calls/day |
| MLB heavy day | 28-45 calls/day | 45-70 calls/day | 100-144 calls/day |
| Reserve | 150 calls | 150 calls | 150 calls |
| Risk | low | low/moderate | moderate/high near repeated retries |

Balanced is recommended for MLB: it respects existing 15-minute pregame and 60-minute early windows while reserving P0 result/settlement capacity.

### The Odds API Multi-Sport

| Scenario | Conservative | Balanced | Aggressive |
| --- | ---: | ---: | ---: |
| Multi-sport normal day | 25-60 quota units/day | 60-140 quota units/day | 150-300+ quota units/day |
| Multi-sport peak day | 80-160 quota units/day | 160-400 quota units/day | 400-900+ quota units/day |
| Reserve | 2000 credits | 2000 credits | 2000 credits |
| Risk | low if headers proven | moderate until reset is proven | high without current quota proof |

Conservative is recommended until reset interval and per-endpoint cost are refreshed from stored or approved live evidence. Balanced can become the default after a non-wasteful quota-header proof.

## Health Contract Recommendation

Expose five independent health dimensions:

1. `schedulerExecution`: `HEALTHY`, `LATE`, `CRITICAL`, `NO_EVIDENCE`, `IDLE`.
2. `marketFreshness`: `FRESH`, `PARTIAL`, `STALE`, `EMPTY`, `UNKNOWN`.
3. `providerBudget`: `NORMAL`, `CONSERVATIVE`, `CRITICAL`, `EXHAUSTED`, `UNKNOWN`.
4. `settlementClosure`: `PASS`, `ACTION_REQUIRED`, `BLOCKED`.
5. `productReadiness`: per surface `ACTIONABLE`, `DOWNGRADED`, `BLOCKED`, `READ_ONLY`.

This prevents stale odds from being misread as provider outage and prevents healthy scheduler runs from hiding stale markets.
