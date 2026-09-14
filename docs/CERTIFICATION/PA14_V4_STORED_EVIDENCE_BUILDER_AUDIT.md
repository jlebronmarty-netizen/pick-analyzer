# PA14 V4 — PE Pitcher K V2 Stored-Evidence Builder Audit

Date: 2026-09-14

## Verdict

`PA14_V2_STORED_EVIDENCE_BUILDER_CERTIFIED = NO`

`PICK_EDGE_PA_14_V2_DATA_CONTRACT_READY = NO`

The deterministic builder implementation is present and its frozen-contract fixture checks pass, but the current production evidence inventory cannot yet produce a contract-eligible row. The frozen semantics were not weakened to increase coverage.

## Code and contract state

- Baseline `main`: `88e5e24a189bdc1a40428e24c6a2932b4518eb24`.
- Work branch: `pa14-v4-pitcher-k-v2-builder`.
- Frozen contract: `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0`.
- Frozen markdown normalized SHA-256: `d263b24cbf97ce43d0990ac1034b94cc1f8d8e2920e3cb1cea42d14ec4ef1f50`.
- Frozen JSON schema normalized SHA-256: `6ed57c47a257330ff22fb1de44d81b1223ce54996ef224445d49d76c686950b8`.
- Builder: `src/lib/pe-pitcher-k-v2-builder.ts`.
- Deterministic self-test: `scripts/pa14-v4-builder-self-test.mjs`.
- The builder remains pure/read-only and publishes no model output.

## Correct production data source

All inventory findings in this audit are from the Pick Analyzer Supabase project `ynuocvexviorgdjrfthw`.

No provider call, production DML or production DDL was used for this audit.

## Stored raw census

Exact SQL readback from `pick2_raw_mlb_statcast_pitches`:

- rows: `1,367,392`
- distinct games: `4,649`
- minimum stored game date: `2025-03-18`
- maximum stored game date: `2026-09-12`
- raw rows with null `release_speed`: `5,022`

`pick2_mlb_games` contains `4,666` canonical rows, but its current game-date horizon ends at `2026-09-13`; it contains zero `2026-09-14` or later games at this readback.

## Frozen pitch vocabulary audit

Against the exact frozen V2 description/type vocabulary:

- total raw pitches: `1,367,392`
- null description/type: `0`
- unknown description: `0`
- description/type conflicts: `22`
- automatic-ball/automatic-strike rows: `4,580`
- valid delivered pitches after automatic exclusions: `1,362,790`
- valid delivered pitches with missing velocity: `527`

The 22 conflicts are deterministic blockers under V2:

- `1` known `swinging_strike / type X` collision: game `778319`, pitcher `686752`, at-bat `6`, pitch `3`, terminal event `field_out`.
- `21` `hit_into_play / type S` collisions, all observed with terminal event `catcher_interf`.

No reinterpretation or silent vocabulary repair is authorized. Dependent rows must remain blocked with `STRIKE_TYPE_CONFLICT`.

The 527 delivered pitches with missing velocity are also contract-relevant. Any qualifying starter history containing one of these delivered pitches must fail the 100% velocity-coverage gate rather than silently dropping it.

## BF reconciliation gate

The current persisted PA-12 table `shared_mlb_pitcher_game_actuals` contains `19,214` immutable observed pitcher-game actual rows, but the frozen PA-12 payload does not contain authoritative batters-faced values.

The production `historical_baseball_pitcher_appearances` table is empty.

Stored MLB `sport_player_stats` contains SportsDataIO game rows, but the inspected provider payload exposes pitching fields such as `PitchesThrown`, `PitchingStrikeouts`, outs and runs without an authoritative `BattersFaced` field. Those rows are also marked `validation_status=quarantined` / `production_eligible=false` in the inspected metadata.

Therefore the V2 requirement

`completed starter-attributed PA == authoritative source box-score BF`

cannot currently be proven from persisted production evidence. Reconstructed terminal PA alone is intentionally insufficient under the frozen contract.

Current classification:

`BF_RECONCILIATION = BLOCKED_AUTHORITATIVE_BF_NOT_PERSISTED`

## Current target / starter evidence

A stored September 14 MLB Official schedule payload exists outside `pick2_mlb_games` in the temporary export evidence and contains 10 scheduled games / 20 probable starters, including canonical MLB `gamePk` identities such as `824465`.

This proves that a useful current target population was observed, but it does not satisfy the frozen temporal contract by itself:

- the canonical `pick2_mlb_games` horizon still ends on September 13;
- `mlb_starter_assignments` currently has zero rows;
- the stored temporary schedule observation has an acquisition timestamp, but no independently persisted authoritative source-state timestamp for the probable-starter state was identified;
- acquisition time alone is explicitly insufficient for V2 `authoritativeAt` / `dataAsOf`.

Current classification:

`REAL_PREGAME_ROW = NONE_CERTIFIED`

`PREGAME_STARTER_PROVENANCE = BLOCKED_AUTHORITATIVE_SOURCE_STATE_TIMESTAMP`

## Temporal and leakage status

The builder itself enforces:

- same-season source history;
- official source date before target official date;
- no same-day source games;
- cutoff before target start;
- authoritative/available timestamps no later than cutoff;
- starts-only pitcher history;
- complete census identity equality;
- deterministic ordering and duplicate handling;
- strict BF reconciliation;
- strict velocity coverage;
- frozen strike vocabulary.

Fixture/golden deterministic replay passes, but a full production-row leakage certification is not claimed because no production row can clear BF + pregame temporal provenance simultaneously.

`PA14_V2_TEMPORAL_LEAKAGE = NOT_CERTIFIED_ON_PRODUCTION_ROW`

This is not a detected leakage event; it is a fail-closed evidence gap.

## Consumer readiness

No `/api/consumer/v1/mlb/pitcher-k-features` endpoint is authorized or implemented from this audit.

Consumer implementation remains gated on all of the following:

1. authoritative historical starter BF evidence persisted/retrievable for qualifying starts;
2. authoritative source-state timestamps for contributing evidence;
3. at least one legitimate pregame target with canonical game + pitcher identity and pregame starter provenance;
4. deterministic builder replay over that real stored evidence;
5. zero temporal leakage.

## Exact next action

Recover or acquire an authoritative, timestamped source for historical starter `battersFaced` and current probable-starter state without changing the frozen V2 semantics. Prefer an already available provider/subscription and preserve raw provenance/digests. Before any provider acquisition, schema change or production persistence, keep the current hard gates: no unapproved provider calls, no production DDL and no broad production DML.

Once the evidence exists, rerun the census and only then consider:

`PA14_V2_STORED_EVIDENCE_BUILDER_CERTIFIED = YES`

followed by a read-only Consumer implementation and production pregame readback.
