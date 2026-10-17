# MLB historical OPEN repair — 2026-10-17

Status: **REPAIRED_VERIFIED_OUTCOMES_CONTRACT_REVIEW_REMAINS**. This is not a claim that every historical OPEN can be graded.

## Verified production data repair

Audited all 75 pending master-ledger observations against 35 exact MLB Official game identities. Archived 70 FREE schedule/boxscore responses in `official-raw.zip`, with byte-level SHA256 in `raw-manifest.json` and `provider-calls.jsonl`. There were 71 FREE requests including the explicitly recorded earlier connectivity probe; no paid credits. The probe body was not retained; the subsequent auditable acquisition is retained. No fuzzy name matching or missing-to-zero inference.

| Disposition | Observations | Outcome |
| --- | ---: | --- |
| MIL +1.5, game 849811, two frozen Run Line models | 2 | WIN; official final MIL 6–2 LAD, away margin +4 |
| Final boxscore roster entry has no batting participation statistics | 59 | OPEN / NO_BATTING_PARTICIPATION_CONTRACT_REVIEW |
| Final boxscore explicitly records zero plate appearances | 3 | OPEN / ZERO_PA_CONTRACT_REVIEW |
| Game 849817 postponed/rescheduled, no completed final | 11 | OPEN / POSTPONED_CONTRACT_REVIEW |

The two WIN observations are the same game in two models, not independent games or certified executed bets. Props remain outside W/L accuracy. A roster entry without batting statistics does not establish a specific historical sportsbook action/void rule. Zero PA does not justify a free under win. Historical jurisdiction/participation/postponement terms were not certified in the frozen quote contracts; no retroactive policy was invented to assign VOID.

MLB schedule can return both postponed and rescheduled entries for one gamePk. The parser selects a unique completed entry, checks both team identities, and fails closed on ambiguous finals. This corrected the preliminary count that classified five rescheduled-final observations as still postponed. The other 59 rows have roster entries but no batting statistics; they are not described as absent players.

## Application repair

- Research history renders an allowlisted explanation for OPEN. Raw metadata and hashes are not sent to the client.
- Null settlement values stay null. The former `Number(null) === 0` conversion cannot manufacture a zero-valued under result. All 73 pending master actual values were cleared to null.
- The standard Run Line consolidation now reads verified official evidence and grades the frozen side/line against the exact final, with date/team/game identity gates.
- Existing settled prop and master rows are skipped and guarded by `result IS NULL` updates. Existing master predictions are never rewritten: only outcome fields and the settlement metadata section can update.
- The existing authenticated forward-master cron reserves deterministic per-game/day jobs before FREE requests. Maximum 20 requests/run, no automatic same-day retries, final evidence reused, non-final evidence refreshed at most once per UTC day. No new worker, scheduler, public writer or paid provider was added.
- `sports_sync_jobs` stores sanitized evidence and response hashes for reuse. Its normal RLS/service-role access remains unchanged. Canonical game/results tables and Official Picks were not changed by this repair.

## Verification and reproduction

`baseline.json` and `verification.json` confirm exact preservation of all original frozen master columns, frozen approved-prop rows, previously settled master/prop rows and Official Picks. Master count remains 851; OPEN falls from 75 to 73. No pending actual values remain non-null. There are 35 completed evidence jobs.

Run `npm run test:dashboard-multisport`, `node scripts/verify-mlb-release-readiness.mjs` and `npm run build` with approved local environment configuration. Targeted cases cover nulls, exact identities, postponed abstract-Final statuses, rescheduled finals, zero PA, contract-review states and frozen Run Line direction. Runtime pin certificates were not weakened or rewritten.

For offline reproduction, extract `official-raw.zip` into this directory and run `node --loader ./tests/dashboard-multisport/tsx-loader.mjs research/mlb-open-repair-20261017/prepare.mjs`. This verifies raw hashes and creates normalized evidence, decisions and the original full transaction. Do not rerun acquisition unnecessarily. `acquire.py` is explicitly bounded and reuses existing files.

The oversized initial SQL requests failed at transport with expired requestState and did not change the ledger; a readback confirmed 75 OPEN. Evidence was then imported in bounded batches. The production data mutation used `apply-repair.sql`, one guarded transaction. Both SQL repair forms intentionally reject a changed/already repaired cohort instead of regrading it. Use read-only verification for repeats.

Remaining dependency: certify the applicable historical participation/postponement rules for these exact frozen contracts before closing 73 rows as VOID or another outcome. Until then their explanations are visible and their W/L contribution remains zero.
