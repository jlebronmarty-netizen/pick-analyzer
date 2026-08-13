# MLB Official Pick + MC-08B Integrity Certification

Status: `MLB_OFFICIAL_PICK_MC08B_INTEGRITY_REPAIR_READY_FOR_DEPLOYMENT`

Baseline commit: `920d8017e2e9cbbe3b567b6ff394024e15c737c0`

Production evidence time: `2026-08-13T22:16:53.083Z`

## Finding

MC-08B Rent Play and Moneyline were not incorrectly withholding a valid Official Pick. The current Official Pick policy is stricter than the visible Rent Play review gates:

- probability: `>= 52%`
- confidence: `>= 65%`
- edge: `>= 5%`
- EV: `>= 5%`
- freshness: non-stale under the active product freshness SLA
- calibration: `acceptable` or `mature`
- production gate: production eligible, non-quarantined, non-trial, non-scrambled
- timing: future event, before cutoff, unsettled
- identity: supported market with model, feature snapshot and exact price evidence

The observed `MIL @ LAD` moneyline review candidate had fresh complement-bound FanDuel evidence at `-140`, model probability `60.59%`, implied probability `58.33%`, edge `+2.26%`, EV `+3.87%` and confidence `42.62%`. It was legitimately rejected by Official Pick policy: confidence below `65%`, edge below `5%`, EV below `5%`, calibration insufficient and production gate/quarantine blockers present.

## Repair

The bounded runtime repair updates the homepage presentation contract only:

- deterministic policy rejection is shown as `Official Pick eligibility: FAIL`, not vague `PENDING`;
- policy blocker details are carried on the displayed candidate;
- stale raw-row `NON_POSITIVE_EDGE` / `NON_POSITIVE_EV` blocker strings are suppressed when the canonical displayed edge/EV are positive;
- Rent Play, Moneyline and Smart Parlay risk copy now exposes the canonical policy blocker chain;
- no candidate is promoted, no threshold is changed and no formula is changed.

## Current-Day Counts

| Transition | Count |
| --- | ---: |
| Canonical predictions | 9 |
| Current Board candidates | 9 |
| Probability floor passed | 8 |
| Fresh price/freshness passed | 7 |
| Positive edge and EV | 7 |
| Official edge threshold passed | 6 |
| Official EV threshold passed | 6 |
| Official confidence threshold passed | 0 |
| Calibration/data-quality gate passed | 0 |
| Official-pick eligible | 0 |
| Promoted/persisted Official Picks | 0 |

## Circularity

Official Pick eligibility is the output of `evaluateRecommendationEligibility` and `buildOfficialPickContract`. Recommendation eligibility does not require an existing Official Pick. Rent Play and Moneyline consume Official Pick state downstream as an actionability gate, so no circular dependency was found.

## Safety

No prediction formula, confidence formula, edge/EV calculation, Official Pick threshold, settlement rule, learning rule, provider authority, scheduler cadence, MLB data-source mode, NBA historical foundation or SportsDataIO rollback-only behavior is changed.

