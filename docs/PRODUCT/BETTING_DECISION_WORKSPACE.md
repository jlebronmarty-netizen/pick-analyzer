# Betting Decision Workspace

Status: RELEASE 12 IMPLEMENTED

Canonical route: `/betting-workbench`

Release 12 turns the existing Betting Workbench route into a practical daily decision workspace for reviewing, comparing, drafting and tracking betting decisions with existing Pick Analyzer intelligence.

## Source Data

The workspace reads:

- `/api/current-board?mode=current&limit=100`
- `/api/current-board?mode=all_stored_data&limit=100` as a read-only fallback
- `/api/predictions/top`
- `/api/model/intelligence`
- `/api/model/segments`
- `/api/dashboard/today`

It does not call providers, mutate remote data, place wagers or write prediction history.

## Opportunity Groups

| Group | Meaning |
| --- | --- |
| Official Picks | Rows that already satisfy existing Official Pick policy |
| Value Candidates | Non-official rows with positive stored edge/EV and sufficient confidence presentation |
| Research Picks | Informational rows that may be reviewed but are not decision-grade |
| No Bet / Avoid | Rows blocked, passed, avoid-labeled or otherwise not actionable |

## Displayed Fields

Each opportunity displays supported values only:

- sport and league
- matchup
- event start time
- market
- predicted side or total
- predicted probability
- confidence
- persisted or user-entered line/price
- edge and EV only when a valid probability and price exist
- Official Pick state
- evidence quality
- explanation
- risk warnings
- data freshness
- model version
- feature version

Unavailable fields display `Unavailable` or are explained as missing.

## Comparison Workflow

The Compare tab supports side-by-side review of up to four opportunities. It includes:

- probability
- confidence
- evidence coverage
- edge
- EV
- segment sample size
- segment accuracy
- segment Brier
- segment calibration
- market evidence grade
- starter, bullpen, weather and park availability
- missing information

Segment comparisons below the Release 08 threshold are labeled as insufficient or directional, never decision-grade.

## Safety States

The workspace includes explicit states for loading, empty data, API error, unavailable price, insufficient evidence, event already started, final/postponed/cancelled event state, invalid wager, duplicate selection, no Official Picks, no Value Picks and No Bet rows.
