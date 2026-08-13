# MLB Operating-Day Autonomy + Live Continuity P0

Status: LOCAL_REPAIR_READY_FOR_DEPLOYMENT

## Evidence

- Observation time: 2026-08-13T14:05Z production reads.
- Production commit: 72864b24c3bc094f9d2f941b78c3ac89b71e5378.
- Operating date: 2026-08-13 America/Puerto_Rico.
- Games today: 9.
- Pregame: 9.
- Live: 0.
- Final: 0.
- Dashboard predictions: 0.
- Current Board candidates: 0.
- Games waiting for odds: 9.
- Scheduler health: HEALTHY.
- Operations health: CRITICAL because market freshness and product readiness are empty.

## Root Cause

The adaptive planner treated prior-day settlement/result debt as higher priority
than a current-day pregame market bootstrap. Healthy Vercel scheduler cycles
therefore repeatedly selected `settle` for 2026-08-12 debt while 2026-08-13
pregame MLB games had no odds, features, predictions or Current Board rows.

## Repair

Current-day pregame odds bootstrap now preempts older closure debt when:

- odds are due now;
- active-slate closure debt is from an earlier operating date;
- current-day games exist; and
- games are waiting for odds.

Same-day settlement remains protected. Older result and settlement closure
resumes after current slate odds/prediction continuity is restored.

## Guardrails

- SportsDataIO remains zero routine MLB calls in Stage 3.
- The Odds API remains MLB market authority.
- MLB Official remains non-odds source.
- Prediction formulas, Official Pick thresholds, model weights, settlement
  formulas and learning weights are unchanged.
- No NBA historical data was modified by this repair.

## Current-Day Recovery

Not executed from the local repair worktree. Recovery should occur after deploy
through the normal protected Vercel scheduler cycle or one explicitly authorized
protected operating-day invocation.
