# BSN API-Sports archive V1

Scope: source acquisition and quality audit only. No model activation, forecasts,
Official Picks, settlement changes, or ROI claims. Frozen 38-game pilot retained.

Production secret: BSN_APISPORTS_KEY. Server requests only to
https://v1.basketball.api-sports.io using x-apisports-key. Never retrieve the value
through connectors or expose credentials in logs, responses or artifacts.

## Acquisition

Authenticated production route: /api/cron/bsn-archive. Schedule 01:53, 09:53,
17:53 UTC (21:53 previous PR day, 05:53, 13:53 Puerto Rico).
A unique 8h batch claim reserves at most 20 calls; disjoint child receipt slots
are claimed before each request. At most 60 requests per UTC day from this
collector, leaving 40 of the advertised 100/day for manual/other account use.
Calls are spaced >=6.5 seconds; provider reported remaining quota <=10 stops
that batch. This cannot account for untracked calls from other applications.
No automatic retry of failed, interrupted or denied requests. Any failed or
RUNNING receipt stops subsequent acquisition for review. No receipt deletion.

Catalogue /leagues?id=76, results /games?league=76&season=YYYY for 2015-2026
(priority 2024,2025,2026). Team and player per-game stats for 2024-2026 in
batches of <=20 exact game ids via the documented ids parameter. Season
catalogue is validated; metadata/availability does not prove full coverage.
Game-list captures precede statistics; the next scheduled batch reconstructs
pending work from existing receipts. Historical captures are reused and their
SHA256 checked before queue reconstruction; no repeated successful requests.

Raw response bytes compressed as base64 with SHA256, status, observations,
endpoint, version and audit in existing private free_sports_runs_v1. Ledger RLS
and service-only completion RPC reused without migrations. Capture-only receipts
cannot become forecast history in the dashboard. Redirects refused, 25s timeout,
8MiB body cap, no raw exception messages or provider error text in public health.
If the response echoes the credential, no raw payload is retained.

Read-only health: /api/bsn/source-health. /sports-shadow/bsn shows counts and
pending state; public reads never call the provider. Does not expose raw rows.
No change to any other sport, thresholds, Official Picks or historical records.

## Quality gates

Game identity/league/season/date/timestamp, decisive FT/AOT, score arithmetic
when quarters exist, duplicate IDs (all instances excluded), valid team IDs.
Missing quarters do not invalidate a final-score-only record; quarterComplete
must gate any future period research. Raw invalid records remain preserved.
Full-game totals include OT; regulation/period contracts are not interchangeable.
Stage null stays unknown, never inferred as regular season. Date-batched as-of
features needed if precise pregame schedule availability cannot be certified.

Team scoring: 2*FGM+3PM+FTM equals game total, shot subsets/counts, rebounds
sum, missing/duplicate/unexpected teams. Percentages are preserved as reported;
models must recompute from counts, not rely on rounded provider percentages.
Player rows have preliminary identity checks only and remain NOT admitted for
modeling pending schema/points/minutes and team-aggregate reconciliation.
No imputation of missing data, price, contracts or historical announcements.

Known user-supplied examples: 389829 team counts imply 83-83 versus game 81-82
=> POINTS_MISMATCH. 389830 counts imply 93-101 and agree. These are diagnostics,
not independently certified corrections; the collector preserves actual responses.

## Verification

node --disable-warning=ExperimentalWarning --loader ./tests/bsn-free/runtime-loader.mjs --test tests/bsn-free/*.test.mjs

Runtime tests use isolated mocks only. Source captures are not certified data
completeness or model promotion. API-Sports coverage advertises no BSN odds;
ROI stays null. Check archive counts/quality before defining any new experiment.

References: https://api-sports.io/sports/basketball,
https://api-sports.io/documentation/basketball/basketball-v1.yaml,
https://api-sports.io/terms. Account access is distinct from third-party data
publication rights; this collector provides private research storage and counts.
