# MLB Daily Full-Slate Moneyline Parlay Experiment V1

Status: ACTIVE / RESEARCH-ONLY  
Official Picks: unchanged  
APOSTAR: disabled  
Production betting eligibility: false

## Scope

Moneyline only. Every frozen ticket contains exactly one ML side from every game on that day's MLB slate.

## Dynamic ticket-count rule

- 1 game: no parlay
- 2 games: 2 tickets
- 3 games: 4
- 4 games: 8
- 5 games: 16
- 6 games: 25
- 7 games: 50
- 8 games: 100
- 9 games: 150
- 10 games: 300
- 11 games: 500
- 12+ games: 1,000

Stake convention: $1 theoretical stake per ticket.

## Construction

1. Strictly pregame frozen evidence only.
2. No live/postgame information in ranking.
3. Enumerate the binary full-slate outcome space.
4. Rank combinations using the frozen MLB ML engines/signals available for that date.
5. Do not retune formulas from later outcomes.
6. Freeze the exact portfolio and digest before settlement.
7. Preserve sportsbook ML prices for payout calculation when available.
8. Cancelled/void games are removed from settled payout according to sportsbook convention.
9. Research/shadow only.

## Baseline backtest

A leakage-safe ELO pregame baseline was evaluated over all complete ELO days available in 2026:
- 2026-03-25 through 2026-09-14;
- 2,255 games;
- 171 dates total;
- 169 eligible parlay dates after excluding 1-game slates;
- 26 winning full-slate outcome combinations covered;
- hit rate: 15.38%;
- average tickets/day: 817.8;
- random-space coverage benchmark under the same ticket counts: ~11.21%.

This baseline is not the final full-engine backtest. It measures whether the dynamic ticket-count rule plus pregame ELO ordering captures the realized slate outcome. Future engine variants must be compared against this frozen baseline without changing the ticket-count rule after seeing results.
