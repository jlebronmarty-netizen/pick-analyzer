# NHL Challenger — Prospective Freeze & Evaluation, V1
Date: 2026-11-14
Branch: research/nhl-forward-frozen-ledger-v1-20261114

## Objective
Create a truly prospective and immutable NHL SHADOW experiment for Moneyline, home -1.5 puck line and Over/Under 5.5. Existing DRatings-based NHL forecasts, sports engines and Official Picks remain unchanged.

## Why staging is required
At the time of this change, Supabase project Pick Analyzer reports ACTIVE_HEALTHY but Data API 5xx error rate is persistently high (the adviser showed 100% errors in the sampled requests). Basic read-only SELECT 1 failed with connection timeout, and the public NHL research and overview endpoints returned HTTP 503. This is a database incident; a healthy deployment alone does not prove that its APIs are functioning.

On 2026-11-15 01:04 UTC, Supabase read-only SELECT 1 succeeded, the project health advisor returned zero alerts, and NHL Overview and Challenger APIs returned HTTP 200. Before applying the migration, recheck database health and confirm the exact PR review and CI; do not infer ongoing health solely from earlier success. The flag NHL_CHALLENGER_FREEZE_ENABLED is deliberately absent (defaults to OFF) until after the migration, deployed code and DB permissions are verified. No official prediction models are modified.

## What is implemented
- Pure, deterministic candidate planner builds a frozen record from the latest **previously completed** official NHL schedule snapshot. It rejects stale evidence (>90 minutes old), mismatched event or team IDs, non-regular-season event IDs, and start times less than 60 minutes from the decision or more than 36 hours away.
- The separate Poisson research baseline must independently pass its minimum league and each-team history gates, using only first-observed official FINAL scores whose capture times precede the freeze.
- One immutable event/model ID; sha256 lineage digest of source scores; frozen_time, source_completed_at, team identities, projections and research-only market proxies.
- Migration creates a restricted, append-only service-only research table nhl_challenger_shadow_v1. No UPDATE/DELETE/TRUNCATE privilege for service_role, RLS enabled, hard checks reject both late *freeze timestamps* and late *database insertion times*, plus any official or production-eligible flags.
- Existing NHL cron invokes the new writer last, only behind environment flag NHL_CHALLENGER_FREEZE_ENABLED=true; five UTC hour windows (11,15,18,20,22), max 3 rows per run, no new provider calls or cron schedule. Historical runs are read in 500-row bounded pages, failing closed at a 2,000-row scan cap. Any Supabase error fails closed without changing model formulas.
- Read-only /api/nhl/frozen-shadow-audit evaluates frozen projections against later observed final scores, without rewriting freeze records, making sportsbook settlement claims or reporting edge/ROI.

## Validation gates
1. Supabase health: SELECT 1 succeeds; Data API error advisory clears or has a verified remediation, and /api/nhl/overview, /api/nhl/challenger-research return HTTP 200.
2. CI: test suite, TypeScript and Preview build pass. Review exact PR diff before merge; verify existing NHL pipeline, NBA and other sports are unaffected.
3. Apply migration via Supabase's migration API only when healthy. Confirm constraints and RLS with read-only queries.
4. Keep flag OFF until test of table CRUD permissions and cron cost envelope; then activate through Vercel on the reviewed release and verify one real scheduled match is frozen more than 60 minutes before puck drop. No forced manual cron or skipped safety gates.
5. Monitor settlement/evaluation on prospectively frozen rows with exact game/team identity, timestamps, market line and period. Continue market source acquisition for truly fresh Moneyline, puck line and total quotes. The Poisson tie-state split is not a verified NHL overtime/shootout probability.
6. At least 30 independently settled future matches for *directional* diagnostics, then holdout validation against the same-game DRatings and de-vig book probabilities; 30 is not enough for statistical proof or automatic promotion.

## Strict limitations
- Price quotes and FanDuel contract-specific semantics are unavailable. The -1.5 and 5.5 are generic **testing** lines, not sportsbook markets or offered prices.
- No player props, betting recommendations, stake sizes, official picks, profitability, ROI or certified market probabilities.
- If the source ledger is unavailable, time/cutoff fails, score histories conflict, or the new table is absent, no rows are inserted.
- Database failure is an active blocker; do not give a false success claim or write late predictions after the fact.
