# MC-08E-R Evidence-First Watchlist Experience

Status: LOCALLY_COMPLETE

MC-08E-R safely resumes the paused MC-08E work from a preserved recovery branch and ports only the bounded Watchlist Experience onto the P2.4-certified baseline.

## Scope

- Homepage Watchlist presentation.
- Existing stored Today and Current Board reads only.
- Typed `watchlist_v1` presentation contract.
- Bounded current-day monitor list with explicit evidence-first status, reason, priority, blockers, promotion conditions, removal conditions and empty states.
- Current V2 Production epoch context only.

## Evidence-First States

- `ACTIONABLE`: existing policy evidence says the item can be acted on.
- `BEST_AVAILABLE_RESEARCH`: best available current evidence exists, but the item is research-only.
- `WATCH`: useful candidate waiting on freshness or price evidence.
- `BLOCKED`: a policy or data-quality blocker prevents action.
- `UNAVAILABLE`: current market evidence is unavailable.
- `NO_CURRENT_EVIDENCE`: no useful current evidence exists.

## Contract

The Watchlist answers what is worth monitoring, why it is not a primary decision yet, what would promote it, what would remove it and whether the limiting factor is price, freshness, value, confidence, policy or evidence. It does not create a new recommendation ranking and does not alter Rent Play, Moneyline, Smart Parlay, Most Likely or Best Value policy.

## Safety

- Provider calls introduced: 0.
- Remote mutations introduced: 0.
- Prediction formulas changed: no.
- Official Pick policy changed: no.
- Rent Play policy changed: no.
- Moneyline Bet policy changed: no.
- Smart Parlay policy changed: no.
- Most Likely ranking changed: no.
- Best Value ranking changed: no.
- Settlement changed: no.
- Learning changed: no.
- Scheduler cadence changed: no.
- Refresh cadence changed: no.

## Empty States

The Watchlist must show explicit no-current-evidence, unavailable-market, blocked, stale/waiting and no-games states. Unavailable odds, probabilities, confidence, edge, EV and timestamps remain unavailable and are never rendered as zero.

## Mission Boundary

MC-08F was not started. MC-03 was not started.
