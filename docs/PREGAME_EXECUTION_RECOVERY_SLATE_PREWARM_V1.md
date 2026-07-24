# Pregame Execution Recovery & Slate Prewarm V1

Date: 2026-07-24

## Mission

Recover operational execution so future MLB games receive valid pregame prediction rows before cutoff. This phase does not change prediction probabilities, Official Pick policy, Learning Brain weights, settlement outcomes, Current Board policy, Historical Replay or Historical Feature Backfill Phase 2A.

## Root Cause

Cutoff enforcement correctly rejected late prediction rows, but provider-backed operating-day actions still preferred the local calendar date whenever stored games existed for that date. Once those games were already started or inside the ten-minute cutoff, late scheduler passes continued selecting the stale same-day slate. Prediction persistence then did the right thing by rejecting rows, but execution never pivoted to the next pregame-actionable slate.

The `prepare_next_slate` branch also depended on `getNextSlateStatus()` having a stored future slate. If tomorrow's slate was not already persisted, the branch could not call `GamesByDate` to create it.

## Recovery

- `mlb-operating-date-resolution.service.ts` now selects the earliest date with at least one event whose cutoff is still in the future for provider-backed odds/prediction/current-board actions.
- If today's slate is past cutoff, `morning_sync`, `midday_refresh` and `final_refresh` select the next pregame-actionable stored slate instead of the stale local date.
- `prepare_next_slate` can prewarm the next calendar date when no stored future slate exists, using the existing SportsDataIO prospective-preview service, provider budget guard and provider action lock.
- `pregame-scheduler-coverage.service.ts` now reports a forward-looking `nextPregameSlate` with valid pregame coverage, average lead time, pending execution count, cutoff-protected games, board-ready games and exact skip reasons.

## Safety

- Prediction generation remains blocked unless `generated_at < cutoff_at`.
- Post-start and post-cutoff rows are not persisted by the MLB prospective-preview path.
- Current Board still excludes started, settled, post-cutoff, live-odds, stale-odds and duplicate rows.
- Retries reuse deterministic prediction and feature-snapshot keys through the existing upsert/idempotency path.
- Provider execution still requires the existing protected route, confirmation, provider budget approval and action lock.

## Validation Contract

Validation must prove:

- The selected provider-backed date is a future or still pre-cutoff slate when the local slate is no longer actionable.
- At least one valid pregame prediction is persisted before cutoff when an eligible future game and provider odds exist.
- Average lead time is positive for the validated next slate.
- No post-start production prediction is persisted.
- Duplicate current prediction identities remain zero.
- Current Board reads only valid pregame candidates.
- Build passes.

If no eligible future game exists, validation may only simulate the lifecycle without production prediction persistence and must withhold `PRODUCTION_OPERATIONAL_READY`.
