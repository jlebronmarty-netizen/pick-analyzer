# Probability Picks Multi-Sport Audit V1

Generated: 2026-07-27

## Finding

Probability Picks V1 read valid future rows from `prediction_history` across registered sports. Lifecycle checks excluded post-start, replay, shadow, historical and settled rows, but the ranking path did not also require sport-level production certification. That meant a future row from an uncertified sport could appear as a normal global Probability Pick if it met probability, confidence and quality filters.

## Eligibility Contract

| Sport scope | Classification | Ranking eligible | Reason |
| --- | --- | --- | --- |
| `baseball_mlb` | `CERTIFIED_LIMITED` | Yes | MLB stored pregame probability rows and MLB pitcher projection previews have local projection-only certification evidence. |
| Any other sport | `ENGINE_NOT_CERTIFIED` | No | The sport may be registered or have stored diagnostic rows, but it is not certified for global Probability Picks ranking in V1. |

## Safe Fix

- Added explicit sport eligibility metadata to each Probability Pick.
- Filtered uncertified sports before ranking sections and parlay construction.
- Added response-level `sportEligibility` summary with eligible sports, excluded sports and excluded row count.
- Added UI labels for sport eligibility, data status and engine certification.
- Added a sport filter that shows only certified ranking-eligible sports.
- Clarified that Probability is estimated likelihood, Confidence is trust in that estimate, and Quality is input completeness.

## Boundaries

- Probability math was not changed.
- Confidence, quality, risk and score formulas were not changed.
- No provider calls were added.
- No persistence, SQL, imports, feature rebuilds, scheduler behavior, Official Pick policy, EV, Kelly, bankroll, stake or Portfolio Intelligence behavior was added.

## Product Result

Probability Picks can still show MLB projection-only rankings when rows qualify. Registered but uncertified sports now produce honest insufficient-certification/empty-state behavior instead of being ranked as normal picks.

## Certification

PROBABILITY_PICKS_SPORT_ELIGIBILITY_PASS
NO_UNCERTIFIED_SPORT_RANKING_PASS
PROBABILITY_CONFIDENCE_CLARITY_PASS
NO_PROBABILITY_LOGIC_CHANGE_PASS
NO_PROVIDER_CALL_BREACH_PASS
NO_DATABASE_MUTATION_PASS
