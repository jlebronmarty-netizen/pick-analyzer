# MLB Official Pick Dedicated Settlement Cron — Certification

**Date:** 2026-09-20  
**Repository:** `jlebronmarty-netizen/pick-analyzer`  
**Scope:** certified postgame settlement only

## Purpose

Persist certified postgame outcomes for already-existing immutable MLB Official Picks so the
Performance product can report Wins/Losses/Units/ROI from an explicit settlement layer.

This runtime does **not** create, modify, promote or delete Official Picks.

## Existing certified authority reused

- settlement planner: `src/services/pick2-mlb-settlement.ts`
- persistence adapter: `src/services/pick2-mlb-settlement-persistence.service.ts`
- evaluator version: `PICK2_MLB_OFFICIAL_SETTLEMENT_V1`
- outcome source: exact MLB Official game feed
- write target: `public.pick2_prediction_results`
- readback: required
- retry semantics: reuse/no-op
- conflicts: fail closed

The existing settlement core verifies:

- exact `game_pk`;
- terminal status;
- final score identity;
- evidence payload digest;
- Official Pick identity;
- prediction/model/policy lineage;
- pregame decision timestamp;
- valid stored American odds.

## Dedicated runtime

Route:

`/api/cron/mlb-official-settlement`

Schedule:

`12 * * * *`

Per-run limits:

- at most **50 game_pk**;
- total execution deadline: **240 seconds**; if reached, the backlog yields cleanly and resumes on the next scheduled run;
- at most **1,000 stored Official Pick rows**;
- at most **100 Official Pick rows per game**;
- only games whose scheduled start is at least 90 minutes in the past are attempted;
- only exact MLB Official `Final` or `Cancelled` evidence can write.

Provider accounting:

- MLB Official: max 50 calls/run;
- Odds API: **0**;
- SportsDataIO: **0**;
- BALLDONTLIE: **0**.

## Isolation

The main Vercel operational coordinator keeps:

`settlementAutomation = DISABLED`

Settlement is intentionally isolated in the dedicated route so enabling postgame result persistence
cannot reopen legacy Official Pick writes or change pregame recommendation execution.

The dedicated cron:

- reads `pick2_mlb_official_picks`;
- reads existing `pick2_prediction_results`;
- reads `pick2_mlb_games` for bounded scheduling;
- fetches exact MLB Official final feed;
- writes only `pick2_prediction_results`.

It never writes:

- `pick2_mlb_official_picks`;
- predictions;
- market-value evaluations;
- sportsbook snapshots;
- APOSTAR/bet execution state.

## Current backlog audit

As of certification:

- stored Official Pick decision snapshots: **149**;
- unique game/side selections: **42**;
- unique games: **42**;
- certified settlement rows currently stored: **0**.

A read-only non-authoritative diagnostic using the existing cross-year final-score layer found
postgame outcomes available for **41/42** unique selections; the remaining selection is the current
MIL @ BAL game. Those diagnostic outcomes are **not** used by this settlement cron and are **not**
published as certified performance. The cron uses MLB Official final feed only.

## Performance aggregation

All 149 immutable decision snapshots remain auditable.

User-facing Performance aggregates results **once per unique game/side selection**, so repeated
scheduler snapshots do not multiply the public sample or bankroll unit basis.

## Boundaries

- Official Pick decisions unchanged;
- Official Pick writes remain disabled;
- APOSTAR remains disabled;
- no model or policy retune;
- no pregame features changed;
- no historical Odds API credits;
- no result can affect a pregame recommendation;
- no profitability claim is shown before certified settlement rows exist.

## Disposition

`MLB_OFFICIAL_PICK_DEDICATED_SETTLEMENT_CRON = CERTIFIED_PENDING_DEPLOYMENT`
