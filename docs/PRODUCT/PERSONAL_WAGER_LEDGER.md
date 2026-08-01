# Personal Wager Ledger

Status: RELEASE 13 CANONICAL USER LEDGER

## Purpose

The Personal Wager Ledger tracks wagers that a signed-in user explicitly records. It is a personal bookkeeping system, not a betting placement system and not a model training input.

## Modes

- Local-only: unauthenticated users can keep using browser storage.
- Authenticated remote: signed-in users can sync local wagers to the remote ledger.
- Failed sync: local wagers remain intact and can be retried.
- Duplicate sync: `client_created_id` prevents duplicate creation.
- Archived: user wagers can be archived without changing prediction records.

## Workspace Behavior

The Betting Decision Workspace labels:

- model-provided probability, confidence, canonical line and canonical odds snapshots;
- user-entered sportsbook, odds, stake and payout;
- local storage status;
- remote sync status.

The app never silently modifies user-entered odds, stake or sportsbook.

## User-Led Results

Personal wager status supports draft, placed, won, lost, push and void. Release 13 does not automatically treat model settlement as wager settlement because personal lines and odds may differ.

## Analytics

The summary API reports personal:

- wagers, wins, losses, pushes and voids;
- total stake, returned amount, net and ROI;
- singles vs parlays;
- performance by sport, market and source category.

These metrics are never combined with model accuracy, Brier score, calibration, prediction settlement or Official Pick performance.

## Export

Authenticated users can export only their own wager history as JSON or CSV through `/api/user/wagers/export`.
