# MLB Moneyline Opening Consensus V2 — Secondary Score

Status: **RESEARCH-ONLY / FROZEN FOR FORWARD-ONLY VALIDATION**

## Why V2 exists

V1 requires:
- BetMGM + BetRivers opening no-vig consensus favorite probability >=65%;
- 6/6 base fundamentals aligned.

V1 produced 59/78 = 75.64% in 2025 and 30/37 = 81.08% in the already-opened 2026 external set, but failed the permanent external n/stability gates.

A post-hoc diagnostic of V1 selections showed that the **magnitude/context** of the edge matters. Team name itself did not explain the pattern cleanly.

V2 therefore does **not** use team identity.

## Development protocol

Thresholds for the new secondary variables were derived only from the feature distributions of May–July 2025, using Q25 cuts rather than outcome-optimized values.

August–September 2025 was then read as an internal holdout.

Because 2025/2026 have already been inspected during V1 research, neither period is an untouched external certification set for V2. V2 is forward-only after this freeze.

## Secondary score

One point for each condition:

1. bullpen RA9 edge >= **0.935409247675931**
2. common-opponent win% edge >= **0.158617424242424**
3. venue/home-road win% edge >= **0.238452767470625**
4. starter RA9 edge >= **1.55737077764639**

Missing any secondary feature is fail-closed.

V2 eligibility:

`V1 qualifies AND secondary_score >= 2`

Confidence labels:
- 2/4 = STANDARD
- 3/4 = STRONG
- 4/4 = MAX

These labels do not create separate formulas or thresholds.

## 2025 result

V1:
- 59/78 = 75.64%

V2:
- **52/63 = 82.54%**

May–July development:
- 36/44 = **81.82%**

Aug–Sep internal holdout:
- 16/19 = **84.21%**

Monthly:
- May 23/28 = 82.14%
- Jun 8/11 = 72.73%
- Jul 5/5 = 100%
- Aug 7/8 = 87.50%
- Sep 9/11 = 81.82%

Worst month: **72.73%**

## Secondary score gradient

- 0/4: 1/2 = 50.00%
- 1/4: 6/13 = 46.15%
- 2/4: 9/13 = 69.23%
- 3/4: 16/20 = 80.00%
- 4/4: 27/30 = 90.00%

The 15 V1 picks rejected by V2 were only 7/15 = 46.67%.

A one-sided Fisher exact comparison of V2-kept vs V2-rejected rows gives p≈0.00697, but this is **post-hoc internal evidence**, not external validation.

## Known 2026 diagnostic

Using the frozen 2025 cuts on already-known 2026 V1 selections:

- V2-eligible with complete secondary data: 19/21 = **90.48%**
- below V2: 6/10 = 60.00%
- 6 rows had incomplete secondary data and are fail-closed for V2.

This is diagnostic only because 2026 had already been opened before V2 was designed.

## Other variables reviewed

Additional filters did not justify inclusion:

- V2 + offense 2/3: 38/46 = 82.61%; essentially no improvement, much less volume.
- V2 + recent pitching 2/3: 41/51 = 80.39%; worse.
- V2 + recent pitching 3/3: 23/26 = 88.46%; sample too small.
- V2 + offense 3/3: 28/35 = 80.00%.

OPS, hard-hit and barrel signals did not explain V1 wins consistently enough to add.

## Forward rule

From this freeze onward, V2 must be evaluated prospectively only.

No:
- team-name filter;
- 2026 retuning;
- threshold rescue;
- vendor change;
- HOME-only change;
- offense/recent-pitching add-on after seeing future outcomes.

Official Picks and APOSTAR remain untouched.
