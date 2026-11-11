# BSN API-Sports archive V2

Scope: source acquisition and quality audit only. No model activation, forecasts,
Official Picks, settlement changes, or ROI claims. Frozen 38-game pilot retained.

Production secret: BSN_APISPORTS_KEY. Server requests only to
https://v1.basketball.api-sports.io using x-apisports-key. Never retrieve the value
through connectors or expose credentials in logs, responses or artifacts.

## Acquisition

Authenticated production route: /api/cron/bsn-archive. The BSN scheduler is
paused because the authorized study scope (2025 and 2026 only) is outside the
verified free-plan range. Other sports retain their schedules.
A unique 8h batch claim reserves at most 20 calls; disjoint child receipt slots
are claimed before each request. At most 60 requests per UTC day from this
collector, leaving 40 of the advertised 100/day for manual/other account use.
Calls are spaced >=6.5 seconds; provider reported remaining quota <=10 stops
that batch. This cannot account for untracked calls from other applications.
No automatic retry of failed, interrupted or denied requests. Unknown failed or
RUNNING receipts stop acquisition. A verified free-plan range denial narrows the
remaining queue without deleting or rewriting either request or batch receipt.
A provider quota reserve stops all further batches that UTC day.

Catalogue /leagues?id=76. Any future API-Sports acquisition under this study
uses /games?league=76&season=YYYY for 2025 or 2026 only. Per-game team/player stats in
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

## First production capture and plan limit

2026-11-11 01:53 UTC: catalogue returned HTTP 200 and 12 advertised seasons.
2024 returned 250 unique finals, all passing score arithmetic and matching the
250 user-supplied Live Demo records field-for-field. Raw SHA256
ea2090e5072ba7e4cf16f03be03b5b3384cfe07137b974c257262b447ea85825.
The 2025 call returned HTTP 200 with a provider plan error explicitly giving
2022–2024. V1 receipts are retained. V2 verifies the archived error hash and
uses the stated interval to determine that neither 2025 nor 2026 is accessible
on this free plan. No 2022/2023 calls were made. The 250 games of 2024 are
preserved outside the study. No paid tier requested.

## Target data and roster-aware research

Only BSN 2025 and 2026. Prioritize a permissioned season export from BSN with
calendar, final scores, venue/phase, per-game team and player rows, player IDs,
transaction announcements and registration/effective dates. RealGM has public
box score examples from both years but disallows automated extraction; it is
a reference only. Official BSN posts report transactions but team rights alone
do not establish an active player. No free authorized bulk export confirmed.

Track player identity across seasons and team spells. Keep announcement time,
effective time and first confirmed eligibility separate; only information
known before the target game is usable. Build expected rotation/minutes from
prior games and verified announcements. Use prior player form with a role
adjustment for a new team, and never backfill current roster membership or use
the target game’s box score to decide availability. Missing roster evidence
means unknown. Compare the roster model to an identical chronological team-only
baseline on common games, including games after roster changes. Develop on
2025 and reserve 2026 for a chronological evaluation when data are available.
ROI requires separately verified historical prices and market contracts.
