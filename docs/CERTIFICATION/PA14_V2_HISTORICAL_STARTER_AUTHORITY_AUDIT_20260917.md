# PA-14 V2 — Historical Starter Temporal-Authority Audit

Date: 2026-09-17

Status:

`TEMPORAL_SEAM_HIGH_YIELD_IN_SAMPLE_FULL_V2_CERTIFICATION_STILL_GATED`

## Purpose

Test whether MLB's archived, timecoded live-feed snapshots can recover the historical **target starter state before first pitch** required by `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0`.

This is a temporal-authority audit only. It does **not** create or certify historical V2 feature rows and does not authorize `PE_PITCHER_K_V2` training.

## Execution

Scaled GitHub Actions run:

`35285006546`

Result: `SUCCESS`

Evidence artifact:

- artifact id: `10523378403`
- artifact SHA-256: `6b8e1933109c99fac377d18731bd0cb53e3765e7c1527269cfc25e203a13242c`
- sample games: **24**
- sample pitchers: **48**
- games with exact complete pregame starter match: **23 / 24 = 95.83%**
- expected pitcher identities recovered: **46 / 48 = 95.83%**
- Odds API/provider credits: **0**
- Supabase writes: **0**

The sample was spread across April through September 2025, with four deterministic games per month where the retrospective feature layer contained two pitcher identities and both pitchers had at least five prior starts.

## Temporal evidence rule

For a game to pass this audit:

1. the archived MLB timecode requested had to be strictly before target start;
2. returned `metaData.timeStamp` also had to be strictly before target start;
3. both expected MLBAM pitcher ids had to be present in `gameData.probablePitchers`;
4. the snapshot body was retained by SHA-256 digest;
5. postgame actual-starter identity was not allowed to substitute for missing pregame authority.

## Important mismatch — gamePk 776928

Target:

- Atlanta @ Cincinnati
- target start: `2025-07-31T23:10:00Z`
- retrospective feature-layer expected ids: `628452` and `671096`

Archived MLB snapshots:

- `2025-07-31T22:46:58Z`
- `2025-07-31T19:04:14Z`

Both snapshots reported:

- away probable: **Carlos Carrasco (471911)**
- home probable: **Andrew Abbott (671096)**

Therefore only one of the two retrospective ids matched the authoritative pregame snapshot.

Disposition:

`776928 = FAIL_CLOSED_TARGET_STARTER_IDENTITY_MISMATCH`

The audit does not rewrite the archived source to match the retrospective feature row. This mismatch is evidence that target/starter temporal authority is necessary and that retrospective target identity cannot simply be trusted as pregame truth.

## What this proves

The historical target/starter temporal-state seam is **recoverable at high yield in this bounded 2025 sample**.

23 of 24 games had exact two-pitcher agreement using MLB archived pregame snapshots, and the one disagreement produced a meaningful fail-closed identity correction rather than a missing-data ambiguity.

This materially improves the N3.4c recovery path. The canonical one-row stored V2 corpus is not the only possible source of target/starter temporal evidence.

## What this does NOT prove

No historical row is yet promoted to contract-valid V2 evidence.

The frozen contract still requires:

- exact immutable target schedule state and independent availability proof;
- complete same-season prior-start and opponent-game census;
- exact BF reconciliation;
- frozen pitch vocabulary and strike/type consistency;
- 100% required delivered-pitch velocity coverage;
- unfinished-PA witness handling;
- exact dependency/sourceVersions lineage;
- `dataAsOf <= cutoff < targetStart`;
- canonical digest/replay validation.

The existing 2026 collection probe for gamePk `824466` demonstrated that a valid pregame starter snapshot can still fail the complete builder on `INCOMPLETE_PA`, `MISSING_VELOCITY`, and `STRIKE_TYPE_CONFLICT`. Starter recovery alone is insufficient.

## Next gate

The next useful step is a **full frozen-builder yield audit** on historical targets that pass the temporal-authority seam.

That audit should measure, without semantic repair:

- contract-valid rows;
- rejection counts by exact reason;
- identity mismatch rate;
- missing velocity rate;
- strike/type conflict rate;
- incomplete-PA rate;
- BF reconciliation failures;
- incomplete opponent-census failures.

Only if the fully valid yield is adequate should Pick Edge reconsider `N3.4c` corpus sufficiency and authorize `N3.4d` training.

## Safety

- research-only;
- Official Picks untouched;
- APOSTAR inactive;
- production eligibility unchanged;
- no model training/calibration;
- no V1-as-V2 relabeling;
- no sportsbook/provider calls;
- no Supabase writes;
- no relaxation of the frozen V2 contract.
