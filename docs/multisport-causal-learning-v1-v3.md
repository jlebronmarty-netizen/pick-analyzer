# Multisport Causal Learning V1–V3

Date: 2026-11-12

## Purpose

Extend the postgame learning framework beyond NBA while keeping production prediction engines immutable.

Common lifecycle:

1. Frozen forecast.
2. Settled outcome.
3. V1 event-flow diagnosis.
4. V2 participant/role and box-score context.
5. V3 sport-appropriate matchup history.
6. Repeated pattern discovery.
7. Challenger research.
8. Validation + holdout.
9. Human review before any production change.

A postgame label is a hypothesis, not proof of causality. No module in this expansion auto-promotes, auto-tunes, or rewrites production picks.

## Sport adapters

### NBA
Already live before this expansion.
- V1: Q1–Q4 + PBP.
- V2: projected vs actual lineup + player-game stats.
- V3: confirmed offensive-player vs defender tracking and repeated pair history.

### NHL
- Official NHL play-by-play and boxscore.
- V1: period flow, lead changes, comeback/collapse, PP goals.
- V2: primary goalie, save percentage, skater TOI and production.
- V3: confirmed shooter-vs-goalie from PBP.
- Bounded to one new context game per run / two official NHL calls.

### NCAAB
- ESPN game summary.
- V1: game flow, halftime state, margin/total errors.
- V2: player/team boxscore.
- V3: player-vs-opponent-team profiles.
- No direct defender assignment is claimed.
- Up to three new settled games per daily run.

### NCAAF
- ESPN game summary.
- V1: drives, scoring drives, turnovers and offensive stalls.
- V2: team stats and QB/RB/WR boxscore groups.
- V3: player/role vs opponent defense.
- No individual defender assignment is claimed.
- One new context game per run.

### Soccer
- ESPN competition-specific game summary when available.
- V1: goals/cards/substitutions and event timing.
- V2: roster/lineup context when supplied.
- V3: player-vs-opponent-team profiles.
- Missing roster lowers evidence quality.
- xG is never inferred when the source does not provide it.
- One new context game per run.

### Table Tennis
- Uses already-persisted settled outcomes only.
- V1: set flow.
- V2: set points, total points, comeback/deuce/sweep patterns.
- V3: direct player-vs-player H2H.
- Zero new provider calls.

### UFC
- Existing frozen Elo prediction/result ledger plus ESPN event summary after settlement.
- V1: forecast vs winner.
- V2: method/round only when provider confirms it.
- V3: direct fighter-vs-fighter H2H.
- Striking/grappling metrics are not fabricated.
- Maximum one event summary call per run after results exist.

### MLB
Prepared for 2027 regular season only.
- Collector remains OFF during offseason.
- V1 planned: inning flow, lead changes, starter/bullpen.
- V2 planned: actual lineup, starter, bullpen, pitch counts.
- V3 planned: batter-vs-pitcher and pitch-type observations.
- Current status: OFFSEASON_PAUSED, provider calls 0.

## Security

All causal-learning storage is backend-only:
- RLS enabled.
- No anon/authenticated table grants.
- Service-role access only.
- No public policy is intentionally created.

## Promotion boundary

The causal layer may produce research hypotheses and aggregate repeated patterns. It cannot change production model weights or Official Picks.

Any future adjustment must become a challenger and show explicit validation plus holdout improvement before it can become a VALIDATED_CANDIDATE. A human then decides whether to approve it.
