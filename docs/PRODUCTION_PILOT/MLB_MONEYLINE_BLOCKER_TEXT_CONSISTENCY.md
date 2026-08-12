# MLB Moneyline Blocker Text Consistency

Status: LOCAL PASS, deployment required

## Scope

This repair is display-only. It does not change prediction probability, odds binding, implied probability, edge, EV, ranking, eligibility, Official Pick thresholds, settlement, learning, provider authority, or SportsDataIO behavior.

## Root Cause

Classification: `WRONG_CANDIDATE_BINDING`

The Moneyline review card displayed the selected review candidate, but its short `Blocked Because` summary could be read from a separate best-review object. During MLB-FINAL-00 production certification this mixed ARI Moneyline positive edge/EV display evidence with blocker text derived from another review candidate that had negative edge evidence.

## Repair

The rendered review-only blocker summary now derives from the same `PlanPick` displayed on the card. The helper filters stale non-positive edge/EV diagnostic codes when the displayed candidate's current edge/EV is positive, while preserving legitimate policy blockers such as calibration, confidence, quarantine, production gate, low edge, and low EV.

Raw diagnostic codes remain available in detailed gate evidence. The short user-facing summary contains current, relevant blockers only.

## Fixtures

| Fixture | Expected blocker behavior |
| --- | --- |
| positive edge / positive EV but blocked elsewhere | Do not show non-positive edge or non-positive EV; preserve policy/calibration/confidence blockers. |
| negative edge / negative EV | Show edge/EV blocker text consistent with the displayed negative values. |
| positive edge below higher policy threshold | Show threshold blocker, not non-positive blocker. |
| positive EV below higher policy threshold | Show threshold blocker, not non-positive blocker. |
| stale previous version replaced by new current version | Blockers are recomputed from the displayed current candidate and stale non-positive codes are removed. |

## Certification

The candidate remains review-only unless existing recommendation policy certifies it. Removing stale blocker text does not promote Official Picks or change recommendation actionability.
