# MLB Verified Provider Call Path V1

Date: 2026-07-17

## Why The Previous URL 404ed

`GET /api/mlb/odds/json/GamesByDate/2026-JUL-17` is a SportsDataIO Discovery Lab provider path, not a Next.js application route. The app did not expose a provider proxy at that URL, so the request returned the Next.js 404 page and never reached SportsDataIO.

## Real Provider Path

The existing MLB prospective preview service calls SportsDataIO through:

- service: `runSportsDataIoMlbProspectivePreview`
- private helper: `fetchJson`
- URL resolver: `resolveSportsDataIoDiscoveryLabUrl`
- provider URL pattern: `https://api.sportsdata.io/api/mlb/odds/json/GamesByDate/{date}`
- method: `GET`
- auth: server-side `Ocp-Apim-Subscription-Key` header from `SPORTSDATAIO_MLB_API_KEY`

The existing internal execution route is `POST /api/historical-import/execute` with mode `sportsdataio_mlb_prospective_preview_v1`, but that route is broad and may capture schedule, odds, projections, feature snapshots and predictions. It is not appropriate for one raw GamesByDate field verification.

## New Narrow Route

`POST /api/mlb/provider-verification/games-by-date`

Requirements:

- `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`
- JSON body: `{ "date": "2026-JUL-17", "confirmed": true, "dryRun": false }`
- provider budget must allow exactly 1 call
- no arbitrary provider paths accepted
- no prediction regeneration
- no recommendation changes
- no settlement changes

Dry-run and validation modes make zero provider calls.

The actual provider call writes one `sports_sync_jobs` ledger row with a sanitized verification snapshot and field-presence matrix. Raw payloads and secrets are not stored.

## Verification Result

The single actual provider call was executed locally through the guarded route because the production runtime reported `SPORTSDATAIO_MLB_API_KEY` as not configured. Production dry-run remains valid and makes zero provider calls, but production non-dry-run is blocked until the key is configured in Vercel.

Ledger:

- table: `sports_sync_jobs`
- id: `8845bc94-d5ac-40db-ab42-0aa8dc4f8d6b`
- status: `completed`
- provider calls used: 1
- provider HTTP status: 200
- records fetched: 15
- raw payload stored: false
- sanitized verification snapshot stored: true

Field extraction:

- Starter fields: inconclusive. The verification service audited non-contract starter names and did not extract documented fields such as `AwayTeamProbablePitcherID`, `HomeTeamProbablePitcherID`, `AwayTeamStartingPitcherID`, `HomeTeamStartingPitcherID`, `AwayTeamStartingPitcher`, `HomeTeamStartingPitcher`, `AwayTeamOpener` or `HomeTeamOpener`.
- Weather fields verified: `ForecastTempLow`, `ForecastTempHigh`, `ForecastDescription`.
- Weather counts: each populated 15, null 0, absent 0. Sample values: `80`, `80`, `Scattered Clouds`.
- Weather fields not extracted previously: `ForecastWindChill`, `ForecastWindSpeed`, `ForecastWindDirection`.
- Venue fields: `StadiumID`.
- Venue counts: populated 15, null 0, absent 0. Sample value: `50`.

Normalization decision:

- Starter normalization is not ready; classification is `DOCUMENTED_NOT_YET_VERIFIED`.
- Weather normalization is ready for a narrow forecast-low, forecast-high and forecast-description normalizer after review.
- Venue normalization can use `StadiumID` only; stadium names, surface, roof type and venue type remain unavailable from this payload.
