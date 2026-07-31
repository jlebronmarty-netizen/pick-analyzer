# Pick Analyzer V2 Phase B6.1 Live Freshness And Budget Audit

Date: 2026-07-31

Status: LOCAL PASS PENDING PRODUCTION

Starting commit: `babe6f55a3e95cf5f032578cd596445e4ddcdc23`

## Scope

Phase B6.1 audited the Today live-odds freshness presentation, provider-budget accounting, scheduler cadence claims and Best Opportunity value provenance. B7 was not started.

No provider calls were made. No database mutations, prediction writes, settlement writes or learning writes were made.

## Budget Source Of Truth

| Provider | Sport scope | Allowance source | Daily allowance | Reserve | Usable daily balance | Monthly allowance | Proven actual quota |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| SportsDataIO | `baseball_mlb` | Environment/config defaults in `provider-budget.service.ts` plus read-only database usage counters | 1000 calls | 150 calls | 850 calls before usage | Not stored in repository | No; configured only unless provider account metadata or quota headers are captured |

Budget configuration sources:

- `MLB_DAILY_CREDIT_BUDGET`, `PROVIDER_DAILY_CREDIT_BUDGET`, `SPORTSDATAIO_DAILY_CALL_BUDGET`
- `MLB_DAILY_CREDIT_RESERVE`, `PROVIDER_DAILY_CREDIT_RESERVE`, `SPORTSDATAIO_SOFT_RESERVE`
- `MLB_MAX_CALLS_PER_ACTION`, `SPORTSDATAIO_MAX_CALLS_PER_ACTION`
- `MLB_MAX_REFRESH_CALLS_PER_HOUR`, `PROVIDER_MAX_REFRESH_CALLS_PER_HOUR`
- `PROVIDER_BUDGET_WARNING_PERCENT`, `PROVIDER_BUDGET_STOP_PERCENT`
- `operating_day_lifecycle_events` and `sports_sync_jobs` read-only usage accounting

The repository does not contain a proven provider account allowance, reset date, live quota header ledger or monthly provider balance. Any claim beyond configured allowance is unproven without an explicitly approved provider/account status request.

## Refresh Chain

Certified chain:

GitHub Actions cron every 10 minutes -> protected `/api/cron/operating-day` -> adaptive cadence policy -> provider budget gate -> provider adapter when due -> odds snapshot persistence -> Current Board freshness -> `/api/dashboard/today` -> Today UI.

Important distinction:

- Scheduler tick is not a paid provider call.
- Page/API fetch is not a market refresh.
- `SUCCESS_NO_CHANGE` is not a new snapshot.
- Post-start pregame odds refresh remains blocked.

## Cadence Comparison

| Window | Documented policy | Scheduler capability | B6.1 conclusion |
| --- | ---: | ---: | --- |
| More than 24h before start | 60 minutes | 10 minute tick can service due checks | Sustainable |
| 2-24h before start | 15 minutes | 10 minute tick can service due checks with jitter | Sustainable |
| Inside 2h before start | 10 minutes | 10 minute tick maximum without workflow change | Certified maximum |
| True 5 minute refresh | Conceptual only | Not possible with current single 10 minute scheduler | Must not be claimed |
| After start | Stop pregame odds | Scheduler may still run status/results work | Pregame odds blocked |

Recommended MLB cadence remains: 60 minutes outside 24h, 15 minutes from 2-24h, 10 minutes inside 2h, stop pregame odds after start. A 5 minute cadence requires an explicitly approved scheduler change and budget proof.

## Freshness Timestamp Map

| Label | Meaning | Source |
| --- | --- | --- |
| `PAGE_UPDATED` / PAGE UPDATED | Browser/API response fetch time | `data.generatedAt` |
| `MARKET_UPDATED` / MARKET UPDATED | Stored provider odds snapshot capture time | `latestOddsTimestamp` or `marketFreshnessSummary.latestOddsTimestamp` |
| `PREDICTION_UPDATED` / PREDICTION UPDATED | Prediction row generation time | prediction/grounded row timestamps |
| `SYSTEM_UPDATED` / SYSTEM UPDATED | Scheduler/operating-day completion time | operations diagnostics |

Root cause repaired:

- Today previously allowed `generatedAt` as fallback for opportunity market timestamp.
- Today displayed a generic `Updated just now` badge without labeling it as page/API freshness.
- The normalized Best Opportunity helper could treat a generic selector `metricValue` as EV even when the selector metric was probability, confidence or ranking score.

Repairs:

- Page fetch time is labeled as page freshness.
- Market freshness uses only market snapshot timestamps.
- Missing market timestamps remain unavailable.
- Future market timestamps render invalid instead of just-now.
- Stale market timestamps cannot render FRESH in the primary metric.
- Generic selector `metricValue` is not EV unless `metricName` explicitly indicates expected value/EV.

## Edge And EV Provenance

The backend Best Value selector uses aligned Current Board candidates and canonical EV when available. The UI-level defect was provenance fallback: `metricValue` could be displayed as EV for non-EV selectors. B6.1 removed that fallback except for selectors explicitly named Expected Value or EV. Missing EV remains unavailable.

No EV, edge, probability or implied-probability formula changed.

## Safe Cadence Scenarios

The following scenarios use the configured-only daily budget of 1000 calls and reserve of 150 calls, assuming one credit per MLB odds refresh request. Actual provider credits remain unproven until quota/account evidence is captured.

| Scenario | Active hours/day | Calls/day | Credits/day | Credits/month | Risk |
| --- | ---: | ---: | ---: | ---: | --- |
| Current adaptive policy | 12 | Up to 72 if due every 10 minutes | 72 | 2160 | Low against configured daily budget, monthly unproven |
| MLB every 10 minutes active window only | 12 | 72 | 72 | 2160 | Low configured daily risk |
| MLB every 5 minutes inside 2h only | 2 | 24 plus normal due checks | 24+ | 720+ | Scheduler cannot deliver without change |
| MLB every 5 minutes all active pregame hours | 12 | 144 | 144 | 4320 | Requires scheduler change and quota proof |
| Broad all-sport 5 minute polling | 12 | Multiplies by active sports | Unbounded from repo evidence | Unbounded | Not approved |

## Validation Notes

Required deterministic validation is implemented in `scripts/pick-analyzer-v2-phase-b6-1-live-freshness-budget-validate.mjs`.

Production read-only verification is required after push before final deployed certification.

## Safety

- Provider calls made: 0.
- Provider credits used: 0.
- Database reads by local validation: 0.
- Database mutations: 0.
- Prediction writes: 0.
- Settlement writes: 0.
- Learning writes: 0.
- Business formulas changed: no.
- Official Pick policy changed: no.
- Scheduler changed: no.
- B7 started: no.

## Verdict

Local B6.1 repair is ready for deterministic validation, build, commit, push and read-only production certification. Final deployed classification remains pending until production serves the B6.1 commit.
