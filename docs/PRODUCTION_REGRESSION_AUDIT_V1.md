# Production Regression Audit V1

Date: 2026-07-23

Baseline commit: `7930f708a0e8a64ce989bf73ebded140353cc43e`

## Mission

Audit production-facing user experience after Historical Intelligence, Feature Store Phase 2A and Settlement V2, and restore intended production behavior without removing backend architecture or changing prediction logic.

## Non-Regression Rules

- Historical Intelligence, Feature Store Phase 2A, Settlement V2 and the historical database remain intact.
- Prediction Engine probabilities, Learning Brain logic, Official Pick policy, Current Board policy and market pipelines were not changed.
- Sports provider calls remained 0 during this audit.
- Recovery uses existing persisted prediction, event, odds, result, settlement and performance data only.

## Stored Data Audit

Read-only Supabase diagnostics over `prediction_history` and `sport_events` found:

- Prediction rows: 1,327
- Result wins: 304
- Result losses: 316
- Pushes: 0
- MLB current model rows: 897
- Future MLB events: 897
- Legacy rows by V2 metadata: 342
- Ignored rows by V2 metadata: 365
- Generated rows by V2 metadata: 548
- Settled rows by V2 metadata: 72
- Compatibility `status` distribution: 707 rows still carry `status = pending`, while V2 lifecycle metadata is authoritative.

## Regressions Found

### Current Board

Status: Diagnosed, policy preserved.

Finding: Current Board was not emptied by Historical Intelligence or Feature Store. It remained strict about safe current market odds, active pregame events and settlement state. The confusing part was user-facing: when safe current odds were absent or stale, downstream surfaces looked empty instead of explaining the odds dependency.

Recovery: No Current Board eligibility or Official Pick policy changes were made. The recovery surfaces the reason more clearly and lets probability-only tools use stored model-only intelligence separately.

### Most Likely

Status: Fixed.

Finding: The service already had a model-only fallback for the spotlight, but the main opportunity list could remain empty when Current Board had no safe market rows. Users saw a waiting state even though stored model probabilities existed.

Recovery: Most Likely now converts stored model-only outcomes into informational opportunity rows when safe Current Board rows are unavailable. These rows are labeled `Model Only`, have no actionable EV, no stake and no Official Pick eligibility.

### Best Value

Status: Policy preserved.

Finding: Best Value should remain empty unless current market odds and positive EV are available. The issue was copy clarity, not calculation.

Recovery: User-facing empty states now explain that Best Value requires current market odds and positive EV while model-only probabilities remain visible separately.

### AI Feed

Status: Preserved.

Finding: AI Feed is correctly Current Board driven and must not promote invalid picks.

Recovery: No promotion behavior changed. Empty states and Today story now use plain production language rather than technical placeholders.

### User Mode

Status: Fixed.

Finding: Primary UX exposed technical labels such as `No Market`, `Pending`, `Waiting` and unavailable-style wording without explaining the dependency.

Recovery: User Mode now uses plain explanations such as `Waiting for sportsbook odds`, `Awaiting update` and `Odds pending`. Technical detail remains available in advanced surfaces.

### Performance

Status: Fixed.

Finding: Settlement V2 intentionally left legacy compatibility fields such as `status = pending` while writing authoritative V2 lifecycle metadata. Performance trust could still include `Legacy`, `Ignored`, `Historical`, `Replay` or `Shadow` rows in production trust calculations, making production trust appear worse or stuck.

Recovery: Production trust, Brier, log loss, calibration, report cards and production performance metrics now evaluate production rows only. Legacy and ignored rows remain visible in history and lifecycle timeline but no longer lower production trust.

## Surface Status

- Dashboard: recovered wording and Today story clarity.
- Current Board: policy preserved; diagnostics unchanged.
- Most Likely: recovered list visibility from stored model-only probabilities.
- Best Value: market/EV gate preserved with clearer empty state.
- Betting Workbench: no policy changes.
- AI Feed: no invalid-pick promotion.
- Performance: production trust separated from legacy/ignored/history/shadow rows.
- Historical Intelligence: preserved.
- Settlement V2: preserved as lifecycle authority.
- Feature Store Phase 2A: untouched.

## Production Isolation

This recovery did not modify:

- Prediction probabilities
- Current Board eligibility
- Official Pick policy
- Learning Brain logic
- Historical feature-store code or data
- Replay generation
- Provider-call behavior

## Certifications

- `PRODUCTION_REGRESSION_PASS`
- `UX_RECOVERY_PASS`
- `CURRENT_BOARD_PASS`
- `MOST_LIKELY_PASS`
- `BEST_VALUE_PASS`
- `PERFORMANCE_PASS`
