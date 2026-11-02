# NBA shared market data — Preview integration 2026-11-02

Read-only page `/nba-market-data` and API `/api/market-data/nba`. Direct to the isolated `NBA_MARKET_DATA_V1` gateway; not through another app's production routes. No model, ingestion, DB, ledger, settlement or cron changes. Existing pages and providers unchanged.

Requires VERCEL=1, VERCEL_ENV=preview, branch `research/nba-shared-feed-20261102` and branch-scoped `NBA_SHARED_FEED_ENABLED=true`. Production and other branches fail closed. All Preview routes MUST remain covered by Vercel Deployment Protection; the platform is the incoming authentication boundary. The server forwards only the Vercel-injected short-lived `x-vercel-oidc-token` to the fixed gateway origin via `x-vercel-trusted-oidc-idp-token`. No API key is distributed or returned. No user-supplied upstream URL and no redirect following.

The gateway needs a Trusted Sources rule for this caller: from preview to preview only. The initial API configuration attempt returned HTTP 404 `Deployment Protection Trusted Sources not found`; until the rule is successfully applied and tested the reader must show FEED_ACCESS_DENIED, not mock prices. No shared static bypass secret is introduced.

UI queries only when requested. It displays exact contracts, timestamps, player-directory identities, source warnings and snapshot IDs. Freshness is recomputed at receipt; age displayed is explicitly the age at consultation. Prices are not model probabilities or recommendations. Complete menu, regional execution, overtime and SGP are not certified. BDL IDs are not silently mapped to ESPN IDs.

Tested standalone reader with 38 synthetic tests; gateway/adapters baseline 71 synthetic tests re-run. Full app deployment/authorization result must be recorded separately; synthetic success is not live integration certification. Keep main and cron config unchanged; no production promotion authorized.
