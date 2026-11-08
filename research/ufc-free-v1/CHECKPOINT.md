# UFC FREE V1 — release checkpoint

Code merged in PR #302, merge 046a7acc2bf9fd54d7f30f6a4ee4f1b924ade384. Production dpl_4fqTDrLSf62Q9HE34YZ2psF8XYrA READY. Exact tested code head eea41db1c51011791d2acedc955b8bec16e4497c, tree 9566e8ea24587c4a88bcd4f04d71e7121553e18e. Concurrent main f2529472 preserved (Soccer/TT/NCAAF overview and filters).

Preview and public /ufc and /api/ufc/overview verified: 34 upcoming bouts, 21 SHADOW forecasts, 13 abstentions, six original paired quotes. Homepage card click reaches /ufc; desktop 1363px has no horizontal overflow. Light label contrast corrected and observed rgb(14,116,144), WCAG 5.36:1 against white. Responsive classes implemented; separate mobile viewport not certified by this review. Browser tab left at public /ufc.

App API returns providerCalls=0 and databaseWrites=0. Before/after preview reads, prediction fingerprint b5c2351fac8b3674e754bf07c112c556 unchanged. Public cron request returned 401 UNAUTHORIZED, no key retrieved. Six table RLS guards verified; no anon/authenticated grants; immutable service tables cannot UPDATE/DELETE/TRUNCATE. Existing project security findings outside UFC unchanged.

Recorded FREE calls before scheduled run: 5 source preflight + 8 bootstrap = 13 archived source observations. The 404 preflight preserves the exception only, with its audit-recording timestamp explicitly distinguished from unknown original request/capture time; four other preflight payloads have exact file timestamps/raw hashes. No fabricated missing body.

Automatic schedule: 49 1,5,9,13,17,21 UTC, authenticated production-only, 4h slot and lease, max8 calls/230s, strict public ESPN hosts, no paid providers, no retries on access denial. First natural scheduled cycle VERIFIED: UFC:124595, 2026-11-08T21:49:27.837991Z–21:49:29.769Z, eight FREE calls, PARTIAL only for the four quarantined histories. Lock free. Forecast count 21 and fingerprint b5c2351fac8b3674e754bf07c112c556 unchanged; 12 quote observations cover 10 bouts, original priced forecasts remain six. Total ledger: 21 calls / 21 sources including initial preflight. No evaluator/collector local process remains; production scheduler stays enabled.

Science: NO_DEMONSTRATED_ROI; six policies plus two comparators, no candidate selected. Original source CSV Git blob hashes and SHA256 exactly verified without additional requests. Reduced factual fields match 8,679 historical and 7,340 quote rows; input gzip and source seed hashes verified. Independent Python replay PASS; 103 dashboard/UFC and 292 Edge Lab tests PASS, scoped ESLint and full build PASS. Historical ROI never enters forward accuracy.


Release replay: initial-forward-archive.json.gz contains all 21 public source observations, the 21 original predictions and 12 quotes through the first automatic cycle; twenty raw SHA256 checks PASS, one deliberately absent404 body remains explicit. `node --loader ./tests/dashboard-multisport/tsx-loader.mjs scripts/ufc/verify-forward-archive.mjs` replays every original forecast and six entry prices exactly, with no provider calls or database writes.
