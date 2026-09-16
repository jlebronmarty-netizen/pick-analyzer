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

## Pricing limitation

Historical alternate HOME +1.5 prices are not certified. Accuracy evidence alone does not certify EV or ROI.

The current core Odds API acquisition requests `h2h`, `spreads`, and `totals`. The alternate `HOME +1.5` price must therefore be captured separately from the event-level alternate spread market after a game passes the frozen candidate filter.

## Forward-test rule

Do not change this formula, threshold, component set, or market condition after freeze.

A valid forward observation requires:

1. A pregame standard Run Line observation establishing `HOME -1.5`.
2. PREGAME values for `team_strength`, `starter`, and `history` available before first pitch.
3. Frozen score >= 2.065112.
4. A real pregame `HOME +1.5` alternate quote from a sportsbook, captured with timestamp and price.
5. Outcome read only after the game is final.

If the alternate quote is unavailable, the game is not a priced forward selection and must not be used for EV/ROI certification.

## Guardrails

- Official Picks: unchanged.
- APOSTAR: disabled.
- Production eligibility: false.
- V1 Run Line candidates remain immutable and failed on their sealed 2026 external test.
- No retuning against future forward outcomes.
