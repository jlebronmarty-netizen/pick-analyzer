# R12 approved operational budget implementation

Production activation is pending separate approval of the exact migration in `MLB_PHASE2_R12_DDL_APPROVAL_PACKET.json`. This is local implementation/integration certification, not a claim of a recovered production run.

The approved policy is `MLB_ODDS_OPERATIONAL_BUDGET_V1`: 48 requests per Puerto Rico calendar day, one per run including uncertain attempts, and minimum intervals of 60 minutes above 180 minutes to nearest eligible start, 30 minutes above 60 through 180, and 15 minutes above 5 through 60. No eligible scope means no request. The ceiling is not a consumption target. Cadence uses the latest reservation/observed response across midnight, while consumption remains charged to the original reservation date.

The separate append-only reservation identity is the run scope key; policy version is fixed by a database constraint. Unique daily slots in the range 1–48 also enforce the ceiling physically. The existing distributed lease and transaction serialize reservation, per-run count and DML-accounting updates. HTTP response fields alone can be updated by the service role, once through the endpoint's immutable readback contract. No reset or refund operation exists. The historical mission row is read but never incremented by the deployed operational path.

The scheduler checks budget/cadence after validated contexts and before feature persistence, then the authority checks again immediately before reservation. Expected exhaustion completes as `ODDS_BUDGET_EXHAUSTED`; cadence completes as `ODDS_CADENCE_DEFERRED`. Neither fabricates markets or leaves an unresolved failed run. INCREMENTAL, POSTGAME and OVERNIGHT continue through the existing host loop. All other existing hard stops remain hard stops.

Same-run consumed evidence resumes through the unchanged private digest/frozen-lineage contract. Cross-run cached prices are not rebound to newer predictions. The certified ten-minute freshness requirement and original provider timestamps remain unchanged. Slower cadence can truthfully leave stale/unavailable markets between acquisitions.

## Credit semantics

The actual client URL specifies `baseball_mlb`, `regions=us`, `markets=h2h`, `oddsFormat=american`, with no bookmaker override. The [official v4 usage documentation](https://the-odds-api.com/liveapi/guides/v4/#usage-quota-costs-1) specifies one credit per region per market and defines `x-requests-last`, `x-requests-used` and `x-requests-remaining`. Thus the configured ordinary populated request is nominally one credit; request counts are not used as measured subscription-credit consumption. Only validated numeric response-header values are retained. Missing/invalid headers remain null. No provider request was made to inspect the subscription. Account-wide used/remaining credits are not the historical mission counter or the daily operational counter.

Prior preserved-response analysis found 83.1854% unchanged comparable quotes and no identical complete consecutive snapshots. The earlier Sep 12 scheduling simulation estimated 42 acquisitions versus 55 quarter-hour opportunities; this is a planning example, not promised consumption. Maximum nominal daily credits for 48 populated requests under the verified configuration are 48; actual credits require observed headers.

## Schema and rollback

The only proposed production DDL creates `public.pick2_mlb_odds_operational_requests`, its constraints/indexes, RLS and service-only grants. It creates no rows and does not alter existing table definitions, policies, grants, features, models or accounting. Its FK references the existing runtime primary key with restrictive update/delete behavior. Full catalog definitions are in the approval packet and schema-contract JSON.

The migration is transactional: execution failure rolls back the entire migration. After successful commit, operational rollback is deliberately non-destructive: stop new Odds acquisitions, finish or disposition existing runs only through certified guards, return to the previously certified exhausted-mission host behavior with a compatible prior Edge candidate, and retain the new ledger and every reservation. Do not drop the table or delete/reset counters. Any later schema removal needs its own explicit authorization. The disposable suite verifies denied clients, column-only service updates, catalog drift rejection and transaction rollback on failed checks.

## Production boundary and next steps

Fresh read-only production verification found historical usage 20/20, no operational table, one unresolved historical run, and all 13 predictions from its freeze preserved. This phase made zero sports-provider calls, zero production DML and zero production DDL. The historical run has not been dispositioned in this phase.

After exact DDL approval: re-hash the migration; capture existing catalog/count/accounting baselines; apply only that SQL; independently read back catalog/RLS/grants/FK integrity, existing counts and historical mission digest. Then verify the exact candidate SHA and manifest, deploy the paired Edge/runtime, test missing/wrong/public bearer rejection and valid inspect/schema/lease behavior, apply disposition only if its current digest/time/accounting predicates pass, and observe natural scheduled production execution. No historical Odds reacquisition or manufactured market/value/pick rows.

## Product semantics

Data Health now separately projects web deployment SHA, actual Edge deployment version when reported, frozen run SHA, configuration and observed health, historical 20-call accounting, daily operational request accounting, and observed subscription credits. Missing runtime/Edge evidence remains unavailable. A configured scheduler is not automatically healthy. No privileged runtime rows or credentials enter public responses.

`/mlb` is labeled **MLB Research Lab**, explicitly experimental/shadow and separate from Champion V1 / Policy V1 recommendations. Its engine is preserved. Today and Value Board retain the canonical read model; settlement remains production-disabled and Performance remains truthful about missing settled samples.

## Reproduction

Use the existing external disposable PGlite installation via `R6_PGLITE_MODULE`; do not point the validators at a production database. Run `mlb-phase2-r12-operational-validate.mjs` with `scripts/local-ts-loader.mjs`, `mlb-phase2-r12-health-validate.mjs`, and `mlb-phase2-r12-budget-validate.mjs`. The R11-R1 harness accepts `operationalOdds:true` against its existing private disposable base and injected providers, exercising the actual R2 call graph. Its observed result is 8 predictions, 8 mappings, 16 observations, 16 values, 0 Policy V1 picks, and zero second-pass inserts/additional Odds requests. These are disposable counts, not production samples.

The certificate records the additional R6/R7/R8/R9/R10, readiness and presentation regressions. Raw private fixture contents are not published. Deployment is not certified until post-DDL production readback succeeds.
