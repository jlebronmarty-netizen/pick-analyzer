# Sports Intelligence UI Integrity Refactor V1

Date: 2026-07-21

## Scope

This pass consolidates user-facing market semantics without changing prediction formulas, Official Pick thresholds, scheduler behavior, settlement rules, provider adapters, Current Board generation policy or unsupported-market gates.

## Root Causes Addressed

- Some UI components had fallback explanations with hardcoded matchup text, causing wrong-team references when shared explanation data was missing.
- Market pages exposed stale snapshot EV and fresh actionable EV with inconsistent labels.
- Betting Workbench duplicated classification logic client-side instead of using server-provided Current Board categories.
- Top tracked informational rows could be framed as an opportunity even when value was negative, stale or blocked.
- Projection diagnostics existed in the API but were underexposed in the UI when zero projections were visible.
- Arbitrage notification controls looked more functional than the backend capability supports.

## Validation Evidence

- `npm.cmd run build` passed after the shared contract updates.
- Operations Validation now includes market classification, AI Bet Finder deterministic, Universal Projection Engine and Game Intelligence fixture checks.
- Provider calls remain 0 for these validation fixtures.
- Remote mutations remain 0 for these validation fixtures.

## Caveats

This refactor does not automatically settle old predictions or repair ambiguous production data. Stale pending settlement reconciliation remains a data-operation phase that must only mutate deterministic safe cases.
