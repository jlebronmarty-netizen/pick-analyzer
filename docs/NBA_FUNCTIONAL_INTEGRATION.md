# NBA functional integration — 2026-11-02

This release adds a private append-only Supabase archive (nba_market_*_v1), validates exact contracts, maps BDL events by existing exact team/time evidence or an explicit BDL namespace, and projects recent main prices into sports_odds_snapshots without overwriting prior rows. Unknown season phase and sportsbook overtime remain unverified; no model or settlement promotion.

The existing NBA cron retains its schedule and original canary behavior. A separate step in the same invocation archives current shared-market data with a 45-second deadline, two workers and no more than 25 gateway requests. It is not a new cron and does not bypass the canary. Data writes happen in production only. Status/precheck stays read-only. A failed or partial archive is explicitly reported independently of the canary.

The original current-day games/odds POST sync routes now use the shared feed when enabled, retaining bearer authentication. Historical requests cannot invent live-feed historical prices. The generic legacy model and feature functions remain unchanged.

Every successful market-data GET through Pick Analyzer archives its response, reports persistence independently of quote retrieval, and preserves source times. The protected archive endpoint exposes GET status and a same-origin POST current-day refresh. Other apps do not get database keys. Scheduled prop capture is bounded and rotated, not exhaustive.

Required schema was applied as migration nba_shared_market_archive_v1 using SECURITY INVOKER, RLS, revoked public/authenticated access, service-role-only function execution and immutable snapshots/quotes/schedules. Four transactional synthetic SQL checks passed; all synthetic inserts were rolled back. Production verification remains required before claiming durable live data.

No prediction, history, official pick, result, model formula or existing cron schedule was changed. Existing NBA injury/lineup/statistical coverage and historical MLB blockers are not repaired by this odds-only release.
