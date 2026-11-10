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
| NFL regular season | [ESPN NFL scoreboard](https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&limit=1000). Exact current season/type 2 required; up to 10 days ahead, not a completeness claim. | Matched two-way DraftKings quotes as observed in the same pregame ESPN response. The upstream field is named `close`; it is used as an observed snapshot, with no claim of a closing or executable price. |
| ATP/WTA singles | [ATP ESPN scoreboard](https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard) and [WTA ESPN scoreboard](https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard). One rolling 48-day feed window, exact participants/start, singles only. | No usable pairs in the two scoreboard samples; one separate upcoming odds endpoint per tour returned zero items. No ROI until a source with reliable pregame prices is available. |
| BSN Puerto Rico | Existing `sport_events`, 38 finals available at preflight. No external network requests. Upcoming only with approved feed or attested operator CSV; no current approved future slate. See [BSN source inventory](bsn-data-source-inventory.md). | No approved feed or matched pair. |

The BSN reader requires stable IDs and `metadata.free_shadow_attestation`
with `source` = `permissioned_feed` or `operator_attested_csv`, an ISO
`capturedAt` before the scheduled tip, and a nonempty `reference` to the
operator's source record. This is a reader contract; it grants no authority to
collect external data. The current source contract excludes automated scraping
of the official site. Historical data trains the baseline and contributes no
forward accuracy or ROI.

## Validation and operation

Source preflight, 2026-11-10 02:13 UTC (read-only replay, no issued picks):

| League | Timed decisive finals parsed | Valid future fixtures in feed | Model-eligible within horizon | Eligible with quote |
| --- | ---: | ---: | ---: | ---: |
| NFL | 134 | 101 | 15 | 12 |
| ATP | 495 | 7 | 7 | 0 |
| WTA | 944 | 11 | 8 | 0 |

Raw-response SHA256: NFL `292eb0f8dcaefab5be6e1dfee5af4e8cc17353b650bdbe7da756e632b10eb98c`;
ATP `b611732f7c002b5355f3f5a35a3caaee98171ae8b646d67c83b441b6e7f17290`;
WTA `7cb613dce5f32607e7e9c78c3bbd988103684d306ec45df4ac3c1b6242371089`.
The normalized counts exclude TBD participants, absent start times, unsupported
statuses, mismatched seasons, and ambiguous identities. Nondecisive matches
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
  cycle: at most one HTTP request each for NFL, ATP, WTA; BSN uses Supabase
  only. No retries, no paid keys, 20-second timeout and 8 MiB response cap.
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
