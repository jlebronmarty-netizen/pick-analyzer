# Bet Slip And Risk Guide

Status: RELEASE 12 IMPLEMENTED

The Release 12 bet slip is user controlled. It does not place bets, does not generate recommendations automatically and does not change Official Picks.

## User-Entered Values

The slip clearly separates:

- canonical model probability;
- persisted line/price when present;
- user-entered sportsbook;
- user-entered odds;
- user-entered line;
- user-entered stake;
- user notes.

The workspace never infers sportsbook price from model probability.

## Singles

For single wagers, the workspace calculates:

- implied probability from entered American odds;
- stake;
- potential payout;
- maximum loss;
- model edge only when model probability and price are both valid;
- EV only when model probability and price are both valid.

## Parlays

For user-created parlays, the workspace calculates:

- combined decimal odds;
- combined implied probability;
- total stake;
- maximum loss;
- potential payout.

It does not display combined model probability unless leg dependence has been validated. Current behavior is:

`Combined model probability unavailable because leg dependence has not been validated.`

## Safety Warnings

The workspace warns on:

- same-event duplicate selections;
- same-market same-event conflicts;
- event started or non-pregame rows;
- missing price;
- no positive edge or EV at available price;
- low-evidence legs;
- high bankroll concentration.

No correlation coefficient is invented.

## Bankroll And Kelly

Bankroll guidance is conservative and presentation-only. Kelly percentages are shown only when model probability and a valid user-entered or persisted price exist. Existing Kelly arithmetic is preserved; Release 12 does not alter formulas or risk policy.
