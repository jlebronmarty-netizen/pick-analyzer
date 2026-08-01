# AI Explanation Guide

Release 09 explanation text must be grounded in existing data.

## Allowed Explanation Inputs

- current Today selectors
- current-board candidate blockers
- reason-not-official fields
- stored probability, confidence, edge and EV
- freshness state
- model version where available
- model intelligence and performance metrics

## Prohibited Explanation Inputs

- invented starter advantages
- invented bullpen advantages
- invented weather or park advantages
- fabricated historical segment claims
- generated confidence not present in source data
- post-start or postgame information as pregame rationale

## Missing Data

When a supporting field is unavailable, the UI must say it is unavailable or omit that section. It must not invent reasons to make a card feel complete.

## Recommendation Language

Official Picks remain distinct from informational candidates. High probability, positive edge and positive EV remain different concepts.

## Release 09 Implementation

The homepage uses:

- `data-r9-daily-brief`
- `data-r9-ai-explanation`
- `data-r9-no-bet`
- `data-r9-evolution-panel`

These markers allow deterministic validation without local server smoke.
