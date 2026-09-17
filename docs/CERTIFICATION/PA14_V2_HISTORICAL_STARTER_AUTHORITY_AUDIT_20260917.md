# PA-14 V2 — Historical Starter Temporal-Authority Audit

Date: 2026-09-17

Status:

`TEMPORAL_SEAM_RECOVERABLE_IN_SAMPLE_FULL_V2_CERTIFICATION_STILL_GATED`

## Purpose

Test whether MLB's archived, timecoded live-feed snapshots can recover the missing historical **target starter state before first pitch** required by `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0`.

This is a temporal-authority audit only. It does **not** create or certify historical V2 feature rows and does not authorize `PE_PITCHER_K_V2` training.

## Execution

GitHub Actions run:

`35284838912`

Result: `SUCCESS`

Evidence artifact:

- artifact id: `10523003295`
- artifact SHA-256: `8cd3fa52bb9a71b55428ec41d3b8c62c8cb8da954f9d4ead4218cff18c6e2af3`
- sample games: **4**
- sample pitchers: **8**
- games with exact complete pregame starter match: **4 / 4**
- expected pitchers recovered: **8 / 8**
- Odds API/provider credits: **0**
- Supabase writes: **0**

## Exact sample evidence

| gamePk | Target start UTC | Archived snapshot UTC | Away probable | Home probable | Result |
|---:|---|---|---|---|---|
| 777677 | 2025-06-01 18:10:00 | 17:49:34 | Keider Montero (672456) | Kris Bubic (663460) | exact 2/2 pregame match |
| 777678 | 2025-06-01 17:05:00 | 16:52:28 | Erick Fedde (607200) | Jacob deGrom (594798) | exact 2/2 pregame match |
| 777679 | 2025-06-01 20:10:00 | 19:53:54 | Mitchell Parker (680730) | Corbin Burnes (669203) | exact 2/2 pregame match |
| 777680 | 2025-06-01 20:10:00 | 19:44:49 | Chris Paddack (663978) | Luis Castillo (622491) | exact 2/2 pregame match |

For every matched game:

- the requested archival MLB timecode is strictly before target start;
- returned `metaData.timeStamp` equals the requested archival timecode;
- both expected MLBAM pitcher identities are present in `gameData.probablePitchers`;
- the snapshot body is retained by SHA-256 digest.

## What this proves

The historical target/starter temporal-state seam is **not inherently unrecoverable**. At least in this bounded 2025 sample, MLB's archived timecoded snapshots reproduce exact probable-starter identities before first pitch.

This materially improves the N3.4c path because the one-row stored V2 corpus is no longer the only possible source of temporal target/starter evidence.

## What this does NOT prove

No historical row is yet promoted to contract-valid V2 evidence.

The frozen contract still requires, among other things:

- exact immutable target schedule state and independent availability proof;
- complete same-season prior-start and opponent-game census;
- exact BF reconciliation;
- frozen pitch vocabulary and strike/type consistency;
- 100% required delivered-pitch velocity coverage;
- unfinished-PA witness handling;
- exact dependency/sourceVersions lineage;
- `dataAsOf <= cutoff < targetStart`;
- canonical digest/replay validation.

The existing 2026 collection probe for gamePk `824466` demonstrated that a valid pregame starter snapshot can still fail the complete builder on `INCOMPLETE_PA`, `MISSING_VELOCITY`, and `STRIKE_TYPE_CONFLICT`. Therefore starter recovery alone is insufficient.

## Next gate

Scale this audit to a larger, pitcher-diverse historical sample and then run the **unchanged frozen V2 builder** against targets that pass temporal-authority checks.

The next research question is not “can we invent historical V2 rows?” It is:

> What percentage of historical targets can satisfy every frozen V2 contract dependency without semantic repair or synthetic timestamps?

Only after that yield is known should Pick Edge reconsider `N3.4c` corpus sufficiency or authorize `N3.4d` training.

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
