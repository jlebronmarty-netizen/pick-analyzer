# FREE SHADOW · NFL, tenis y BSN

First release: match winner only, by Elo (1500, K=32, one batch per UTC date,
three prior decisive results for each participant, no selection at 50/50).
Separate NFL, ATP, WTA and BSN ledgers. The first eligible forecast per league
and event is frozen; same-day results are not used. This is a baseline for
forward evaluation, not a trained market-edge model or an Official Pick.
Existing sport-specific engines and cohorts remain separate.

## Free sources and coverage

| League | Calendar and results | Price at issuance |
| --- | --- | --- |
| NFL regular season | [nflverse schedules release](https://github.com/nflverse/nflverse-data/releases/tag/schedules), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), maintained by Lee Sharpe/nflverse. Times in Eastern converted to UTC; filter exact season/type and 10-day forecast horizon. | Unavailable. The schedule's line fields do not prove a pregame timestamp and are ignored. |
| ATP/WTA singles | Model and UI ready; production collection disabled until an authorized feed is verified. [Setpoint API](https://point.tennis/api) lists a free schedule/final-results plan; actual access, terms, IDs and coverage are unverified. | No approved price feed. [TheRundown](https://therundown.io/tennis-odds-api) describes ATP/WTA main lines on a free tier with a five-minute delay for personal/internal use; commercial display requires a different tier. No key usage or sign-up in this release. |
| BSN Puerto Rico | Existing `sport_events`, 38 finals available at preflight. No external network requests. Upcoming only with approved feed or attested operator CSV; no current approved future slate. See [BSN source inventory](bsn-data-source-inventory.md). | No approved feed or matched pair. |

The BSN reader requires stable IDs and `metadata.free_shadow_attestation`
with `source` = `permissioned_feed` or `operator_attested_csv`, an ISO
`capturedAt` before the scheduled tip, and a nonempty `reference` to the
operator's source record. This is a reader contract; it grants no authority to
collect external data. The current source contract excludes automated scraping
of the official site. Historical data trains the baseline and contributes no
forward accuracy or ROI.

## Validation and operation

Open NFL source preflight, 2026-11-10 02:31 UTC (read-only replay):
**134 decisive finals, 1 tie, 136 valid future fixtures, 15 eligible forecasts
within the horizon, 0 accepted prices.** No forecast was issued.
Release CSV SHA256: `5f36209e28c756af2e754b9ebbc51818b1bcc89da90cc148f52b46bf13b72dc8`.

Earlier bounded ESPN diagnostics (2026-11-10 02:13 UTC): 15 NFL, 7 ATP and 8
WTA eligible, with 12 matched NFL quote pairs and none for tennis. These
observations are source discovery only, not scheduled or approved ingest.
ESPN links to the [Disney terms](https://disneytermsofuse.com/english/), which
restrict automated extraction. The runtime cannot call ESPN for these sports.
The diagnostic parser remains for offline fixture checks. No ESPN quote is
eligible for the production cohort.

The normalized counts exclude TBD participants, absent start times, unsupported
statuses, mismatched seasons and ambiguous identities. Nondecisive matches
are excluded from training and win/loss accounting.

- Accuracy = wins / (wins + losses), all decisive forecasts. Paper ROI =
  net units / number of decisive forecasts with an accepted frozen price, at
  1 unit each. No historical price backfill, and no assumed fill or promotion.
- Canonical participant IDs and the original start time must match. Corrections
  with incompatible identity or winner put the forecast in review. Ties,
  cancellations, walkovers and retirements do not receive book-specific
  settlement assumptions. Missing outcomes stay pending, including when the
  free calendar stops returning a fixture.
- Additive private tables `free_sports_*_v1` and a service-only atomic finish
  function. A run claim is stored before any provider call. The run ledger
  records source, UTC slot, result, capture time, digest, counts and normalized
  pregame evidence; forecast-producing runs include the training IDs/outcomes.
- Production-only authenticated cron at minute 23 every four hours UTC. Per
  cycle: one NFL GitHub release request with at most one allowlisted asset
  redirect. BSN uses Supabase only; ATP/WTA perform no collection. No retries, no paid keys, 20-second timeout and 8 MiB response cap.
  A failed source does not stop the other sports. The UI hides a stale
  calendar after 5 hours and retains the frozen historical ledger.
- Pages: `/sports-shadow/nfl`, `/sports-shadow/tennis`, `/sports-shadow/bsn`.
  Read-only API: `/api/sports-shadow/{nfl,tennis,bsn}`. Model cards and the
  Puerto Rico date board are fed by the same read layer.
- Release order: verify migration in isolation; apply the private schema;
  deploy; verify unauthorized cron returns 401, then verify one authorized
  scheduler run, its pregame timestamps, duplicate slot protection, and
  dashboard/API parity. Disable the added cron or roll back the application
  to pause ingestion; retain the existing ledger as evidence. Preview cannot
  run the production collector.
