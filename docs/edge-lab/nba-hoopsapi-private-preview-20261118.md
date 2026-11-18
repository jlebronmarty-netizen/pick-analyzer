# HoopsAPI NBA quarter/half odds: private Preview only (2026-11-18)

## Scope and source
HoopsAPI's public reference https://hoopsapi.com/docs describes a single GET https://hoopsapi.com/api/v1/games?competition=NBA returning upcoming NBA games, with period keys ft, h1, h2, q1, q2, q3 and q4, bookmaker names, and the available moneyline, spread, total, team_total_home and team_total_away main markets. Authentication uses a server-side Authorization Bearer header. The Free plan advertises 10 requests per rolling 24 hours; the provider returns HTTP 429 at its limit. The live FanDuel coverage and Puerto Rico jurisdiction are unverified until tested.

## Change
- HOOPS_API_KEY is a sensitive Preview-only Vercel environment variable, not a Next.js public variable.
- Protected Preview route: GET /api/nba/hoopsapi-preview gives dry-run status and uses zero provider calls. POST requires a Vercel OIDC identity, a same-origin JSON browser request, exact confirmation, and VERCEL_ENV=preview.
- One user-initiated POST makes exactly one remote GET. No cron, retry, polling, per-game calls, automatic capture, Supabase writes or production changes.
- The external provider enforces 10 requests per rolling 24 hours; no durable application-side quota ledger yet. Do not automate until a ledger and dedupe guard are installed. Calling the button repeatedly can consume the free plan.
- Preview page /nba-hoopsapi-preview has a single manual button; no quotes appear until triggered. Results are research-only, never official picks.
- Parser accepts NBA and the exact fanduel bookmaker, preserves period and market, home-spread sign convention, decimal odds, approximate American conversion, timestamp, quote ID and missing coverage. No fallback bookmaker, synthetic lines or synthetic outcomes.
- The games-list endpoint returns only main prices, not alternates. No crosswalk to BALLDONTLIE games, L5/L10 analysis, calibrated probabilities, EV, recommendations, prediction writes or settlement in this phase.

## Verification gates
1. Node fixture tests for quarter/half prices, home handicap versus away sign, missing bookmaker, malformed price, one network call and 429.
2. Vercel protected Preview deployment with HOOPS_API_KEY present; status GET should make zero provider calls.
3. An authorized browser user manually presses the POST button once. Record actual NBA games, FanDuel coverage, periods, markets, provider timestamps, and gaps.
4. Review real response before approving persistent snapshots, a rolling-24h application quota ledger, any scheduled refresh and eventual Excel comparison.

Production, main, existing NBA/GOAT, other sports, models and all crons remain unchanged by this branch. No paid plan required.
