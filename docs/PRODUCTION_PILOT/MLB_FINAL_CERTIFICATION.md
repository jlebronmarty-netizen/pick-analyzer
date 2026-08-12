# MLB Final Certification

Status: `MLB_FINAL_CERTIFIED_WITH_FORWARD_MARKETS`

Commit: `71380918b2b9e5db7e538be2b2077e7f4a5df540`

Observation date: `2026-08-11`

## Verdict

MLB is certified as the current reference sport with full-game core historical replay complete and all unsupported market families kept forward-only or foundation-only.

This certification does not activate new markets, does not promote calibration, does not cancel SportsDataIO and does not start a new sport.

## Historical Replay Completion

| Item | Count |
| --- | ---: |
| Historical events | 2,430 |
| Certified replay predictions | 7,290 |
| Settled replay predictions | 7,290 |
| Pending replay predictions | 0 |
| Duplicate replay rows | 0 |
| Leakage failures | 0 |

Certified replay coverage remains limited to Moneyline home side, Run Line home `-1.5` and Total Over. This is a model-replay certification, not a price-aware replay certification.

## Market Expansion Result

No new historical market was added because the remaining market families lack one or more required pieces of evidence: direct market model support, exact historical sportsbook line/price data, deterministic market-specific settlement labels, or calibration support.

| Market Family | Result |
| --- | --- |
| Moneyline opposite side | Blocked pending certified direct side/complement contract |
| Run Line `+1.5` and away spread | Blocked by replay support and calibration evidence |
| Total Under | Blocked by Over-only replay evidence |
| Team Totals | Foundation only |
| First Five | Foundation only |
| NRFI/YRFI | Forward only |
| Pitcher/Batter Props | Foundation only, provider odds blocked |

## Production Safety

| Check | Result |
| --- | --- |
| Production probabilities changed | `NO` |
| Official Pick policy changed | `NO` |
| Rent Play/Moneyline/Smart Parlay policy changed | `NO` |
| Settlement changed | `NO` |
| Learning changed | `NO` |
| HR-03 promoted | `NO` |
| Current Era contaminated by replay | `NO` |
| SportsDataIO reactivated | `NO` |
| Provider calls from certification reads | `0` |
| Database mutations from certification reads | `0` |

## Current Era

Production `/api/system/version` on the canonical Vercel URL served commit `71380918b2b9e5db7e538be2b2077e7f4a5df540` with `providerCallsMade=0`.

Production `/api/operations/health` reported overall `HEALTHY` during this certification read. SportsDataIO remains rollback-only; The Odds API remains MLB product odds authority; MLB Official remains primary non-odds MLB source.

## Final Classification

`MLB_FINAL_CERTIFIED_WITH_FORWARD_MARKETS`

Next recommended phase:

`MLB-FINAL-02_COMPLETE_HISTORICAL_MARKET_DATA_COLLECTION_OR_NBA_01_PREP`
