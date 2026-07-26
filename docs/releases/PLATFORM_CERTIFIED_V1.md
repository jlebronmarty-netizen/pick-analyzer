# Pick Analyzer Platform Certified V1

Certification date: 2026-07-26

Certified commit: 94159038571ba16cf31107403efce3af7f13ba50

Production URL: https://pick-analyzer.vercel.app

Repository: https://github.com/jlebronmarty-netizen/pick-analyzer

Stable release tag: v1.0-platform-certified

## Certification Summary

Pick Analyzer Platform Certified V1 is the trusted production rollback baseline for the current MLB platform. The certified runtime commit is deployed in production, verified through live API smoke checks and locked for future release-governance purposes.

This certification is documentation-only. It does not change prediction probabilities, confidence formulas, Official Pick policy, settlement grading, Learning Brain behavior, scheduler cadence, odds operations, Dashboard behavior, Performance behavior, Current Board, Most Likely or Best Value.

## Certified Platform Areas

- Architecture: Next.js App Router with service-layer backend contracts, typed API responses and Supabase persistence remains the certified production architecture.
- Canonical operating day: MLB operating-day state, active slate selection, status recovery and pregame market freshness remain canonical.
- GitHub-owned scheduler: GitHub Actions remains the write-capable production operating-day scheduler. Vercel operating-day cron remains disabled for write ownership.
- Adaptive odds refresh: Adaptive refresh planning reports due domains, provider-call forecasts, budget status and freshness state before execution.
- SportsDataIO odds path: Due odds refresh executes the canonical SportsDataIO MLB odds path through the operating-day executor.
- Provider budget controls: Provider budget accounting, per-action caps and reserve thresholds remain active.
- Event lifecycle: Pregame, live, final, completed, settlement-pending and settled states remain separated from market availability.
- Prediction generation: Prediction rows remain cutoff-safe, versioned and scoped to existing champion/current row policy.
- Grounded Opportunities: Visible Grounded Opportunities use persisted prediction rows, real market/selection/probability fields and real odds snapshot metadata when priced.
- Current Board: Current Board remains the canonical candidate contract for current prediction review.
- Most Likely: Most Likely remains highest-probability, pregame-only and excludes live or completed events.
- Best Value: Best Value remains price-integrity gated and does not fabricate EV, edge or missing prices.
- Official Pick policy: Official Pick thresholds and policy gates remain unchanged.
- Results synchronization: Results sync remains scheduler-owned and status-aware.
- Settlement: Settlement grading remains deterministic and scoped to eligible pregame production rows.
- Settlement dry-run safety: GET settlement defaults to dry-run behavior and dry-run execution performs zero mutations.
- Learning chain: Learning evidence remains derived from deterministic settlement labels and does not auto-promote weights.
- Performance: Performance Scope V2 remains the user-facing production performance source of truth.
- Dashboard: Dashboard canonical ViewModel remains the user-facing Today contract.
- Cache invalidation: Dashboard cache clear and read-through invalidation remain the supported production cache refresh chain.
- Operations evidence persistence: Provider attempts, provider checks, provider successes, source timestamps and freshness evidence are persisted and surfaced through operations status.
- User Mode sanitization: Product-facing Performance screens render sanitized labels; raw status and reason codes remain in Internal Diagnostics.
- BSN expected-partial scope: BSN remains Shadow / Preview and EXPECTED_PARTIAL without blocking MLB production validation.

## Latest Proven Production Evidence

- Production commit: 94159038571ba16cf31107403efce3af7f13ba50
- Operations status: SUCCESS
- Operations validation: PASS
- Dashboard validation: 50/50
- Current Board validation: 20/20
- Odds provider cycle received: 15 games
- Odds rows inserted: 90
- Provider calls attributed: 3/3
- Grounded integrity counters: 0
- Settlement dry-run mutations: 0
- Raw User Mode code leaks: 0
- Model policy changes: 0
- Provider evidence:
  - selectedAction: midday_refresh
  - executed domain: odds
  - provider: sportsdataio
  - lastProviderCheckAt: 2026-07-26T12:32:02.411+00:00
  - lastProviderSuccessAt: 2026-07-26T12:32:02.411+00:00
  - latestSourceTimestamp: 2026-07-26T08:31:43.000Z
  - nextRecommendedRefreshAt: 2026-07-26T12:46:53.275Z

## Certification Marks

- ODDS_PROVIDER_EVIDENCE_CONTRACT_PASS
- OPERATIONS_EVIDENCE_PERSISTENCE_PASS
- SCHEDULER_STEP_ATTRIBUTION_PASS
- ODDS_STATUS_TRUTHFULNESS_PASS
- NEXT_REFRESH_TIMESTAMP_PASS
- PERFORMANCE_USER_MODE_ISOLATION_PASS
- OPERATIONS_STATUS_PASS
- DASHBOARD_AVAILABILITY_PASS
- GROUNDING_EVENT_EVIDENCE_SEPARATION_PASS
- GROUNDING_MARKET_LEVEL_MAPPING_PASS
- GROUNDING_PROBABILITY_INTEGRITY_PASS
- GROUNDING_CONFIDENCE_INTEGRITY_PASS
- GROUNDING_PRICE_INTEGRITY_PASS
- NO_SYNTHETIC_ZERO_PLACEHOLDERS_PASS
- SETTLEMENT_DRY_RUN_SAFETY_PASS
- BSN_SCOPE_CLASSIFICATION_PASS
- NO_MODEL_POLICY_REGRESSION_PASS
- PRODUCTION_PLATFORM_CERTIFIED

## Known Scoped Limitations

- BSN remains Shadow / Preview with EXPECTED_PARTIAL classification until explicitly promoted through a future approved phase.
- Unsupported markets remain blocked from recommendations until ingestion, modeling, validation, settlement, replay and dashboard support are complete.
- Portfolio Intelligence V1 is the next approved phase but has not started in this certified baseline.
