# Release 12 Betting Workspace Audit

Status: RELEASE 12 PRODUCT WORKFLOW AUDIT

Release 12 inspected existing product surfaces before implementation. The result is to reuse the existing `/betting-workbench` route as the canonical daily decision workspace instead of creating a second workbench.

## Existing Surfaces

| Surface | Existing Status | Release 12 Decision |
| --- | --- | --- |
| AI Daily Brief | Implemented in Release 09 homepage | Reused as morning entry point with link back from workspace |
| Current Board | `/api/current-board` with candidates and board context | Reused as primary opportunity source |
| Official Picks | `/api/predictions/top` | Reused as Official Pick source |
| Most Likely | Existing product surface | Not duplicated; related intelligence remains separate |
| Best Value | Existing product surface | Not duplicated; value candidates come from Current Board evidence |
| Betting Workbench | Existing `/betting-workbench` route | Completed in place as canonical workspace |
| Model Intelligence | `/api/model/intelligence` | Reused for sample and model context |
| Model Segments | `/api/model/segments` | Reused for segment sample, accuracy, Brier and calibration |
| Performance | `/api/performance` | Reused for production certification only |
| Daily Operations | `/api/operations/mlb-autonomous-operations` and docs | Reused as daily automation evidence |
| Bankroll / Kelly / risk | Existing services and UI fragments exist | Reused arithmetic policy; no formula changes |
| Saved picks / wager tracking | No safe canonical remote user-wager table identified in this phase | Implemented local user-controlled tracking only; no DB mutation |

## What Was Missing

- A single daily board grouped by Official Pick, Value Candidate, Research Pick and No Bet.
- Side-by-side comparison with explicit evidence quality and sample-size labels.
- User-entered price/stake workflow that does not infer sportsbook prices.
- Parlay safety language that refuses combined model probability without validated leg independence.
- Personal wager tracking separated from model settlement and model metrics.
- Event-start and duplicate-selection safety states.

## Reuse Decision

Release 12 uses the existing `/betting-workbench` route and switches its page component to `BettingDecisionWorkspace`. The old component remains untouched as legacy code, but the canonical page now points to the Release 12 workspace.

## Non-Changes

- No prediction formulas changed.
- No Official Picks policy changed.
- No probability recalibration occurred.
- No learning weights changed.
- No scheduler behavior changed.
- No provider contract changed.
- No database migration or remote wager persistence was added.
