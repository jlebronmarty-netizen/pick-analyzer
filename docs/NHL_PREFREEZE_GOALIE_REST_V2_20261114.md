# NHL V2 — Prefreeze Historical Goalie & Rest (14 November 2026)

## Scope
This is an evidence-only feature extension to the versioned NHL Poisson SHADOW model. It does not change scoring weights or generate/replace any Moneyline, Puck Line, or Total prediction. Existing V1 probabilities and projections must remain identical for the same frozen official-score input.

## Evidence already present in Pick Analyzer
- NHL gamecenter final boxscores stored in nhl_game_context_v2 cover 69 games and both teams.
- 67 of those games have explicit historical starter flags. All 134 starter rows checked had valid TOI and saves + goals against = shots against. Starter labels describe the earlier completed game, NOT the next game.
- Source is the official NHL Gamecenter boxscore. Data is considered only if its persisted boxscore_captured_at is not later than the SHADOW decision time, and its historical game start is at least four hours earlier.
- Prior team rest evidence comes from previously observed NHL final score records with capture times before the decision.

## New behavior
1. A pure evidence normalizer checks NHL game ID, regular-season FINAL, team identity, goalie identity, positive TOI and consistent shot totals.
2. The as-of extractor derives each team's previous observed game, elapsed rest, <36h and <48h indicators, and the last recorded historical starting goalie's recent save percentage and workload.
3. The existing immutable SHADOW row stores these observations, as-of timestamp and SHA-256 evidence digest inside features.pregameContextV2. It does not feed scoring.
4. Existing NHL_CHALLENGER_FREEZE_ENABLED controls capture, using the existing cron. Zero extra provider calls, zero new migrations, no new schedules or paid subscriptions.
5. Frozen audit distinguishes context coverage and missing historical goalie/rest, and continues to report the next starting goalie, injuries, PP/PK, xG, travel and exact FanDuel market quotes as UNVERIFIED.

## Testing & safety
- Reject malformed IDs, non-finals, capture after decision, ambiguous starter identity, missing stats and late freeze.
- Unit test that V1 scores-only projections and V1 plus V2 feature evidence produce identical projections and Poisson probabilities.
- Validate incremental accuracy only on later prospective, settled data with proper chronological holdout. No retroactive correction of frozen decisions.
- To add confirmed next starting goalie, capture a separate source with pregame timestamps and team/goalie IDs. Never infer it from the previous game.
- Official NHL Stats REST has team powerplay and penaltykill reports, but these must be frozen with explicit date filters before any model use.

## Rollout
Run NHL tests, strict TypeScript and preview build. Merge only when other models remain unchanged. No migration or new flag is required. The SHADOW ledger may legitimately remain empty if no matchup passes the minimum historical gates.
