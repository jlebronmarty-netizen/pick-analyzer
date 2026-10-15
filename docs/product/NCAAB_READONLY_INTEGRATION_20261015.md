# NCAAB published-checkpoint integration — 2026-10-15

## Scope and authority

Pick Analyzer displays the published NCAAB checkpoint from Sports Edge Hub PR #13, commit `c451d9fc9767bbeff751e26e631fe0b48579fe75`. This is a read-only display projection, **not activation or certification of the local NCAAB pipeline**. The source PR remains unmerged; no source-repo deployment, scheduled task, collection, retraining, promotion or settlement writer is introduced.

`NCAAB_PRESEASON_V1` and `NCAAB_FREE_SCORE_V1_1` remain independent experimental models. Snapshot generated at `2026-10-15T16:42:54.805547+00:00`: 181 preseason observations, 73 forecasts, 108 abstentions; in-season model zero forecasts, requiring five distinct prior current-season games per team. Both have zero settlements. Forecast accuracy remains null. Historical replay statistics are not imported or pooled into prospective accuracy. Global W/L accuracy is unchanged; pending observations add 73. The tile includes both model identities and links to `/ncaab`.

No odds/edge/ROI are fabricated. Source `MODEL_VALIDATED=false`, `HOSTED_READY=false`, and odds/ROI/CLV deferred are preserved. The page, sport tile, daily calendar, API and warning state identify a published checkpoint without continuous sync. This integration does not claim ongoing hosted readiness. Automatic forecast publication and settlement require a separate source-to-host feed and operational verification; they are still pending.

## Surfaces

- `/ncaab`: independent model tabs, future forecasts, score/total/margin projections, uncalibrated winner probabilities, forecast/abstention and date filters, source metadata and empty settlement W/L detail.
- `/api/ncaab/overview`: validated curated snapshot, status, zero provider calls and zero database writes; HTTP 503 on failed integrity/schema validation.
- Homepage and `/today`: connected NCAAB tile and date-scoped calendar/experimental observations. Today October 15 contains no NCAAB games from this future checkpoint. November 2 Puerto Rico has 111 verified tips including 72 forecasts; November 3 has one additional forecast; 69 unverified tips remain abstentions and never become timed calendar games. No official picks or edge candidates are created.

## Reproduction and integrity

Original source bytes matched delivery-manifest SHA256 values:

- Preseason status: `7cbfce2daa127fe7d6f5cec16ff88e1faec0b6b24a8e693a66b6904af3e937a7`.
- V1.1 status: `4d0e6ff6ad933b2f8420f6736ff8a85cbf9096d8f89da4ce250cbd85107d1fbe`.

Run `python scripts/ncaab/project_checkpoint.py PRESEASON_JSON V11_JSON OUTPUT_JSON` against exact source bytes. The projection reproduced `src/data/ncaab-checkpoint.json` byte for byte. Whitelisted display fields exclude fitted profiles and model coefficients. Runtime SHA256 of `JSON.stringify(snapshot)` is pinned at `3ef881c69ed403d0d2731ab894ddaa0c9532f9a42360108c800476e5b9b498c9`. Any update requires an explicit new source/checkpoint, verification, receipt and code review; it is not an unattended updater.

Schema and economic/identity checks reject duplicate events/models, malformed probabilities/complements, inconsistent score/total/margin/winner arithmetic, post-start creation, invented settlements and non-null accuracy. Original source artifacts are never overwritten.

## Validation

Dashboard regression suite, changed-file ESLint, immutable MLB runtime guards and full Next build are required. Deployment/UI/API evidence will record the actual released commit separately. No paid/provider calls, DB writes/migrations or scheduler/environment changes are part of this module. NBA, NHL, NCAAF and existing MLB models/policy remain unchanged.
