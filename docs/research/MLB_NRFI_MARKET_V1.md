# MLB NRFI / YRFI — Unified Market Rule V1

Status: RESEARCH-ONLY / FIRST-PASS FALLBACK

Frozen candidate: `nrfi_p52_fallback_v1`

## Rule

- Existing model: `MLB_NRFI_RESEARCH_V1`
- Selected component candidate: ID 39
- Calibration: a=0, b=0.75
- Direction: NRFI
- Select when calibrated P(NRFI) >= **52%**

## 2025 first-pass evidence

- 190/340 = **55.88%**
- baseline NRFI = **49.51%**
- lift = **+6.37 percentage points**
- worst month = **39.13%**

Monthly: May 47/71=66.20%; Jun 42/76=55.26%; Jul 39/71=54.93%; Aug 44/76=57.89%; Sep 18/46=39.13%.

This does **not** meet the 75% target and is not production/shadow-ready. It is frozen only to document the best defensible first-pass fallback and complete the external comparison without threshold rescue.

State before external rule check: `REVISIT_AFTER_FIRST_PASS_EXTERNAL_PENDING`.

No sportsbook pricing, ROI, EV or CLV claims. Official Picks unchanged. APOSTAR disabled.
