# Sports Center V1 Product Experience

Date: 2026-07-27

Sports Center V1 adds `/sports-center` as the top-level sport hub for MLB, NBA, NFL, Soccer, BSN, NHL, Tennis and UFC. It exposes sport-by-sport readiness, canonical routes, hidden readiness surfaces and blockers without changing prediction, probability, confidence, quality, Learning Brain, scheduler or settlement logic.

## Status System

Sports Center uses the canonical product status vocabulary:

- Production
- Certified
- Foundation
- Preview
- Planning
- Unavailable
- Blocked
- Pending
- Deprecated

## Product Findings

- MLB remains the only production sport in the hub and links to Dashboard, Probability Picks, Player Projections, Performance and MLB Operations.
- NBA is labeled Foundation because stored/trial readiness exists, but production activation remains blocked.
- BSN is labeled Preview/Foundation because it is a partial custom-league data domain.
- NFL, NHL, Tennis and UFC remain Blocked for production activation.
- Soccer remains Planning because readiness must be scoped by competition and season.
- The old root page hardcoded stale pick content. It now redirects to `/dashboard`, preserving the existing certified daily product entry point.
- Sports Center is exposed in the Dashboard shell under Home and in the top action links.

## Data And Settlement Safety

Sports Center is a navigation and readiness layer only. It does not call providers, write to Supabase, apply SQL, execute imports, rebuild features, switch scheduler behavior, activate epochs, backfill predictions or modify settlement logic.

Settlement row movement is intentionally not changed in this phase. Sports Center surfaces settlement status by linking to Performance and data-foundation evidence. A deeper settlement pipeline root-cause investigation should remain a separate approved phase if row movement issues are observed in production evidence.

## Certification Markers

- SPORTS_CENTER_V1_PRODUCT_PASS
- SPORTS_CENTER_CANONICAL_STATUS_PASS
- SPORTS_CENTER_NAVIGATION_PASS
- SPORTS_CENTER_NO_FAKE_READINESS_PASS
- SPORTS_CENTER_NO_PROVIDER_CALL_PASS
- SPORTS_CENTER_NO_REMOTE_MUTATION_PASS
- SPORTS_CENTER_NO_MODEL_CHANGE_PASS
- SPORTS_CENTER_NO_SETTLEMENT_CHANGE_PASS
- NO_CERTIFIED_PLATFORM_REGRESSION_PASS
