# Product Route Inventory V1

Generated: 2026-07-28T20:19:50.860Z

This inventory was refreshed by Product Stabilization And Intelligence Consolidation V1.

## Summary

- User-facing page routes scanned: 28
- API routes scanned: 428
- Read-only diagnostic API routes: 70
- Read-mostly API routes: 321
- Mutation/protected API routes by path: 37
- Runtime smoke: skipped by policy; use the fixed single-endpoint lifecycle harness for endpoint-specific checks.
- Provider calls during inventory: 0
- Remote mutations during inventory: 0

## Major Route Matrix

| Route | Label | Section | Data State | Current Status | Usefulness |
| --- | --- | --- | --- | --- | --- |
| `/sports-center` | Sports Center | HOME | CURRENT_STORED | PRODUCTION_READY_WITH_WARNINGS | High |
| `/ai-operations` | AI Briefing | OPERATIONS | CURRENT_STORED | INTERNAL_ONLY | High |
| `/dashboard` | Dashboard | HOME | CURRENT_STORED | PRODUCTION_READY_WITH_WARNINGS | High |
| `/performance` | Performance | PERFORMANCE | CURRENT_STORED | PRODUCTION_READY_WITH_WARNINGS | High |
| `/probability-picks` | Probability Picks | PICKS | MODEL_GENERATED | LIMITED | High |
| `/portfolio-intelligence` | Portfolio Intelligence | MARKETS | MODEL_GENERATED | LIMITED | High |
| `/market-intelligence` | Market Intelligence | MARKETS | CURRENT_STORED | LIMITED | High |
| `/closing-line-intelligence` | Closing Line Intelligence | MARKETS | CURRENT_STORED | LIMITED | High |
| `/player-projections` | Player Projections | PROJECTIONS | MODEL_GENERATED | PRODUCTION_READY_WITH_WARNINGS | High |
| `/autonomous-daily-ai` | Autonomous Daily AI | OPERATIONS | CURRENT_STORED | INTERNAL_ONLY | High |
| `/data-coverage` | Data Coverage | ADMINISTRATION | CURRENT_STORED | INTERNAL_ONLY | High |
| `/model` | Model Health | PERFORMANCE | CURRENT_STORED | INTERNAL_ONLY | High |
| `/mlb-operations` | MLB Operations | OPERATIONS | CURRENT_STORED | INTERNAL_ONLY | High |
| `/most-likely` | Most Likely | PICKS | CURRENT_STORED | PRODUCTION_READY_WITH_WARNINGS | High |
| `/best-value` | Best Value | PICKS | CURRENT_STORED | PRODUCTION_READY_WITH_WARNINGS | High |
| `/betting-workbench` | Betting Workbench | MARKETS | CURRENT_STORED | LIMITED | High |

## Certification

PRODUCT_ROUTE_INVENTORY_PASS
PRODUCT_ROUTE_INVENTORY_REFRESHED_BY_STABILIZATION_V1
NO_PROVIDER_CALLS_PASS
NO_REMOTE_MUTATIONS_PASS
