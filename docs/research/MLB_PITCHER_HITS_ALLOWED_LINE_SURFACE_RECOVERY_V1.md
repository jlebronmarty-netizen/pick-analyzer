# MLB Pitcher Hits Allowed — Line-Surface Recovery V1

Status: **RESEARCH ONLY / EXACT SOURCE RECOVERY BLOCKED**

Contract: `MLB_PITCHER_HITS_ALLOWED_LINE_SURFACE_RECOVERY_V1/1.0.0`

## Certified runtime reference

PR #111 certified the existing exact-line runtime without retuning:

- candidate: `pitcher_hits_allowed_under_6p5_proj_5p0_v1`
- line: **U6.5**
- qualify when projected hits allowed <= **5.0**
- raw feature: average BF over the last 5 strict-prior starts multiplied by cumulative prior hits/BF
- minimum prior starts: **5**
- same-date earlier start excluded from later same-date history
- frozen 2025 refit: **n=3,099**
- intercept: **2.97876810879942**
- slope: **0.415326852941172**
- frozen 2025 control: **634/761 = 83.31%**

That runtime certification remains valid and is not revoked.

## Why line-surface expansion is still blocked

Line-surface research requires the exact frozen row-level corpus, not only the fitted coefficients.
That rowset was not persisted.

Two independent recovery attempts fail exact parity:

### Historical Retrosheet foundation

The preserved historical starter table contains exactly:

- **4,860** starter rows
- **4,860** with hits present
- **368** pitchers
- hits range **0–13**
- average hits **4.900**

Applying the frozen feature contract yields:

- refit n = **3,404**
- intercept = **2.91867490130191**
- slope = **0.429984398499566**

This is the already-known Retrosheet approximation and is not the certified corpus.

### Current MLB Official StatsAPI

Using the current 2025 MLB player directory and pitching gameLog source yields:

- directory rows: **1,470**
- primary-position pitcher IDs: **802**
- raw start rows: **4,846**
- all eligible targets: **3,395**
- refit intercept: **2.891752760430316**
- refit slope: **0.43502479113585496**

Restricting modeled targets to May–Sep still gives:

- n = **3,277**
- intercept = **2.7708662384249063**
- slope = **0.4571206857870661**

Neither reproduces the frozen **3,099 / 2.97876810879942 / 0.415326852941172** contract.

## Current relevance

Persisted 2026-09-22 sportsbook snapshots contain exact Pitcher Hits Allowed lines:

**3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5**

No new provider call was made to audit those lines.

## Decision

State:

`LINE_SURFACE_BLOCKED_EXACT_FROZEN_ROWSET_NOT_PERSISTED_CURRENT_SOURCE_DRIFT`

No alternate-line threshold search is authorized on either approximation.

The existing certified U6.5 <=5.0 runtime remains unchanged. Continuing line-surface research
requires recovery of the exact frozen 2025 MLB Official rowset/universe, or a genuinely new
prospective architecture/data source under a new contract.

## Boundaries

- Official Picks unchanged
- APOSTAR disabled
- no production promotion
- zero historical Odds API credits
- tracker unchanged
- certified runtime not retuned
