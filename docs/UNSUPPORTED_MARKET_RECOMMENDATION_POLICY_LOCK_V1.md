# Unsupported-Market And Recommendation-Policy Lock V1

Date: 2026-07-30

Status: PASS

Phase 4 certifies that unsupported markets and non-MLB sports are not presented as available production recommendations in V1.

## Evidence

- The central recommendation policy supports only `moneyline`, `spread`, `run_line` and `total`.
- The central policy emits `UNSUPPORTED_MARKET` for markets outside that allowlist.
- Official recommendation statuses remain limited to `QUALIFIED`, `BEST_BET_CANDIDATE` and `PLAY_OF_DAY_CANDIDATE`.
- Top Picks uses the central policy, requires production-eligible rows and filters official rows through `isOfficialRecommendationStatus`.
- Universal Market Intelligence keeps Team Totals, First Five, NRFI/YRFI, alternate lines, pitcher props and batter props out of official-pick eligibility.
- Probability Picks, Most Likely, AI Bet Finder and Dashboard copy continue to separate projection-only intelligence from Official Picks.
- `docs/PICK_ANALYZER_V1_SCOPE.json` keeps non-MLB production recommendations and unsupported markets out of V1 scope.

## Result

Unsupported markets do not appear as available recommendations. Projection-only copy is consistent, Official Pick policy boundaries are visible, and non-MLB production recommendation claims remain blocked.

No provider calls, data mutations, business-rule changes, prediction changes, settlement changes, learning changes, model training, model-weight mutation, probability change, confidence change, Trust change, Official Pick threshold change, epoch activation, local server smoke or manual Vercel deployment was performed.

The next approved incomplete V1 phase is Phase 5, Final validation bundle.
