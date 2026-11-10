# Tennis FREE — source preflight

Candidate: Tennis API – ATP WTA ITF on RapidAPI, documented at
https://docs.tennis-api.com/getting-started and
https://docs.tennis-api.com/upcoming-and-predictions .

The provider documents a FREE plan with 50 requests/day. The operator must
confirm the actual subscribed plan and leave overages disabled. No paid plan
is activated by this code.

Set `TENNIS_RAPIDAPI_KEY` in Vercel Production, never in browser code or chat.
The existing authenticated production `/api/cron/free-sports` runs a source
preflight only when that server key exists. An ATP receipt at UTC midnight
allows **one request per UTC day**, even if the four-hour cron is run again.
It requests the mixed-tour singles calendar once with bounded metadata;
does not follow provider links, request its model probabilities, fetch past
odds, or create predictions. HTTP 401/403/429 stop automatic retries within
that deployment. Redirects are rejected; timeout 15 seconds; cap 2 MiB.

All requests use a claim in `free_sports_runs_v1` before the provider call.
The service-only receipt keeps a hash and gzip payload for replay. Auth headers
are neither logged nor persisted. Existing atomic completion writes no
forecasts or results. The source snapshot is labelled `captureOnly` and cannot
make an active ATP model appear AVAILABLE. WTA and BSN remain inactive.

A real response and account entitlement are still unverified. Strict parser
failures keep the source under review; no fixture is promoted by default.
The `/api/tennis/source-health` read endpoint exposes only sanitized counts and
status, never the key or raw payload. The Tennis page shows this status.

Offline tests:
`node --loader ./tests/tennis-free/runtime-loader.mjs --test tests/tennis-free/*.test.mjs`

Before actual model activation:
1. Replay the real source receipt, certify stable cross-stage player/tournament/
   round identity and actual timestamp semantics.
2. Verify free-plan rights for historical storage and display of the fields used.
3. Acquire sufficient prior decisive results, with a hard daily request ledger.
4. Freeze a separate prospectively evaluated model cohort, with abstentions and
   pregame feature snapshots.
5. Match final outcomes by durable identity; exclude retirements/walkovers from
   winner accuracy and use explicit contract rules before any price settlement.
6. Keep captured pregame prices separate from retrospective archive prices.
   Historical odds with no certified observation time cannot become executable ROI.

No credential, no provider request. No active tennis model or ROI claim in this release.
