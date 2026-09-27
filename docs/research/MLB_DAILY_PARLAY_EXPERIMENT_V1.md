# MLB Daily Full-Slate Moneyline Parlay Experiment V1

Status: ACTIVE / RESEARCH-ONLY
Official Picks: unchanged
APOSTAR: disabled
Production betting eligibility: false

## Goal

For each MLB slate, enumerate the binary full-slate Moneyline outcome space, rank the best complete-slate combinations using frozen pregame ML evidence, freeze the requested portfolio, settle the exact frozen portfolio after every game is final, and measure realized return versus theoretical stake.

## Non-negotiable market scope

**MONEYLINE ONLY.**

No props, Run Line, Totals, NRFI/YRFI, pitcher markets, batter markets or other markets may enter this experiment.

Every ticket contains **exactly one Moneyline side from every game on the slate**.

For an N-game slate there are 2^N complete ML outcome combinations. Example: 15 games = 32,768 possible 15-leg ML parlays.

## Daily portfolio size

- 13+ MLB games: best 1,000 unique full-slate ML parlays
- 10-12 MLB games: best 500 unique full-slate ML parlays
- Under 10 MLB games: best 250 unique full-slate ML parlays

## Construction contract

1. Pregame only; no live score or same-day outcome information.
2. Every ticket uses all games on the slate.
3. Exactly one ML selection per game.
4. Preserved sportsbook ML prices determine parlay payout.
5. Outcome ranking starts from no-vig market probability and the frozen MLB Outcome + Portfolio Engine.
6. Existing frozen ML signals may be added when they are available strictly pregame; they may not be fabricated when absent.
7. The active selective Pick Analyzer gate `pregame_high_conf_home_v2` remains a selective signal only and must not be converted into a fake calibrated probability.
8. MLB Outcome + Portfolio Engine V1 uses the frozen default architecture:
   - market no-vig probability as logit offset;
   - external residual coefficient 0.25;
   - starter 0.30;
   - bullpen 0.18;
   - offense 0.18;
   - lineup 0.22;
   - weather 0.08;
   - travel 0.08;
   - repeat same-favorite won -0.18;
   - repeat same-favorite lost -0.10;
   - home-favorite 0.03;
   - quality weighting;
   - favorite-failure score;
   - slate-regime mixture: favorite-heavy 15%, neutral 55%, upset-heavy 20%, chaos 10%.
9. Missing optional engine features remain neutral/zero rather than being inferred from postgame data.
10. Rank complete-slate outcomes with the Portfolio Engine V1 core score:
    72% normalized modeled outcome probability + 10% normalized proxy expected return + 18% favorite-failure alignment.
11. Fixed paper stake: $1 per frozen ticket.
12. No promos, boosts, insurance, cash-out assumptions or correlated-market substitutions.
13. Freeze exact deterministic inputs, ranking method and digest before settlement.
14. Never retune thresholds or weights from the daily results.

## Settlement

Because every ticket covers the entire slate and contains exactly one side per game, only one binary full-slate outcome can be the exact winner when all games settle without voids.

Daily settlement records:
- exact winning full-slate combination;
- whether it was inside the frozen portfolio;
- winning ticket rank, if present;
- winning ticket payout;
- theoretical total stake;
- gross return;
- net P/L;
- ROI;
- whether realized gain exceeded the theoretical investment.

Void/postponement handling must use preserved sportsbook settlement rules when known; otherwise mark the day UNEVALUABLE rather than inventing settlement.
