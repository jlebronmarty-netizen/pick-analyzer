# Run Line V2 — Sep18 forward-freeze timing disposition

Date: 2026-09-18

Status: `NO_SCORED_PROSPECTIVE_SELECTION_DATE`

## Evidence captured

The normal pregame market capture completed on 2026-09-18:

- core Moneyline / Run Line / Total capture: 15 mapped MLB events;
- alternate HOME +1.5 capture: 6 HOME-favorite eligible events, 64 rows;
- both captures were pregame and research evidence only.

## Freeze gap

The scheduled `/api/cron/mlb-statcast-daily` request at 10:45 Puerto Rico
(14:45 UTC) returned HTTP 500 before a Run Line freeze row was written.

A separate independent route,
`/api/cron/mlb-runline-v2-forward`, was subsequently added to `main` and
scheduled for 10:46 Puerto Rico. That production deployment occurred only
after the 2026-09-18 scheduled window, so it cannot be used to reconstruct
today's missing freeze.

Therefore:

- standard Run Line market evidence: **YES**
- real HOME +1.5 alternate evidence: **YES**
- fixed-clock score/selection freeze: **NO**
- prospective scored selection date: **NO**
- retrospective freeze: **PROHIBITED**

## Timing hardening

A new freeze may now be written only during:

`10:45-10:59 America/Puerto_Rico`

If no prior freeze exists and the service is invoked at or after 11:00, it
returns:

`BLOCK_FREEZE_WINDOW_MISSED`

A valid already-created freeze can still return `REUSE_NO_OP` later without
creating new evidence.

## Boundaries

- research-only
- production eligible: false
- Official Picks unchanged
- APOSTAR inactive
- no candidate retuning
- no retrospective evidence reconstruction
