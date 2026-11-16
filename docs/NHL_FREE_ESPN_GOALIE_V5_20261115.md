# NHL V5 — Free ESPN probable goalie evidence (Nov 15, 2026)

## Objective
Capture **prospectively observed** publicly available ESPN probable goalies for NHL games without subscriptions, and never conflate them with confirmed starters. Maintain existing NHL SHADOW Poisson probabilities and DRatings Moneyline forecasts unchanged.

## Provider proof in one-shot preview
- One free ESPN scoreboard request for 2026-11-15 at 2026-11-16 00:40 UTC returned 5 games; all five had goalie probable entries for both teams.
- These objects use name=probableStartingGoalie and abbreviation=SG; athlete.id and displayName are ESPN IDs and names, not NHL player IDs.
- The scoreboard does **not** demonstrate verifiable, published-before-tipoff confirmed-starter status. Even for games already in progress it continues to show goalie probable entries. Therefore all collected data are PROBABLE_ONLY and never auto-confirmed.
- Source: https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=20261115

## Additive, low-cost implementation
- Strict exact team full-name matching against the existing verified NHL schedule, date/time start within 15 min, scheduled state, >=60 minutes until puck drop, and a validated ESPN probableStartingGoalie SG entry.
- One **free** ESPN league-wide scoreboard GET per UTC day at 22:07 UTC in the existing NHL cron (no new schedule), only with fresh NHL schedule and pregame games. Flag NHL_ESPN_GOALIE_CAPTURE_ENABLED defaults OFF.
- A deterministic job claim in sports_sync_jobs, 14s timeout, 3MB response cap, no retries, no paid API, no redirects. One successful pregame snapshot/day in append-only nhl_espn_goalie_probables_v1 with RLS, service SELECT/INSERT, sha256 provenance and captured timestamp.
- Existing frozen NHL SHADOW rows are immutable and unchanged. New V1 records may attach optional features.goalieProbablesV5 only if the record was captured prior to freeze and has exact event/teams/time evidence. No source means an explicit NOT_READY, without blocking existing Poisson scoring.
- Read-only GET /api/nhl/espn-goalie-readiness exposes coverage, capture attempts and zero confirmed starter claims.
- No NHL or ESPN goalie stats may be treated as verified until a stable ESPN-to-NHL player-ID crosswalk is independently validated. Historical NHL boxscore starters and current probable ESPN athletes are separate source types. No model performance claims.

## Next model evaluation
1. Compare ESPN probable goalie selections against **postgame official NHL boxscore starter** only with verified player identity crosswalk or unambiguous sourced identity. Track correct/incorrect/unknown as separate denominators.
2. Once observed and settled, evaluate challenger V1 versus an experimental goalie-aware V2 on the same chronologically frozen games. Do not tune on future outcomes. Holdout samples must demonstrate probability calibration and scoring improvements before adoption.
3. Moneyline, puck line and total odds must be frozen as matched exact source/time/line/market-rule pairs. Circa spread/totals are being collected from free DRatings already fetched by NHL cron; these are not FanDuel prices or a certified betting edge.

## Release gates
CI and strict TS, Vercel Preview 200, Supabase health 200 and reviewed migration with RLS/restricted grants. Merge guarded code only after validation. Activate flag only after production READY and schema permissions verified; do not manually trigger the existing NHL cron outside normal cadence. Never rewrite previous predictions or create paid subscriptions.
