# Product Readiness Matrix V1

Generated: 2026-07-27

The machine-readable matrix is stored in `docs/product-readiness-matrix-v1.json`.

| Route | Product Area | Status | Data Status | Usefulness | Main Blocker |
| --- | --- | --- | --- | --- | --- |
| `/dashboard` | HOME | PRODUCTION_READY_WITH_WARNINGS | CURRENT_STORED | High | Dense consumer/operator mix |
| `/probability-picks` | PICKS | LIMITED | MODEL_GENERATED | High when MLB rows qualify | Multi-sport certification incomplete |
| `/player-projections` | PROJECTIONS | PRODUCTION_READY_WITH_WARNINGS | MODEL_GENERATED | High | Same-event prop overlap and provider entitlement |
| `/most-likely` | PICKS | PRODUCTION_READY_WITH_WARNINGS | CURRENT_STORED | High | Stored prediction and market coverage required |
| `/best-value` | PICKS | PRODUCTION_READY_WITH_WARNINGS | CURRENT_STORED | Medium-high | Market coverage and freshness |
| `/arbitrage` | MARKETS | BLOCKED | BLOCKED | Low until provider data exists | Verified multi-book coverage unavailable |
| `/betting-workbench` | MARKETS | LIMITED | CURRENT_STORED | High for advanced users | Technical language and market depth |
| `/performance` | PERFORMANCE | PRODUCTION_READY_WITH_WARNINGS | CURRENT_STORED | High | Settled sample size for trend claims |
| `/ai-operations` | OPERATIONS | INTERNAL_ONLY | CURRENT_STORED | High for operators | Developer-oriented language |
| `/admin/historical-diagnostics` | ADMINISTRATION | INTERNAL_ONLY | MIGRATION_PENDING | High for admins | DATA_FOUNDATION_V2_EPOCH inactive |

## Cross-Screen Findings

- Most user value is concentrated in Dashboard, Probability Picks, Player Projections, Most Likely, Best Value and Performance.
- Operations, Model and Historical/Data Foundation surfaces are useful but should remain clearly administrative.
- Arbitrage should stay blocked until verified multi-book lines exist.
- Player-prop comparison should remain same-event gated and must not attach stored lines across events.
- Probability Picks now blocks uncertified sports from normal ranking.

## Remaining Backlog

- Split consumer navigation from operator/admin diagnostics.
- Add more uniform freshness labels across every data-heavy panel.
- Add richer per-sport empty states once future engines are certified.
- Reduce internal reason-code language in advanced consumer pages.

## Certification

PRODUCT_READINESS_MATRIX_V1_PASS
PRODUCT_DATA_TRUST_AUDIT_V1_PASS
PRODUCT_VISUAL_READINESS_PASS
