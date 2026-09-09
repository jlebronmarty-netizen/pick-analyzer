# R2T-R3 live re-enablement

Verdict: `MLB_DATA_02R_R2T_R3_LIVE_REENABLEMENT_CERTIFIED`. All twelve R3 evidence gates and publication checks pass. No production live refresh, sports-provider request or production row write has run during this certification.

The manual launcher invokes the existing R2B -> R2I canonical path. It requires a canonical R3 certificate covering the exact 32-file transitive runtime/model/policy/schema inventory. Any missing gate, changed source, different model/order, fixture path or package mismatch blocks execution. CRLF normalization makes source checking consistent across Windows and deployment checkouts.

The actual run freezes its Puerto Rico operating date and run-start timestamp once. The caller cannot supply a historical clock. An explicit package SHA must match HEAD, and every runtime/certificate file must be tracked and identical to HEAD; staged or unstaged execution-source changes block. Resume requires the same private freeze and package. Completed runs require a new freeze. A private exclusive lock prevents overlapping invocations, and checkpoint/provider/write journals stay outside the public repository.

This launcher uses the stricter **one Odds API request per manual invocation**, cached across retry. MLB Official and the shared Statcast engine retain bounded ledgers; substitute providers are forbidden. Production provider transports accept only the three known HTTPS hosts and reject redirects. No test transport can be supplied to the production factory. Missing private budget history cannot silently initialize a new allowance after previous consumption.

Native updates now predicate on every old row field, including complete JSON metadata and NULLs. A disposable PostgreSQL concurrency test changes metadata without advancing its timestamp; the planned update writes nothing and fails closed. An actual SELECT-only Supabase request verifies the full expected-old predicate syntax against an independently read row. Fresh Official status/starter evidence vetoes decisions after game start or starter change and cannot replace frozen model inputs.

Validation:

- 66 disposable PostgreSQL integration assertions pass, using real archived multi-game feature evidence and explicitly isolated structural market/cold-fetch probes.
- Five R3 guard groups and three private-store/provider/crosswalk guard groups pass.
- All 32 source hashes match the files used during the integration replay and guard tests.
- Fresh read-only schema review matches 406 columns and 116 preserved constraints, with six native snapshot-unique indexes, no invalid indexes and no orphan snapshot references. All 118,064 daily rows remain present.
- Nineteen existing NOT VALID positivity checks are preserved. Independent SELECT-only scans find zero violating rows; no additional DDL or constraint validation was performed.
- Build exits 0 with 400 pages; changed-file ESLint has zero warnings. Diff and bounded publication scans pass without configured secrets, private keys, JWTs or raw production samples.

The prior R2T-R2 certificate remains historical and unchanged. Its legacy validator containment failures are not relabeled as passes. Actual current-slate live acquisition is the next independently recorded action, not a result inferred from local fixtures.

Recovery: stop invocation or revoke the R3 certificate to fail closed; do not roll back valid immutable writes. Keep the original private run freeze, source response cache and pending-write journal. Recover uncertain requests by independent readback before retry, and refresh only the read-only schema preflight when expired. The same package is mandatory for resume. A source/model change requires recertification and a new run; no live package switching or force push.

The public certificate contains structural checks, counts and digests only. No production source rows, vectors, sample prices, personal records or credentials are included. All 19 inherited artifacts and protected directories are preserved. Repeatability, automation, settlement/performance and Today remain incomplete mission gates.
