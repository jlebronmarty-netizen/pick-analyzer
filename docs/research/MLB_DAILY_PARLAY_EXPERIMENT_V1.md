# MLB Daily Parlay Experiment V1

Status: ACTIVE / RESEARCH-ONLY
Official Picks: unchanged
APOSTAR: disabled
Production betting eligibility: false

## Goal

Scan the complete MLB slate each day, use only frozen pregame evidence from existing certified/research engines, generate a fixed portfolio of ranked parlays, settle the exact frozen portfolio after games finish, and measure realized return versus theoretical stake.

## Daily portfolio size

- 13+ MLB games: 1,000 parlays
- 10-12 MLB games: 500 parlays
- Under 10 MLB games: 250 parlays

The slate-size bucket is based on total MLB games on the schedule. A parlay does not need to contain every game. The engine scans the full slate and uses only games with evaluable frozen legs.

## V1 construction contract

1. Pregame only. Every source leg must be frozen strictly before first pitch.
2. No postgame recomputation and no use of same-day outcomes.
3. Only QUALIFIES_MARKET_VERIFIED legs are eligible from approved prop engines.
4. Moneyline / Run Line / Total legs may enter only when their own frozen runtime contract produces an eligible pregame selection with a usable price.
5. No forced slate filling. A game with no qualified/evaluable leg contributes no leg.
6. Same sportsbook within each parlay.
7. Maximum one leg per MLB game within a parlay.
8. V1 leg counts: 3 to 5.
9. Fixed theoretical stake: $1 per parlay.
10. Book boosts, insurance and promos are ignored.
11. The combined "joint proxy probability" is a ranking heuristic only. Joint probability is NOT certified. For legs without calibrated event-level probability, frozen historical accuracy is used only as a proxy.
12. Positive proxy edge means proxy_p > sportsbook implied probability. This is not a certified EV claim.
13. To limit combinatorial duplication, retain at most the top two positive-proxy-edge legs per sportsbook/game before parlay generation.
14. Rank the eligible portfolio by proxy expected-return factor, then joint proxy probability, then decimal payout.
15. Freeze the exact ranked portfolio with a digest before settlement.

## Settlement

For each frozen parlay:

- WIN only if every leg wins;
- LOSS if any leg loses;
- VOID/PUSH handling follows the underlying sportsbook settlement convention where the preserved evidence supports it;
- if a leg cannot be settled from authoritative data, mark the parlay PENDING/UNEVALUABLE rather than infer an outcome.

Daily tracker records:

- slate games;
- target number of parlays;
- actual frozen parlays;
- theoretical stake;
- winning parlays;
- losing parlays;
- pending/void;
- gross return;
- net profit/loss;
- realized ROI;
- average winning payout;
- largest winning payout;
- break-even wins required from the actual payout distribution;
- whether realized gain justified the theoretical investment.

No threshold retuning is permitted from daily results.