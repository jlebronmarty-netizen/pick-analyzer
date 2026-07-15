# Official Picks Readiness V1

Status: readiness implemented; official activation remains blocked.

## Implemented

- Shared recommendation policy service.
- Top Picks consumes only official statuses.
- Play of the Day requires the strictest official status.
- Parlays require at least two official eligible legs.
- Bet Slip Optimizer returns a no-ticket state when no official picks exist.
- Portfolio and daily report do not request sportsbook intelligence when the
  official pick pool is empty.
- MLB historical replay distinguishes analyzed rows, watch/qualification
  status, current-policy blockers and settled final result.

## Current State

- Official recommended picks: 0
- Play of the Day: none
- Optimizer: no-ticket state
- Historical MLB replay: 45 analyzed quarantined rows
- Provider calls in this pass: 0
- Remote mutations in this pass: 0
- API routes added: 0

## Activation Blockers

Official recommendations require:

- prospective production-eligible rows
- current valid odds
- enough settled production samples for calibration
- approved production promotion
- no critical missing mappings or leakage warnings
- explicit Day 1 execution approval

Until those are satisfied, quarantined previews and historical replay remain
internal validation surfaces only.

