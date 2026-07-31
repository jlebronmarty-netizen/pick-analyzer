# Release 02 Live State Integration

Status: REPOSITORY CERTIFIED

Release 02 verified that the existing user-facing state model has canonical producers. No visual redesign or runtime behavior change was made.

## Canonical State Mapping

| Surface | Canonical API / Service | State Source | Required States | Release 02 Finding |
| --- | --- | --- | --- | --- |
| Home / AI briefing | `/api/dashboard/today`, `src/services/dashboard-today.service.ts`, `src/components/home/HomeBettingPlan.tsx` | Today contract, current-board summary, scheduler coverage, learning summary | loading, empty, unavailable, stale, current, blocked | Uses `/api/dashboard/today` as primary endpoint with no-store cache and degraded fallback. |
| Current board | `/api/current-board`, `src/services/current-board.service.ts` | `prediction_history`, odds snapshots, market alignment, official pick contract | current, historical, settled, stale, unsupported, duplicate, leakage risk | Board candidates carry reason codes and zero provider/mutation guardrails. |
| Model Only | `src/services/model-only-intelligence.service.ts` | current model rows and cutoff fields | available, empty, post-start excluded, stale | Today contract links model-only availability to canonical summary text. |
| Most Likely | market opportunity services and Today selectors | canonical selector `highestProjectedOutcome` / `mostLikelySummary` | available, blocked, empty | Today selector contract separates probability from official recommendation. |
| Official Picks | `src/services/official-pick-experience.service.ts` | recommendation eligibility policy and market alignment | official, blocked, unavailable | Official policy thresholds are reused, not changed. |
| AI feed | `src/services/mlb-ai-picks-feed.service.ts` | current-board candidates and explainable intelligence | available, empty valid, blocked | Feed item types are derived from existing candidate categories. |
| Performance | `/api/performance`, `src/services/performance-scope-v2.service.ts` | settled production predictions and cutoff classifier | available, insufficient sample, excluded rows | Production performance excludes legacy, test, post-start and superseded rows. |
| AI evolution | AI performance center services | prediction history and snapshots | available, fallback, insufficient data | Fallback policy remains explicit when durable snapshots are unavailable. |
| Sport-specific boards | sport-specific prediction APIs | sport-scoped prediction history | ready, validation, health, blocked | Release 02 did not build parallel pipelines. |
| Data quality / reconciliation | data coverage, settlement guarantee and operations APIs | static and read-only operational contracts | pass, degraded, blocked | Existing diagnostic routes expose provider and mutation counters. |
| Administration / operations health | `/api/operations/health`, scheduler and settlement guarantee services | lifecycle events, sync jobs, guarantee status | healthy, late, critical, degraded | Scheduler and settlement evidence remains canonical; no local smoke was run. |

## Repaired Invariants

No runtime invariant required repair in Release 02. The following invariants were verified and documented:

- Final or settled rows should not appear as active pregame betting opportunities.
- No prediction exists should be represented as empty, blocked or missed-window state, not as completed model evaluation.
- Settled predictions should flow to performance only when cutoff-safe and production-eligible.
- Today counts should be derived from canonical event/prediction/coverage contracts.
- Relative freshness should use odds, prediction, event and update timestamps exposed by canonical services.
- AI feed emptiness is allowed only as `EMPTY_VALID` or degraded/blocked state.
- Official Pick state is controlled by existing official-pick policy and market alignment.
- Sport/date filters must remain grounded in canonical service scopes.

## Non-Changes

- No probability formula changed.
- No official-pick threshold changed.
- No learning weight changed.
- No provider adapter changed.
- No database migration was created.
- No retrospective prediction was created.
