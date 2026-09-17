# PA-13 Pitcher Earned Runs Forward Pricing Capture V1

Status: **RESEARCH-ONLY / SHADOW-ONLY**

Contract: `PA13_PITCHER_ER_FORWARD_CAPTURE/1.0.0`

## Purpose

Persist real pregame `pitcher_earned_runs` prices going forward so PA-13 can accumulate price-aware evidence without inventing historical pricing and without spending historical The Odds API credits.

This capture does **not** authorize a Pitcher ER model for production, does not create Official Picks, does not activate APOSTAR, and does not certify ROI, CLV, EV, or any historical pricing metric.

## Provider discovery already certified

The bounded current-market probe on 2026-09-17 established that The Odds API currently exposes:

- sport: `baseball_mlb`
- market: `pitcher_earned_runs`
- real bookmaker prices and lines
- provider market timestamps
- player descriptions usable for identity matching

Canonical evidence:
- `docs/CERTIFICATION/PA13_PITCHER_ER_CURRENT_PRICING_PROBE_20260917.json`
- `docs/CERTIFICATION/PA13_PITCHER_ER_CURRENT_PRICING_PROBE_20260917.md`

Historical pricing remains **ABSENT / NOT CERTIFIED**.

## Integration

The forward capture reuses the existing MLB daily scheduler and existing canonical storage:

- scheduler: `/api/cron/mlb-statcast-daily`
- lifecycle events: `sport_events`
- odds evidence: `sports_odds_snapshots`
- job ledger: `sports_sync_jobs`

No parallel database schema or scheduler is introduced.

Job type:

`pa13_pitcher_er_forward_capture_v1`

Stored market:

`pitcher_earned_runs`

## Timing and fail-closed rules

The capture is current-date only and evaluates during the existing 10 AM Puerto Rico scheduler window.

For a quote to persist:

1. the lifecycle event must still be pregame;
2. the provider event must match canonical home/away identity and start time;
3. MLB must expose a probable starter;
4. the provider player name must resolve exactly, after bounded text normalization, to one of the MLB probable starters;
5. the provider quote timestamp must be strictly before the canonical event start;
6. selection must be `over` or `under`;
7. line and American price must be finite;
8. provider lineage must be retained.

Unmatched players are rejected. The capture never guesses a MLBAM identity.

## Stored lineage

Each accepted odds row preserves at least:

- canonical event id
- `canonicalGamePk`
- `pitcherMlbamId`
- MLB probable-pitcher name
- provider player name
- sportsbook
- selection
- line
- American price
- provider event id
- provider market key
- target start
- provider timestamp
- acquisition timestamp

## Credit boundary

- historical endpoint calls: **0**
- historical credits spent by this capture: **0**
- forward event-specific calls only
- daily call cap: **16**
- protected The Odds API reserve: **2000**
- if credit headers are unavailable, capture stops fail-closed
- already-attempted provider events are not re-queried later the same day

## Evidence semantics

Rows are explicitly marked:

- `researchOnly = true`
- `shadowOnly = true`
- `productionEligible = false`
- `officialPicksEligible = false`
- `apostarEnabled = false`
- `historicalPricingCertified = false`
- `roiCertified = false`
- `clvCertified = false`
- `evCertified = false`

The one-shot Sep 17 discovery probe made zero Supabase writes. It is discovery evidence only and is not retroactively promoted into the forward pricing corpus.

The first forward corpus observation may only count after this capture runs prospectively on its normal scheduler and persists a valid pregame quote.

## Validation

Preview deployment for scheduler wiring commit `022c2896303c2abeba7c21e7f1cfad9b1d23cd7a`:

- Vercel deployment: `dpl_7se4jRTpAKFaAYwKFAsGrQSqcF6e`
- production build: compiled successfully
- TypeScript validation: passed
- deployment state: `READY`

No provider call was executed by this validation and no forward pricing row was synthesized.

## Next gate

Accumulate genuine forward observations. Only after exact outcome joins and sufficient untouched evidence exist may a separate research step analyze price-aware diagnostics.

Historical ROI/CLV/EV remain unavailable unless independently recovered from real historical quotes under a separately certified provenance path.
