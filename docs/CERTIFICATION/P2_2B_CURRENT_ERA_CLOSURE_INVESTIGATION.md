# P2.2B Current Era Closure Investigation

Status: LOCAL REPAIR PENDING PRODUCTION CERTIFICATION

P2.2B investigated why Current Era Performance showed 69 canonical predictions and 0 settled predictions on 2026-08-04.

## Findings

- Production commit before repair: `7fc05e7f6960b92972e9e426bea78fd0af42ee34`.
- Current Era canonical predictions: 69.
- Current Era settled canonical predictions: 0.
- August 3 slate: 8 events, 24 canonical predictions, stored event status `scheduled`, lifecycle `STARTED`, result status `PENDING`, final scores unavailable in stored evidence.
- August 4 slate: 15 events, 45 canonical predictions, all pregame/scheduled.
- Settlement guarantee reported ready rows 0, blocked rows 0 and silent pending rows 0.

## Root Cause

Prior-date MLB events that had started but still had stale stored status `scheduled` were not classified as result-sync actionable. The scheduler therefore did not select `sync_results`; it continued selecting current-day market refresh while August 3 results remained unimported.

## Repair

The settlement backlog classifier now treats prior-date post-start events without authoritative `game_results` rows as result-sync actionable. This does not make any row settlement-ready and does not infer a final score.

## Guardrails

- No fabricated results.
- No manual settlement.
- No prediction, ranking, recommendation, Official Pick, Kelly, model, scheduler cadence or learning-weight change.
- Canonical settlement still requires authoritative `game_results` score evidence.
- Preview and non-production rows remain excluded.
