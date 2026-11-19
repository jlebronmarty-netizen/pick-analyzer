# Homepage loading repair — 19 November 2026

## Observed incident

The production `/` route displayed its navigation and shell but remained on
`Loading official performance…` and the connected-sports calendar placeholder.
Both components await the same `getMultisportModelReport()` aggregation. Vercel
recorded a 300-second function timeout on the production deployment based on
`dce6ae2ddcb19dd3798159384f09e933f7234b33` at 12:57:35 UTC.

The live database inspection found 4,485 Edge Lab multisport forecasts across
16 Puerto Rico dates. The observed recent Edge Lab database requests succeeded;
maximum observed database duration was 192 ms (354 ms origin duration). This
does not identify every part of the timed-out request, but contradicts a claim
that all of those ledger reads were themselves stalled for 300 seconds.

## Identified loading defect

The homepage requested full Edge Lab reports even though its cards only need
validated identity fields and outcomes. Full report construction computed every
historical daily group by rescanning every row and constructing an ICU
`Intl.DateTimeFormat` instance each time. This work also ran before the shared
homepage calendar could finish, although that calendar does not use those daily
groups.

A synthetic benchmark with the observed ledger size and day count reproduced
the allocation problem. It used the old daily grouping expression and existing
`multiMetrics` implementation, then compared the same data with the replacement:

| Daily grouping | Elapsed | User CPU | Peak process RSS |
|---|---:|---:|---:|
| Previous expression | 6,446.9 ms | 4,020.5 ms | 1,297.6 MiB |
| Group once, reuse formatter | 20.7 ms | 21.2 ms | 49.1 MiB |

Both produced the same 64 daily metric rows and SHA-256
`1227c51dbc918e847677d4b721b5f46872fc77021dd368b31ff111a420a8c3d4`.
These are local synthetic measurements, not a production latency claim. They
confirm substantial avoidable CPU/native-memory allocation; they do not prove
that date conversion alone accounts for all 300 seconds of the incident.

## Repair scope

- Homepage Edge Lab readers now select only the identity, contract and outcome
  columns used by the existing card validator. Raw payloads, private selections,
  daily tables, run histories, locks and request budgets are not loaded for cards.
- Both ledgers and all pagination requests share one 15-second abort deadline.
  Failed, aborted or capped reads remain unavailable; they are never converted
  into zero outcomes or partial accuracy. The original full-report row caps and
  Soccer cohort filter are preserved.
- Full protected reports retain their public fields, metric functions, order and
  result accounting. Daily rows are grouped once with one cached Puerto Rico
  date formatter. Card membership checks use a Set rather than repeated scans.
- The shared multisport aggregation now gives each source a 28-second
  presentation deadline. A failed or slow source becomes explicitly unavailable
  while successfully read sports remain visible, and both dashboard sections
  disclose which source could not load. This limit bounds presentation only;
  it is not universal cancellation of the underlying I/O. Source services retain
  their own abort policies, including the actual 15-second `AbortSignal` on the
  new Edge Lab overview reads. Late rejections are consumed and cannot replace
  a rendered fallback or become unhandled errors.
- Models, predictions, historical rows, settlement, Official Picks, provider
  acquisition, cron configuration and the MLB pause are unchanged by this fix.

## Verification

Targeted tests cover minimal-column/full-ledger card parity (including numeric
MAE), pagination, the shared abort deadline, scan-cap failure, Soccer schema and
cohort filtering, Puerto Rico midnight boundaries, grouping output parity and
source immutability. The following targeted command passes all 121 tests:

```sh
node --test tests/edge-lab-overview.test.mjs tests/edge-lab-overview-loading.test.mjs tests/edge-lab-multi.test.mjs tests/edge-lab.test.mjs
```

The dashboard suite also passes all 98 tests, including the new multisport
resilience cases and existing display/accounting regressions. Its command is:

```sh
npm run test:dashboard-multisport
```

The 28-second guard tests cover a stalled or failed source, healthy-source
preservation, explicit unavailable metrics, warnings and late rejection handling.

The full Next.js production build passes, including TypeScript, page-data
collection and route generation. The local command used
`NODE_OPTIONS=--max-old-space-size=4096` and the same placeholder Supabase URL,
publishable key and service-role key used by the repository's CI workflow.
The initial default-heap attempt exhausted the local Node heap; no repository
build settings were changed and no production secrets were used for this build.

Protected Preview/browser verification and production release remain pending.
Record those outcomes separately after completion. Successful local tests and
the synthetic benchmark do not certify that production has recovered.
