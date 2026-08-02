# OE-003 Adaptive Event Refresh Provider Budget Audit

Status: PASS

Generated: 2026-08-02

Scope: audit and architecture only. No scheduler cadence, prediction formula, Official Pick policy, settlement rule, model weight, provider contract, or product behavior changed.

## Executive Verdict

OE-003 passes as an audit package. The repository already has a protected adaptive refresh bridge, provider-budget guardrails, stored-odds consumers, and read-only health endpoints that can support an event-level lifecycle implementation. The current production observation shows the prior critical scheduler state has recovered:

- Production commit: `2c202983a1311a43f361afd707b32200c85da221`.
- `/api/operations/health`: `HEALTHY`.
- Scheduler cadence status: `HEALTHY`.
- Last successful protected invocation: `2026-08-02T14:14:51.375Z`.
- Evidence age at observation: 10 minutes.
- Missed scheduler intervals: 0.
- Scheduler running: true.
- Current refresh window: `PREGAME`.
- Last odds refresh: `2026-08-02T14:14:51.375Z`.
- Latest prediction/recommendation refresh: `2026-08-02T14:14:44.137Z`.
- Provider status: `HEALTHY`.
- Active due steps: none.
- Provider calls made by read-only certification checks: 0.
- Remote mutations made by read-only certification checks: 0.

The morning operational check remains important historical evidence: it showed scheduler `CRITICAL`, missed intervals, stale odds, and no settlement backlog. OE-003 classifies that as a scheduler execution freshness incident that later recovered, not as a proven route failure or provider-budget exhaustion.

## Scheduler Inventory

| Mechanism | File or route | Cadence | Protection | Mutates | Provider calls | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Vercel cron | `vercel.json` | none, `crons: []` | not applicable | no | no | Vercel cron is disabled. |
| Production writer | `.github/workflows/production-operating-day.yml` | `7-57/10 * * * *` UTC | `CRON_SECRET`; POST `/api/cron/operating-day?dryRun=false` | yes, through existing pipeline | only when adaptive status marks provider-backed domains due and budget allows | Timeout 6 minutes, concurrency `production-operating-day-writer`. |
| Production heartbeat | `.github/workflows/production-operating-day-heartbeat.yml` | `3,33 * * * *` UTC | `CRON_SECRET`; POST dry-run | dry-run heartbeat evidence only | 0 | Timeout 5 minutes, concurrency `production-operating-day-heartbeat`. |
| Manual observer | `.github/workflows/operating-day-refresh.yml` | workflow dispatch only | repository secrets | dry-run only | 0 | Legacy observer fallback. |
| Operating-day route | `src/app/api/cron/operating-day/route.ts` | caller-owned | `CRON_SECRET` when configured | yes when `dryRun=false`; dry-run records heartbeat | provider-backed only through adaptive bridge | Delegates to `runAdaptiveRefresh`. |
| Adaptive refresh orchestrator | `src/services/adaptive-refresh-orchestrator.service.ts` | invoked by route/status readers | app internal | status read is read-only; execution can mutate existing operating-day path | budget-guarded schedule, odds, results | Uses lock, due-domain detection, and `executeOperatingDay`. |
| Provider budget status | `src/services/provider-budget.service.ts` | on demand | server-only | no | 0 | Reads lifecycle and sync-job ledgers. |
| Operations health | `src/services/operations-health.service.ts` | on demand | read-only API | no | 0 | Separates latest scheduler evidence, freshness, budget, current board, and settlement backlog. |
| Dashboard/Current Board | `src/services/dashboard-today.service.ts`, `src/services/current-board.service.ts` | on demand | read-only API | no | 0 | Stored-data consumers. |

## Scheduler Root Cause Classification

Current state: recovered and healthy.

Prior concern classification:

- A. Actual missed writer executions: supported by previous production health evidence (`CRITICAL`, missed intervals, schedulerRunning false).
- B. Health calculation using stale market evidence: partially supported; earlier health mixed provider status with `odds_not_current`, but scheduler cadence now also has separate lifecycle-event evidence.
- C. External scheduler lateness: supported by earlier missed protected invocation age.
- D. Provider throttling: not proven. Budget was not exhausted.
- E. Concurrency/timeout: no current evidence of lock or timeout failure; workflows are bounded and isolated.
- F. Combination: most likely earlier incident was external scheduler lateness plus stale market evidence, not provider quota exhaustion.

## Provider Cost Model

### SportsDataIO

| Field | Classification | Evidence |
| --- | --- | --- |
| Primary current use | PROVEN | MLB schedule, odds, and results via operating-day pipeline. |
| Repository budget | CONFIGURED_ONLY | Default daily budget 1000, soft reserve 150, max 3 calls/action, max 12 refresh calls/hour. |
| Actual account allowance | UNKNOWN | No audited provider account metadata or reset header response was consumed in OE-003. |
| Reset period | CONFIGURED_ONLY | Service uses Puerto Rico local day accounting over lifecycle/sync ledgers. Actual account reset is not certified. |
| Request granularity | INFERRED | Existing docs and services use schedule/results/odds date-slate endpoints, especially MLB. |
| Current period calls | PROVEN FROM APP LEDGER | Production health reports provider call accounting from app ledgers. |
| Reserve | CONFIGURED_ONLY | 150 configured protected reserve. |
| Fallback | PROVEN | Fails closed when accounting is uncertain or configured stop/hourly/per-action limits would be exceeded. |

### The Odds API

| Field | Classification | Evidence |
| --- | --- | --- |
| Intended use | CONFIGURED_ONLY | Multi-sport odds and score discovery routes exist for NBA, NFL, NHL, Soccer, Tennis, UFC and others. |
| Current dry-run behavior | PROVEN | Default quota/catalog/capability/current-odds GET routes are dry-run and make zero provider calls. |
| Live quota headers | PROVEN BY PRIOR PROJECT STATUS, NOT RECHECKED | Prior Checkpoint A recorded `x-requests-remaining` style evidence and reserve behavior. OE-003 made no live call. |
| Current remaining quota | UNKNOWN | Not rechecked to avoid quota usage. |
| Reset period | UNKNOWN | No stored official reset interval was proven in OE-003. |
| Request cost | INFERRED | Service captures `x-requests-last`, `x-requests-used`, and `x-requests-remaining`; cost can vary and one HTTP request must not be equated with one unit unless headers prove it. |
| Reserve | CONFIGURED_ONLY | `the-odds-api-maximum-utilization.service.ts` uses a 2000-credit reserve. |

### BSN

BSN is not certified as covered by The Odds API. Repository evidence points to a custom basketball source framework with official BSN homepage, BSN CSV import, manual entry, and future-provider placeholders. Current status is preview/shadow, not production betting enabled.

## Canonical Acquisition Flow

Current product principle is already close to:

`ONE CANONICAL ACQUISITION -> sports_odds_snapshots -> MANY STORED-DATA CONSUMERS`

Observed consumers:

- Current Board reads `sports_odds_snapshots` plus `prediction_history`.
- Today/Daily Brief reads Current Board, sport events, operating-day status, provider budget, and stored recommendation evidence.
- Homepage reads `/api/dashboard/today`, `/api/current-board`, `/api/model/intelligence`, and `/api/performance`.
- Betting Workspace reads `/api/current-board?mode=current`, `/api/current-board?mode=all_stored_data`, `/api/predictions/top`, `/api/model/intelligence`, `/api/model/segments`, and `/api/dashboard/today`.
- Game Intelligence and advanced surfaces are stored-data readers.

No direct provider call was found in homepage or betting workspace components.

Current duplication risk is semantic, not provider-acquisition duplication:

- Dashboard Today can classify stale/aging at an event-card level.
- Current Board has its own 30-minute display freshness policy and 24-hour default current-window query policy.
- Adaptive refresh uses domain-level freshness and event windows.
- Operations Health currently exposes provider status partly from market freshness, which can make provider health appear degraded when the provider is not quota-blocked.

## Per-Event Freshness Findings

Production `/api/operations/health` returned event refresh windows for current MLB games. Representative rows:

| Event | Matchup | Start | Window | Market refresh allowed | Target cadence | Next due |
| --- | --- | --- | --- | --- | --- | --- |
| `78963` | WSH @ ATL | `2026-08-02T17:35:00Z` | PREGAME | true | 15 min | `2026-08-02T14:29:44.137Z` |
| `78968` | PHI @ BAL | `2026-08-02T17:35:00Z` | PREGAME | true | 15 min | `2026-08-02T14:29:44.137Z` |
| `78962` | STL @ TOR | `2026-08-02T17:37:00Z` | PREGAME | true | 15 min | `2026-08-02T14:29:44.137Z` |
| `78969` | PIT @ CIN | `2026-08-02T17:40:00Z` | PREGAME | true | 15 min | `2026-08-02T14:29:44.137Z` |
| `78959` | ARI @ CLE | `2026-08-02T17:40:00Z` | PREGAME | true | 15 min | `2026-08-02T14:29:44.137Z` |
| `78970` | KC @ COL | `2026-08-02T19:10:00Z` | EARLY | true | 60 min | `2026-08-02T15:14:44.137Z` |
| `78967` | MIL @ LAA | `2026-08-02T19:15:00Z` | EARLY | true | 60 min | `2026-08-02T15:14:44.137Z` |

Current Board representative candidate evidence showed:

- `oddsTimestamp`: `2026-08-02T14:14:44.137Z`.
- Market input age: 10 minutes.
- Market freshness source: `snapshot_ingested_at`.
- Provider source timestamp can be older than ingestion timestamp, for example `2026-08-02T10:14:22Z`.
- Current Board freshness status: `FRESH`.

Important finding: per-event state already exists in health output, but event freshness should become first-class instead of being derived separately by each product surface.

## Current Health Semantics

Keep these concepts separate:

1. Scheduler execution health: last protected invocation age, missed intervals, workflow/run evidence.
2. Market freshness health: stored odds age against product SLA.
3. Provider health: budget, entitlement, provider outage, quota headers, response status.
4. Settlement health: ready, blocked, silent pending, learning/performance flow.
5. Product readiness: whether each surface can show actionable, downgraded, or blocked decisions.

Current gap: `providerStatus` can become degraded because `odds_not_current` exists. That is useful operationally, but it should not be the only provider-health signal. OE-003 recommends splitting provider capacity/availability from market freshness in OE-003A.

## Operations Center Reference

The MLB Operations Center is the right visual reference for future work. It should later show:

- scheduler execution health separate from market freshness;
- provider-specific budget pools;
- usable budget after reserve;
- per-event lifecycle and priority;
- current and next operational action;
- sample-limited versus subscription-limited blockers;
- readiness numerators and denominators;
- all-sports overview.

No UI redesign is included in OE-003.

## Safety Results

- Provider calls made by OE-003: 0.
- Provider credits consumed by OE-003: 0.
- Database access: read-only production endpoints and local repository inspection.
- Database mutations: 0.
- Prediction behavior changes: none.
- Settlement behavior changes: none.
- Scheduler cadence changes: none.
- Provider contract changes: none.
