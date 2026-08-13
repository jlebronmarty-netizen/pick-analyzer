# MLB Final Market Freshness Freeze

Status: `MLB_FINAL_MARKET_FRESHNESS_RUNTIME_REPAIR_READY_FOR_DEPLOYMENT`

Date: 2026-08-13

## Scope

This certification closes the post-settlement market freshness investigation for the MLB final freeze gate. It does not change prediction formulas, probabilities, candidate selection, Official Pick policy, settlement formulas, learning policy, provider authority, Vercel configuration or the NBA historical foundation.

## Production Evidence Before Repair

Production commit `469002068677a282ce7da47efb4e16f3b47a101e` reported:

- Settlement Guarantee: `PASS`
- Settlement ready rows: `0`
- Silent pending rows: `0`
- Remaining explicit blockers: `3` `PREDICTION_POST_START`
- Scheduler: `HEALTHY`
- Provider Budget: `HEALTHY`
- Market Freshness: `CRITICAL`
- Current Board: `DEGRADED`
- Operations Health: `CRITICAL`

The current actionable MLB scope contained three pregame market-refresh-allowed games:

- `PHI @ MIN`
- `TEX @ LAA`
- `MIL @ LAD`

The natural Vercel primary scheduler executed at `2026-08-13T21:18:12Z`, but the protected planner selected `settle` again instead of the due odds refresh. The Odds API call count did not increase and market freshness stayed `CRITICAL`.

## Root Cause

`src/services/adaptive-refresh-orchestrator.service.ts` counted pending predictions with canonical `game_results` as `settlementReadyRows` without applying the same cutoff/start safety gate used by the settlement writer.

That caused the three already-proven `PREDICTION_POST_START` rows to remain visible to the adaptive planner as settlement-ready debt. Because settlement outranks odds refresh, natural scheduler executions repeatedly selected `settle`, starving legitimate current pregame market refresh.

## Repair

The adaptive settlement backlog reader now loads `generated_at`, `cutoff_at` and `created_at`, applies `classifyPredictionCutoff(row, event)`, and counts a pending row as settlement-ready only when:

- authoritative canonical result evidence exists; and
- the cutoff classifier returns `eligible=true`.

Cutoff-blocked rows remain visible through `cutoffBlockedRows` and `cutoffBlockedRowsByReason`, but they no longer hijack market refresh.

## Safety

- No settlement formula changed.
- No learning policy changed.
- No prediction formula changed.
- No recommendation or Official Pick threshold changed.
- No provider authority changed.
- No SportsDataIO fallback was reactivated.
- No NBA historical foundation files were touched.
- Certification reads made 0 provider calls and 0 database mutations.

## Expected Post-Deploy Behavior

After deployment, when only post-start blocked rows remain and current pregame market evidence is stale, the adaptive planner should select `midday_refresh` / market refresh instead of `settle`.

The final MLB freeze still requires post-deploy proof that:

- market freshness is no longer falsely blocked by settlement debt;
- current pregame rows refresh or fail closed correctly;
- Current Board health is lifecycle-scoped;
- Operations Health is no longer `CRITICAL` from false settlement/current-board starvation.
