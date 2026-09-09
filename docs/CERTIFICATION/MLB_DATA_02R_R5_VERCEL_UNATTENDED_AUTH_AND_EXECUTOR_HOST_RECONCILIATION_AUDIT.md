# R5 unattended authentication and executor host audit

Verdict: **MLB_DATA_02R_R5_BLOCKED**. Authentication repair is complete; persistent-host certification remains blocked. Final operational certification is not issued.

Starting package: `56d3ce5f923e67f97d22bfb0dd092f71d77617c8`. The credential refresh redeployed that exact source as `dpl_C1BvejDnZA1qyruRmjPzB4XNvvSC`, READY. The enclosing bounded documentation commit records the results without changing the certified executor.

## Credential repair and proof

Authenticated Vercel management inventory found `SUPABASE_SERVICE_ROLE_KEY` scoped to Production, Preview and Development. Its stored value had service-role/project-shaped JWT claims but differed from the known-good local credential, including after trimming. Claims were diagnostic only, never authentication. The management-retrieved value independently returned HTTP 401 from the fixed Edge endpoint. This establishes **WRONG_ENV_VAR_VALUE**; the historical origin of that value was not determined.

The original variable retains its unchanged Preview/Development value. Production now has a separate encrypted variable of the same server-only name, populated from the accepted secure local source through memory/stdin. Secure management readback matched. No values, credential hashes, secret-bearing command arguments or secret files were published. No new dedicated secret or Edge auth relaxation was needed.

The Edge function compares `Authorization: Bearer` exactly against its configured legacy or modern server keys before database access. JWT issuer/audience validation is not used. The client also sends `apikey`. Database work is confined to the existing fixed SELECT in a read-only transaction. The underlying database connection is not represented as a dedicated least-privilege role.

After redeployment, the actual protected Vercel route returned HTTP 200/PASS on the same package: **406 columns, 116 constraints, 84 indexes, six snapshot uniqueness indexes, zero invalid indexes, zero orphan references**, and zero historical-check violations. Champion, 76-feature set and Policy V1 contracts passed. The canonical JSON includes only aggregate readback and presence/scope inventory.

## Remaining host gate

The authenticated GitHub repository runner inventory returned HTTP 200 with zero registered runners. Windows scheduler/service inventory found no matching MLB/Pick Analyzer runner. Existing repository workflows use `ubuntu-latest` and legacy HTTP fallback/observer endpoints. Existing Vercel crons remain unchanged and are not evidence of a persistent certified R2 coordinator.

The existing executor requires one persistent Node/Git host retaining its private filesystem checkpoints, exclusive locks and mission-wide provider ledger. An ephemeral Vercel invocation cannot satisfy that contract. No existing host with the required access and durability was identified. No second executor or scheduler was created, and no production refresh was launched.

Host preflight, restart/budget readback, overlap and stale-lock recovery remain unexecuted on a real host. Dry tests do not substitute for them. `runtimeHost.verified` remains false; certified coordinator and automatic settlement remain disabled. Identify/connect the existing always-on host, preserve the trusted private journals and Odds ledger at **2/20**, then complete those gates before activation and scheduled readback.

## Validation and containment

- 27 preflight regression checks pass, including invalid credential rejection and unverified/ephemeral-host containment.
- 16 dry behavior/integration groups pass. The initial isolated run lacked external PGlite; linking the already-installed validation dependency into its private OS-temp directory resolved that test setup issue. No production effects occurred.
- 12 production desktop/mobile/API checks pass across Today, Value Board, Data Health and Performance. No fixture UI, horizontal overflow or runtime errors; performance truthfully reports no settled sample. Screenshots remain private outside Git.
- Build passes with 400 generated pages. All 41 certified automation source hashes remain unchanged.
- R5 sports providers: **0**. Production DML: **0**. Production DDL: **0**. Odds consumption: **2/20**, unchanged. No scheduler activation, live refresh or settlement.
- All 19 inherited tracked-file hashes match their preserved baseline. `.tmp/` and `.worktrees/` were not touched.

Rollback of automation remains disable-first, preserve journals, inspect in-flight intent and retain immutable rows. Credential recovery uses secure management and a fresh runtime preflight; reinstating the rejected key is not an operational recovery strategy. No database rollback is needed for this phase.
