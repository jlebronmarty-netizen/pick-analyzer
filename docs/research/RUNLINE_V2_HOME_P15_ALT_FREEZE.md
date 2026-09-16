# MLB Run Line V2 — HOME +1.5 Alternate Freeze

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate ID: `rl_v2_home_p15_alt_favorite_tsh_q92_v1`

## Scope

This candidate targets the alternate market `HOME +1.5` only when the standard pregame Run Line market has the home team at `-1.5`.

It is not an Official Pick and it is not eligible for APOSTAR or production promotion.

## Frozen rule

- Primary market condition: `home_line = -1.5`
- Target label: `home_p15_cover`
- Feature branch: `PREGAME`
- Feature orientation: `HOME`
- Feature normalization: 2025-frozen cross-year components
- Score: `(team_strength + starter + history) / sqrt(3)`
- Score threshold: `2.065112`
- Threshold origin: 92nd percentile of the 2025 primary-home-favorite score distribution

No postgame/FULL components are permitted.

## Development evidence known at freeze

- 2025: 92 / 107 correct = 85.98%
- 2026 through 2026-09-10: 49 / 62 correct = 79.03%
- Minimum complete 30-selection temporal block observed during development: 76.67%
- 2025 HOME-favorite +1.5 baseline: 68.60%
- 2026 opening-proxy HOME-favorite +1.5 baseline: 68.42%

The candidate was frozen in Supabase at 2026-09-16 21:00:43.769939+00.

## Orientation verification

The frozen evidence is based on HOME-oriented PREGAME components from `mlb_ml_xyear_game_components_z_v1`. Reusing the older dog-oriented Run Line matrix would change the candidate and is forbidden.

## Pricing limitation

Historical alternate HOME +1.5 prices are not certified. Accuracy evidence alone does not certify EV or ROI.

The research branch extends the existing daily Odds API path by requesting event-level `alternate_spreads` only after the standard paired-modal Run Line establishes `HOME -1.5`. The alternate quote is stored as `run_line_alt` research evidence with sportsbook, line, price, pregame timestamp, and provider-event lineage.

## Prospective forward protocol

Prospective evidence begins on `2026-09-17`. Games before that date remain development evidence only.

A valid priced forward observation requires:

1. A pregame standard Run Line observation establishing `HOME -1.5`.
2. PREGAME HOME-oriented `team_strength`, `starter`, and `history`, normalized with the frozen 2025 cross-year statistics.
3. Frozen score >= `2.065112`.
4. A real pregame `HOME +1.5` alternate quote from a sportsbook, captured with timestamp and price.
5. Score and selection frozen before first pitch.
6. Outcome read only after the game is final.

If the alternate quote is unavailable, the game is not a priced forward selection and must not be used for EV/ROI certification.

## Implementation state

Research branch: `research/runline-v2-prospective-shadow`.

The branch now contains:

- `src/services/mlb-runline-home-p15-alt-shadow.service.ts` — selective real alternate-price capture.
- `src/services/mlb-runline-home-p15-alt-forward-freeze.service.ts` — pre-first-pitch HOME-oriented score freeze.
- Existing `/api/cron/mlb-statcast-daily` integration — research failures are non-blocking to certified Statcast/Moneyline work.

No separate scheduler or provider infrastructure was created.

## Guardrails

- Official Picks: unchanged.
- APOSTAR: disabled.
- Production eligibility: false.
- V1 Run Line candidates remain immutable and failed on their sealed 2026 external test.
- No retuning against future forward outcomes.
- ROI/EV remain uncertified until real alternate prices and prospective results accumulate.
