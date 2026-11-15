# NHL Special Teams — As-of PP/PK V3 (14 November 2026)

## Goal
Enrich the NHL Moneyline, puck line and total-goals SHADOW challenger with official Power Play % and Penalty Kill % that were observable before a match. Retain NHL Poisson V1 probabilities and existing Official Picks unchanged.

## Grounded audit
- Existing NHL PBP ledger: 69 complete gamecenter PBP records, 539 penalty events observed. A penalty event count is NOT a verified power-play opportunity or penalty-kill percentage; scoring strength and actual opportunities must not be invented.
- The official NHL Stats REST API documents regular-season team summary, powerplay and penaltykill reports with filter cayenneExp. References: https://github.com/pseudo-r/Public-NHL-API/blob/main/docs/stats-rest/teams.md and https://github.com/DI0Rdano/NHL-API-Python-Scraper/blob/main/scraperDocumentation.md
- The schema and external reachability of the 2026-27 team summary response have NOT been independently demonstrated in this environment. The collector therefore fails closed if the report full-name, numeric percent and games-played fields differ from the allowed contract. Never claim successfully captured data before one real source call and DB audit.

## Implemented in research branch
1. A pure exact-team identity normalizer cross-checks official team full names with a previously verified NHL team directory already cached by Pick Analyzer. Only 30–32 unique exact matches, proper 0–1 PP/PK proportions, verified 2026-27 regular-season context and 1–82 games played are accepted.
2. An append-only private research table, nhl_special_teams_asof_v1, saves a single per-UTC-day snapshot with exact fetch URL, capture timestamp, source SHA-256 and team IDs. RLS enabled; anon/authenticated denied; service role SELECT/INSERT only.
3. A separate once-daily bounded source collector, behind NHL_SPECIAL_TEAMS_CAPTURE_ENABLED=true (default OFF). It runs in the existing NHL cron at hour 18 UTC, at minute 07, and performs at most one free NHL Stats API request per UTC day, zero paid API requests, zero retries. Attempts are claimed and audited before the provider call.
4. Prospective freezes may attach the latest official captured PP/PK snapshot only if captured prior to the freeze and not older than 36 hours. Missing or invalid source does not block the existing score-only challenger; frozen evidence explicitly records NOT_READY.
5. New read-only API GET /api/nhl/special-teams-research shows source freshness, team coverage and most recent capture attempt without exposing raw provider secrets. GET /api/nhl/frozen-shadow-audit reports V3 PP/PK coverage; zero report writes.
6. No scoring formula, model weights, OT/SO approximation, market odds, FanDuel contract or eligibility gate changes. A team-season average cannot be replayed as if known earlier in that season. No historical data retrofitting.

## Remaining gaps before improved accuracy
- Official response may use a different team identity or metric schema; verify actual FREE source before treating V3 as operational. If schema fails, leave source disabled and revise parser only with concrete evidence.
- Confirmed upcoming starting goalies need a separate independent timestamped pregame feed; previous-game starter is not today's confirmed goalie.
- Full-game NHL totals and puck-line payouts require fresh sportsbook price, period and OT/SO semantics. Current archived general spread/total odds remain stale. Do not claim FanDuel edge or ROI.
- Accumulate enough genuinely prospective settled records, run a chronological holdout and compare V1 vs V3 with the same games and market price cohort. Brier/log loss and projected-goal MAE must improve robustly before considering formulas for promotion.
- Separate team PP/PK strength is only research context; automatic model weights remain off.

## Safety and release sequence
1. Run all NHL regressions, TypeScript, inspect changed files, deploy a Preview and check source-readiness API.
2. Apply private additive migration only while Supabase SQL and HTTP Data API are healthy. Verify RLS/role privileges and constraint integrity.
3. Merge only after CI + Preview READY and smoke tests. Leave NHL_SPECIAL_TEAMS_CAPTURE_ENABLED absent/false until official source response is validated; later opt into one bounded free call and inspect resulting job logs.
4. No new cron, subscription, paid API call, wager, historical prediction rewrite or automatic promotion.
