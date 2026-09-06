# MLB Moneyline Official Pick Policy Audit

DRY RUN ONLY. NO OFFICIAL PICKS CREATED.

## Verdict

MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_CERTIFIED

## Policy Summary

Policy version: `MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1`

Official Pick eligibility requires pregame-valid persisted value evidence, a fresh complete same-book two-sided moneyline market, acceptable starter state, feature completeness, model probability within the certified inference range, consensus edge >= 0.04, best-price unit EV >= 0.08, at least 8 valid books, acceptable market dispersion and no hard blocker.

Zero Official Picks is an allowed outcome. Positive edge or positive EV alone is not sufficient.

## Threshold Rationale

The selected thresholds are conservative because the active Champion has approximate test AUC 0.551, current probabilities are compressed, and no historical market-price backtest certifies profitability. The current persisted sample has 386 value rows and 42 collapsed game/side candidates.

## Dry-Run Candidate Table

| game_pk | teams | side | model_prob | consensus_prob | consensus_edge | best_book | odds | unit_ev | books | dispersion | freshness | starter | status | blockers |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| 823904 | undefined @ undefined | AWAY | 0.435413 | 0.353478 | 0.081936 | betrivers | 185 | 0.240928 | 11 | 0.020284 | FRESH | PROBABLE | OFFICIAL_PICK_ELIGIBLE_DRY_RUN | NONE |
| 824468 | undefined @ undefined | HOME | 0.480063 | 0.417455 | 0.062608 | lowvig | 134 | 0.123348 | 11 | 0.014743 | FRESH | PROBABLE | OFFICIAL_PICK_ELIGIBLE_DRY_RUN | NONE |
| 824795 | undefined @ undefined | HOME | 0.524487 | 0.465165 | 0.059321 | betrivers | 118 | 0.143381 | 11 | 0.028056 | FRESH | PROBABLE | OFFICIAL_PICK_ELIGIBLE_DRY_RUN | NONE |
| 824310 | undefined @ undefined | HOME | 0.517545 | 0.467290 | 0.050256 | williamhill_us | 110 | 0.086845 | 11 | 0.013266 | FRESH | PROBABLE | OFFICIAL_PICK_ELIGIBLE_DRY_RUN | NONE |
| 823335 | undefined @ undefined | AWAY | 0.418117 | 0.374435 | 0.043682 | betonlineag | 163 | 0.099649 | 11 | 0.009300 | FRESH | PROBABLE | OFFICIAL_PICK_ELIGIBLE_DRY_RUN | NONE |
| 824309 | undefined @ undefined | HOME | 0.537067 | 0.457256 | 0.079811 | williamhill_us | 115 | 0.154695 | 7 | 0.009073 | FRESH | PROBABLE | VALUE_CANDIDATE_ONLY | NONE |
| 824794 | undefined @ undefined | HOME | 0.518223 | 0.445736 | 0.072487 | williamhill_us | 120 | 0.140091 | 7 | 0.005319 | FRESH | PROBABLE | VALUE_CANDIDATE_ONLY | NONE |
| 823091 | undefined @ undefined | AWAY | 0.432722 | 0.366536 | 0.066186 | fanduel | 180 | 0.211621 | 7 | 0.029027 | FRESH | PROBABLE | VALUE_CANDIDATE_ONLY | NONE |
| 823417 | undefined @ undefined | HOME | 0.560524 | 0.500000 | 0.060524 | williamhill_us | -105 | 0.094356 | 7 | 0.006972 | FRESH | PROBABLE | VALUE_CANDIDATE_ONLY | NONE |
| 824469 | undefined @ undefined | HOME | 0.469129 | 0.408685 | 0.060444 | williamhill_us | 143 | 0.139984 | 7 | 0.008971 | FRESH | PROBABLE | VALUE_CANDIDATE_ONLY | NONE |
| 823336 | undefined @ undefined | AWAY | 0.416455 | 0.364856 | 0.051598 | lowvig | 167 | 0.111934 | 7 | 0.008435 | FRESH | PROBABLE | VALUE_CANDIDATE_ONLY | NONE |
| 824142 | undefined @ undefined | HOME | 0.544586 | 0.500000 | 0.044586 | williamhill_us | -105 | 0.063240 | 7 | 0.004452 | FRESH | PROBABLE | VALUE_CANDIDATE_ONLY | NONE |

## Blocker Table

| blocker | count |
| --- | ---: |
| NONE | 0 |

## Limitations

- This is policy analysis only.
- Current dry-run statuses are not persisted and are not Official Picks.
- No profitability, ROI, CLV or bankroll/staking claim is certified.
- Value Board publication remains a separate future authorization.
