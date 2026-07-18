# MLB Market Expansion V1

## Verified Markets

The current SportsDataIO MLB `GameOddsByDate` production path is verified for:

- moneyline
- run line / spread
- total

These markets have normalization, storage, feature generation, prediction rows, Current Board presentation and conservative official-pick gating. They still require production eligibility, calibration, confidence, data sufficiency and value gates before any official pick.

## Blocked Or Unavailable Markets

The following markets must remain unavailable or ingestion-blocked until verified provider payloads and downstream contracts exist:

- team totals
- alternate run lines
- alternate totals
- first five innings moneyline
- first five innings run line
- first five innings total
- first inning moneyline
- first inning total
- NRFI/YRFI
- pitcher strikeouts, outs, earned runs, hits, walks, wins and fantasy points
- batter hits, total bases, home runs, RBIs, runs, walks, strikeouts, stolen bases and fantasy points

Do not route these through the full-game moneyline model. Each needs a market-specific normalizer, feature requirements, settlement rule, push rule, calibration status and UI availability before promotion.

## Projection And Feature Completeness

The 2026-07-17 projection endpoint returned 0 rows. Current readiness:

- starting pitcher ready: false
- lineup ready: false
- injury ready: false
- weather ready: false
- projection ready: false

These domains should appear as missing critical inputs and reduce data sufficiency. They must not be fabricated from odds or team names.

## Arbitrage

Consensus-only pricing cannot prove arbitrage. Arbitrage remains:

`ARBITRAGE UNAVAILABLE - VERIFIED MULTI-BOOK PRICING REQUIRED`

The scanner requires at least two distinct named sportsbooks with simultaneous prices for the same event, market, line, participant and settlement rules.
