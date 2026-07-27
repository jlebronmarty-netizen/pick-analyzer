# Product Route Inventory V1

Generated: 2026-07-27T17:03:36.545Z

## Summary

- User-facing page routes scanned: 20
- API routes scanned: 409
- Major product routes classified: 16
- API routes marked mutation/protected by path: 41
- Bounded local smoke: 8/9 checks returned HTTP 2xx
- Provider calls during audit: 0
- Remote mutations during audit: 0

## Major Route Matrix

| Route | Label | Section | Data State | Current Usefulness | Known Blockers |
| --- | --- | --- | --- | --- | --- |
| `/` | Home | HOME | PREVIEW | Useful as a starting point only. | Primary daily workflows live under Dashboard and Probability Picks. |
| `/dashboard` | Dashboard | HOME | CURRENT_STORED | High, but dense and mixes product and operator concerns. | Navigation density; some advanced panels expose technical states to normal users |
| `/probability-picks` | Probability Picks | PICKS | MODEL_GENERATED | High when MLB rows exist; needs explicit eligibility labeling. | non-MLB future rows can be accepted before sport certification unless filtered |
| `/most-likely` | Most Likely | PICKS | CURRENT_STORED | High for scanning likely outcomes. | depends on stored current-board coverage and aligned markets |
| `/best-value` | Best Value | PICKS | CURRENT_STORED | Useful when stored prices and policy gates are available. | market coverage gaps |
| `/arbitrage` | Arbitrage | MARKETS | BLOCKED | Limited until multi-book data is present. | multi-book provider coverage unavailable |
| `/ai-bet-finder` | AI Bet Finder | MARKETS | CURRENT_STORED | Useful as an explanation and triage surface. | depends on stored board coverage |
| `/projections` | Team Projections | PROJECTIONS | MODEL_GENERATED | Useful where stored projection rows exist. | sport-specific maturity varies |
| `/player-projections` | Player Projections | PROJECTIONS | MODEL_GENERATED | High for pitcher workload analysis; market comparison is limited by prop coverage. | player-prop ingestion entitlement and identity overlap |
| `/betting-workbench` | Betting Workbench | MARKETS | CURRENT_STORED | Useful for operators and advanced users. | market depth and technical language |
| `/performance` | Performance | PERFORMANCE | CURRENT_STORED | High for model accountability. | requires settled rows and clear distinction between product and diagnostic rows |
| `/ai-operations` | AI Operations | OPERATIONS | INTERNAL_ONLY | High for operators, not a primary consumer screen. | developer-oriented language |
| `/model` | Model | PERFORMANCE | INTERNAL_ONLY | High for governance and operators. | should remain clearly administrative |
| `/mlb-operations` | MLB Operations | OPERATIONS | CURRENT_STORED | High for operators. | provider contracts and market coverage |
| `/game-intelligence` | Game Intelligence | PROJECTIONS | MODEL_GENERATED | Useful for MLB game review. | event coverage and current stored data availability |
| `/admin/historical-diagnostics` | Historical Diagnostics | ADMINISTRATION | MIGRATION_PENDING | High for administrators only. | DATA_FOUNDATION_V2_EPOCH inactive and seed unapplied |

## API Inventory

The machine-readable inventory in `docs/product-route-inventory-v1.json` includes every discovered `src/app/api/**/route.ts` file with a conservative path-based read-only/protected classification.

## Certification

PRODUCT_ROUTE_INVENTORY_PASS
