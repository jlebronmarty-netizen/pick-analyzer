# MLB Aug 12 Morning Pipeline Recovery

Status: LOCAL RUNTIME REPAIR COMPLETE, PUSH REQUIRED

## Incident

On 2026-08-12 morning AST, production showed 15 MLB games but 0 predictions, 0 Current Board candidates and no surfaced market evidence.

## Evidence

- Production commit before repair: `137565fa090956dd8ebc60968dd629dfca1d5363`
- Operating day: `2026-08-12`
- Canonical games: 15
- Pregame and cutoff-eligible games at audit time: 15
- The Odds API rows: present for all 15 games across moneyline, run line and total.
- Feature snapshots for the operating day: 0
- Prediction rows for the operating day: 0
- SportsDataIO MLB routine calls: 0

## Root Cause

`runAdaptiveRefresh` still gated stored-odds prediction generation on the legacy SportsDataIO canonical acquisition `persistedSnapshotCount`.

In Stage 3, SportsDataIO odds acquisition is intentionally suppressed, so `persistedSnapshotCount` stays 0 even when The Odds API product-primary acquisition writes fresh rows. The existing stored-odds prediction writer was therefore skipped.

The Odds API product rows also stored the source timestamp only in metadata, leaving `sports_odds_snapshots.provider_timestamp` null.

## Repair

- Persist The Odds API market timestamp into `sports_odds_snapshots.provider_timestamp`.
- Allow the existing MLB stored-odds prediction writer to read Stage 3 product-authoritative The Odds API rows.
- Invoke the existing prediction writer after The Odds API Stage 3 acquisition writes or updates rows.

## Safety

- No prediction formula changed.
- No model weights changed.
- No Official Pick threshold changed.
- No settlement or learning policy changed.
- No provider authority changed.
- SportsDataIO remains rollback-only for MLB.
- The repair uses already-acquired odds rows and makes no extra odds provider calls.

## Deployment Gate

Production recovery requires publishing the bounded repair commit, then allowing the next natural Stage 3 acquisition or the already authorized one-cycle protected recovery to run before cutoff.
