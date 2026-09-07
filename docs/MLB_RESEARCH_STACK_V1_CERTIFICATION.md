# MLB Research Stack V1 Certification

Certified on 2026-09-07 against production Supabase and Vercel runtime.

## Governance boundary

This certificate records research/shadow validation state only. It does not activate betting markets, create Official Picks, call sportsbook providers at request time, or promote any model to Champion.

## Market status

| Market | Version | Status | Key evidence | Runtime |
|---|---|---|---|---|
| Pitcher Strikeouts | `MLB_PITCHER_K_V1` | `candidate / shadow / validated` | TEST 2025 MAE 1.8495 / RMSE 2.3464; OOS 2026 MAE 1.7793 / RMSE 2.2303; probability-certified lines 2.5–5.5 K | Production HTTP 200; fail-closed outside certified lines |
| Pitcher Walks (BB) | `MLB_PITCHER_BB_V1` | `candidate / shadow / validated` | Canonical BB excludes HBP; legacy `target_walks` reconciles as BB+HBP 4,473/4,473; TEST 2025 Brier skill +2.57%; OOS 2026 +2.83%; certified lines 0.5–3.5 BB | Production HTTP 200; valid 1.5 line returns probability; 4.5 returns `LINE_NOT_CERTIFIED` |
| Pitcher Outs | `MLB_PITCHER_OUTS_RESEARCH_V1` | Research only | TEST 2025 MAE 2.9444 / RMSE 3.9295; 2026 research replay MAE 2.7714 / RMSE 3.6219 | Production HTTP 200; 2026 SportsDataIO labels remain quarantined / production-ineligible |
| Batter Hits | `MLB_BATTER_HITS_RESEARCH_V1` | Research only | TEST 2025 MAE 0.6726 / RMSE 0.8439; OOS 2026 MAE 0.6869 / RMSE 0.8601; probability skill positive but too small for promotion | Production HTTP 200 |
| Batter Total Bases | `MLB_BATTER_TOTAL_BASES_RESEARCH_V1` | Research only | TEST 2025 MAE 1.3041 / RMSE 1.6953; OOS 2026 MAE 1.3082 / RMSE 1.7183; positive but modest Brier skill | Production HTTP 200 |
| NRFI / YRFI | `MLB_NRFI_RESEARCH_V1` | `RESEARCH_ONLY_NOT_READY_FOR_SHADOW` | TRAIN 1,215 / VALIDATION 348 / TEST 314 / OOS 2026 1,626; 0 leakage; TEST 2025 Brier skill -0.2457%; OOS 2026 +0.2221% | Production HTTP 200; `shadowEligible=false`; blocker `FIXED_2025_TEST_BRIER_SKILL_NOT_POSITIVE` |

## NRFI V1 certification detail

NRFI V1 is merged and runtime-valid, but shadow promotion is intentionally blocked. The current gate requires positive Brier skill versus the frozen 2025 TRAIN event-rate baseline on both untouched 2025 TEST and external 2026 HOLDOUT. The fixed 2025 TEST fails that requirement.

Additional leakage-safe model classes were evaluated after V1 without changing the sealed decision:

- separate top/bottom half-inning modeling;
- recent league-regime priors (14/30/45/60 days);
- TRAIN-derived quartile models for starter/team/Statcast features;
- walk-forward bias correction;
- confidence thresholds and directional NRFI/YRFI subsets;
- minimum starter-history gates;
- home/away-specific first-inning and home-park priors.

None produced a TRAIN/VALIDATION-selected candidate that subsequently had positive Brier skill on both fixed TEST 2025 and external OOS 2026. Therefore no NRFI shadow model is registered.

## Quarantined / excluded NRFI inputs

- `pick2_mlb_first_inning_daily_features.team_first_inning_scoring_rate` remains quarantined because audit showed the stored value represents average first-inning pitches seen rather than scoring rate.
- 2026 starter first-inning K/BB JSON values are zero-filled and are not portable from 2025, so they are excluded.
- historical lineup proxies are derived from observed target-game batter sets and are not treated as certified pregame batting order.
- `park_context` currently contains no usable park/weather value.

## Certified source integrity

- Statcast 2025: 712,528 pitches / 2,430 games / 30 teams.
- Statcast 2026 through 2026-09-05: 631,404 pitches / 2,139 games / 30 teams.
- Natural pitch identity: `game_pk + at_bat_number + pitch_number`.
- No duplicate pitch identities in the certified source.

## Safety state

All markets in this certificate remain read-only research/shadow surfaces. Request-time sportsbook/provider calls = 0, Official Pick writes = 0, production betting activation = false. K and BB are validated shadow models only; Outs/Hits/Total Bases/NRFI remain research-only until their next explicit gate is passed.
