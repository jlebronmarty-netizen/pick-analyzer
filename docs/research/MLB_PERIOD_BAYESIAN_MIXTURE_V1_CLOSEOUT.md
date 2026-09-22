# Sequential Bayesian expert mixture V1 closeout

Freeze commit **07728a35**, before real-data evaluation. Research-only, no lineup features, provider calls, odds credits, external evaluation or production promotion.

The new mechanism learns sequential weights over three unchanged probability experts: Poisson, QDA and empirical convolution. Start equal each season/period; after all predictions on a date, accumulate each expert's log likelihood for that day's observed classes, floored at1e-12 solely for numeric stability. Predict the following dates by the normalized probability mixture. No expert parameters are modified, no subsets/learning rates/thresholds searched. Correlated experts and already-seen historical development limit interpretation.

Only the exact game/date intersection of all experts is eligible. Source hashes are equal across experts. Same-day outcomes cannot affect any same-day or earlier weight or probability; history resets each season. Fixed confidence0.75 and gates75% accuracy/60 decisions/5 selected months/worst-month65% remain unchanged.

| ML market | Eligible | Selected | Wins | Losses | Pushes | Accuracy excluding pushes | Coverage |
|---|---:|---:|---:|---:|---:|---:|---:|
|F1|3,452|8|1|3|4|25.00%|0.2317%|
|F3|3,451|9|1|5|3|16.67%|0.2608%|
|F5|3,450|4|2|1|1|66.67%|0.1159%|
|F7|3,445|2|1|1|0|50.00%|0.0581%|

All3-way markets select0 (accuracy undefined). ML selected decision months2/3/1/1 respectively; worst-month accuracy0/0/66.67/50%. **All8 gates FAIL. Close without rescue.** No external opened. Full weights, probabilities and decisions preserved in compressed artifact; summary includes source/artifact hashes. Reproduction replays these frozen input predictions locally without Supabase or providers.

Tests verify independent Bayes update, date batching, label-mutation chronology, season reset, duplicate/date/truth guards, full artifact replay and independent settlement/coverage arithmetic. No ROI, EV, CLV or calibration claim.
