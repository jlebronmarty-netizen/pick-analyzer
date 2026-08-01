# Personal Wager Tracking

Status: RELEASE 12 LOCAL-ONLY TRACKING

Release 12 adds user-controlled personal wager tracking in browser local storage. It does not create a remote wager table, does not mutate prediction history and does not settle model predictions.

## Stored Local Fields

Each local wager supports:

- wager ID;
- created timestamp;
- event IDs;
- prediction IDs;
- sportsbook;
- entered odds;
- stake;
- bet type;
- legs;
- status;
- potential payout;
- actual payout;
- result;
- notes;
- source category: Official Pick, Value, Research or user-only.

## Separation From Model Metrics

Personal betting outcomes are separate from:

- canonical prediction result;
- prediction settlement;
- model accuracy;
- model Brier;
- learning labels;
- Official Pick performance.

Changing a personal wager result does not update prediction history.

## Personal Metrics

The workspace reports:

- wagers placed;
- wins;
- losses;
- pushes;
- stake;
- returned amount;
- net result;
- ROI.

Small samples are implicit until enough user-entered wagers exist for stable personal analysis.
