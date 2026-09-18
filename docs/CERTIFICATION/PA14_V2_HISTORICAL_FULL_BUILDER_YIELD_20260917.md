# PA-14 V2 — Historical Full-Builder Yield Audit

Date: 2026-09-17

Status:

`HISTORICAL_PATH_VIABLE_SAMPLE_TEMPORALLY_INADEQUATE_FOR_MODEL_TRAINING`

## Scope

Test whether historical 2025 targets can satisfy the already frozen
`PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0` using authoritative archived MLB
pregame starter state plus the existing frozen V2 builder.

This audit does not recover V1, does not change the V2 contract, does not train
a model, and does not authorize N3.4d.

## Frozen boundary

- contract: `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0`
- builder: `697ead7e1d596aa3aeee50fbeafe45424735af5ca32f58c5786a4965064a0fc3`
- exact identity: `canonicalGamePk + pitcherMlbamId`
- strict temporal authority: archived target schedule/starter state must be pregame
- source census and all frozen pitch/terminal/BF/velocity/type rules remain fail-closed
- no V1 parameter or calibration inheritance

## Candidate universe

A read-only census of the 2025 retrospective starter layer found:

- **1,404** games with exactly two starter rows and both starters having at least five prior starts;
- **2,808** starter-target candidate rows;
- candidate date range: **2025-04-23 through 2025-09-28**.

This is only an upper-bound candidate census. It is **not** a count of
contract-valid V2 rows.

## Pregame starter temporal authority

The separate bounded archival audit remains:

- games: **24**
- expected pitcher identities: **48**
- exact complete two-starter pregame match: **23/24 = 95.83%**
- expected identities recovered: **46/48 = 95.83%**
- known fail-closed mismatch: gamePk `776928`

This established that archived MLB timecoded snapshots can recover the target
starter seam at high yield without using postgame actual-starter identity as
pregame authority.

## Corrected full-builder sample

Execution:

- experimental audit commit: `5b2140256d85a01001ef42f00ad74f9229009d95`
- Vercel deployment: `dpl_Ex6fUNZpAkdwwpvKZ1VU8RQa2mHk`
- final deployment state: **READY**
- sample: **36 fresh deterministic games / 72 starter-target rows**
- date coverage: April through September 2025
- both starters audited in every sampled game
- sportsbook/provider calls: **0**
- Supabase writes: **0**

Result:

- contract-valid/replay-stable rows: **18 / 72 = 25.00%**

Temporal distribution:

| Month | Rows | Eligible | Yield |
|---|---:|---:|---:|
| Apr | 12 | 8 | 66.67% |
| May | 12 | 5 | 41.67% |
| Jun | 12 | 1 | 8.33% |
| Jul | 12 | 1 | 8.33% |
| Aug | 12 | 3 | 25.00% |
| Sep | 12 | 0 | 0.00% |

The sample therefore proves historical V2 materialization is possible, but it
does **not** provide a temporally adequate training corpus. The eligible rows
are heavily concentrated early in the season.

## Blocker diagnostics

Across the 72 targets, blocker occurrences were:

- `INCOMPLETE_PA`: **40**
- `MISSING_VELOCITY`: **12**
- `STRIKE_TYPE_CONFLICT`: **13**
- unresolved unfinished-PA witness: **10**

Counts overlap: one target can carry multiple blockers.

The frozen contract requires all qualifying dependencies to remain valid.
Consequently, a historical source defect can block later targets that depend on
that game. The audit must not select older good dependencies around a bad one.

## Audit corrections made before the final run

Two audit-runner issues were corrected without changing V2 semantics:

1. canonical team identity recognizes exact source aliases `AZ -> ARI` and
   `CWS -> CHW`;
2. unfinished-PA witness logic now follows the frozen contract exactly: an
   authoritative runner movement with `isOut=true` and `outNumber=3`
   witnesses the unfinished batter PA, regardless of whether the enclosing MLB
   result is labeled wild pitch, stolen base, pickoff, etc.

A wild pitch/stolen-base event without a runner third out still fails closed.
These changes remove audit-runner false rejects; they do not relax the builder.

## Decision

`PE_PITCHER_K_V2_TRAINING_AUTHORIZED = NO`

`PE_PITCHER_K_V2_MODEL_STATUS = NOT_STARTED`

N3.4d remains gated.

The next valid step is **not** to train on these 18 rows and not to extrapolate
25% to all 2,808 candidates. The next step is to materialize/replay a
substantially larger historical census using the existing
`pa14_v2_evidence_bundles` storage/replay infrastructure, then measure the
actual contract-valid population and temporal coverage.

Only after the stored corpus itself is adequate should Pick Edge reconsider
N3.4c and begin a separately versioned `PE_PITCHER_K_V2` model.

## Safety

- research-only
- no Official Picks changes
- APOSTAR inactive
- no production promotion
- no sportsbook calls
- no historical Odds API credits
- no Supabase writes in this audit
- no V1-as-V2 relabeling
- no frozen-contract relaxation
