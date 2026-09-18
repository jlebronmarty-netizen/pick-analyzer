# PA-14 V2 — MLB Official Type Repair Certification

Date: 2026-09-17

Status: `SOURCE_REPAIR_VALIDATED_TRAINING_STILL_BLOCKED`

## Purpose

Correct a narrow class of **stored source defects** where the classified
Statcast row has a pitch `type` inconsistent with its pitch description, but
MLB Official can prove the exact pitch identity and authoritative call.

This does **not** change `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0` and does not
change the frozen builder.

## Repair admission

A repair is allowed only when all of the following hold:

1. the raw PA contains exactly one pitcher identity;
2. exact `gamePk + atBatNumber + pitchNumber` resolves in MLB Official;
3. MLB Official matchup pitcher MLBAM equals the raw pitcher MLBAM;
4. the official normalized pitch maps to the type required by the raw
   description family;
5. raw and official release speeds are both finite and match within 0.051 mph;
6. when a raw terminal event exists, the MLB Official play result event matches.

Every repair records the raw and official descriptions/types, terminal event,
release speed, MLB Official feed SHA-256 and play digest.

Repaired dependencies are explicitly versioned:

`PICK2_MLB_STATCAST_CLASSIFIED_V/2025_V1+MLB_STATSAPI_GUMBO_TYPE_REPAIR/1.1`

## Focused proof

Previously blocked target:

`gamePk 776410 / pitcher 676979`

Historical source pitch:

- source game: `777605`
- PA: `49`
- pitch: `6`
- raw: `hit_into_play`, type `S`, event `catcher_interf`, speed `95.5`
- MLB Official: `In play, no out` -> `hit_into_play_no_out`, type `X`,
  event `catcher_interf`, same pitcher `676979`, speed `95.5`

After the source repair, the target is **ELIGIBLE** with deterministic replay.

Control target `776184 / 607074` remains **BLOCKED / INCOMPLETE_PA** because
its historical opponent census contains mid-PA pitching changes. That
demonstrates the repair does not relax the single-pitcher-per-PA contract rule.

## Same 72-row audit

Baseline corrected audit: **18 / 72 = 25.00%**.

With official type repair: **20 / 72 = 27.78%**.

No previously eligible row was lost.

New rows:

- `777692 / 693821` — June
- `776410 / 676979` — September

Monthly result:

| Month | Rows | Eligible |
|---|---:|---:|
| Apr | 12 | 8 |
| May | 12 | 5 |
| Jun | 12 | 2 |
| Jul | 12 | 1 |
| Aug | 12 | 3 |
| Sep | 12 | 1 |

## Non-repairable evidence retained fail-closed

- `MISSING_VELOCITY`: inspected MLB Official feeds also have null startSpeed;
- mid-PA pitching changes: multiple pitcher IDs in one PA remain
  `INCOMPLETE_PA`;
- unfinished PA without the frozen runner-third-out witness remains blocked.

## Gate

`PE_PITCHER_K_V2_TRAINING_AUTHORIZED = NO`

The repair improves source fidelity and adds two real rows, but the historical
corpus remains too small and temporally uneven for model training.

## Safety

- Official Picks unchanged
- APOSTAR inactive
- no production promotion
- no sportsbook calls
- no historical Odds API credits
- no V1-as-V2 relabeling
- frozen contract unchanged
- frozen builder unchanged
