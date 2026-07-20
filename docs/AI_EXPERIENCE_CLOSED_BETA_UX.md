# AI Experience & Closed Beta User Experience

Status: Implemented
Version: V1
Last updated: 2026-07-19

## Goal

Expose the intelligence Pick Analyzer already generates without changing prediction formulas, projection formulas, Official Pick thresholds, champion state, V7, settlement, learning, Temporal Truth, Projection Integrity or provider integrations.

## User Mode

The dashboard now prioritizes:

- Today's recommendation.
- Market mood.
- Today's Story.
- Most Likely rankings.
- Best Value rankings.
- AI Leans, Watchlist and Avoid explanations.
- Richer game cards with primary prediction, confidence, category, reason, freshness and data-quality language.
- Truthful System Health labels.

## Ranking Separation

Most Likely ranks by probability and is informational only.

Best Value ranks by edge, expected value, confidence and value evidence.

Official Picks remain separate and policy-owned.

## Empty States

Empty states explain why intelligence is unavailable instead of showing bare zeroes. Projection Board explains that projections remain hidden until identity, participation, feature quality, sample size, unit and plausibility gates pass.

## Reliability

Today/User Mode now consumes the typed `/api/dashboard?mode=today` reliability envelope. Optional Most Likely, Best Value and AI Bet Finder insight failures render as partial section states instead of blanking the full panel. Stale odds or `odds_not_current` appear as warnings/degraded health context, not as a total Today failure.

## Guardrails

- No fabricated projections.
- No unsupported markets exposed.
- No Official Pick policy changes.
- No Current Board policy changes.
- No provider calls added by User Mode reads.
- No remote mutations.
