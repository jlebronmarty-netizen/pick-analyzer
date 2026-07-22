# End-to-End Prediction Pipeline V1

Status: partial recovery implemented on 2026-07-22.

The production lifecycle is:

1. Vercel cron calls `/api/cron/operating-day` at `12:00 UTC`.
2. Adaptive refresh decides the nearest safe action from stored events, freshness, lifecycle rows, and provider budget.
3. Schedule and status use `sport_events`; market snapshots use `sports_odds_snapshots`.
4. Market predictions persist to `prediction_history`.
5. Current Board reads current, pregame, non-settled prediction rows with safe market prices.
6. Model-only intelligence reads stored prediction probabilities without requiring odds.
7. Pitcher-outs shadows read `universal_projection_history`.
8. Settlement reconciliation classifies pending rows before any deterministic write.
9. Performance reads scoped prediction history and separates generated, eligible, settled, pending, and shadow contexts.

Key finding: only the consolidated operating-day cron is configured in `vercel.json`; other cron routes are callable but not Vercel-scheduled.

