# Tennis ATP/WTA winner research pilot

2026-11-11 Puerto Rico: production source receipt 25 passed the upcoming schema;
6 accepted singles (4 ATP, 2 WTA), 4 source quotes, 2 rejected rows. No tennis
results or forecasts in the production free-sports ledger. No live model enabled.

This research branch adds a local walk-forward replay for winner only. It does
not deploy, call a provider, settle bets or write to production. ATP and WTA Elo
ratings are independent, fixed K=32, with at least three prior decisive matches
per player. Canonicalize sides independently of the winner-first archive order.
Update only after all forecasts for the UTC result day. Results with unsupported
tour rank, doubles, duplicates, unclear identity or non-completion are excluded.
Identical records across captures are deduplicated; conflicts are excluded.
This is retrospective evidence, not certified live availability of past records.

Input: a private authorized JSON file, never committed, shaped as:
`{ "holdoutFrom": "YYYY-MM-DD", "holdoutThrough": "YYYY-MM-DD",
"captures": [{ "tour": "atp", "observedAt": "ISO timestamp", "body": {} }] }`.
The body is one complete documented historical results response. Include an
earlier warm-up period before the holdout. The replay rejects incomplete pages;
combine all pages with count reconciliation before providing an archive.
Fix the date range before evaluation. ROI is null; archived odds are ignored.

Run: `node --disable-warning=ExperimentalWarning --loader ./tests/dashboard-multisport/tsx-loader.mjs research/tennis-shadow-pilot-v1/replay.mjs /private/path/input.json`.
Tests: same loader with `--test research/tennis-shadow-pilot-v1/replay.test.mjs`.
Two synthetic test cases prove chronology/identity guards, not live accuracy.

Provider docs: https://docs.tennis-api.com/results and
https://docs.tennis-api.com/getting-started . First scope check: one completed
singles day per tour, via `/tennis/v2/{atp|wta}/results/{date}` with
`filter=PlayerGroup:singles`, `pageNo=1`, and `pageSize=500`. Check plan
entitlement and response completeness before expanding a historical collection.
Do not infer permanent retention or display rights from a successful API response.
No explicit historical retention permission was found in the reviewed public
documentation. No new history call, raw archive or credentials in this branch.

Before live shadow forecasts: confirm permitted historical input, run a true
chronological replay, certify upcoming-to-final identity and timestamp semantics
with observed examples, and freeze the separately tracked cohort. No official
picks or betting ROI before separately verified pricing and settlement rules.
