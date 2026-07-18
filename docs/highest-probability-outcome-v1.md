# Highest-Probability Outcome V1

Status: implemented over stored Current Board candidates.

Purpose:
- Show the highest modeled-probability supported outcome when official picks are zero.
- Keep probability-focused output separate from Official Recommendations and Best Value.
- Explain why a likely outcome may still be negative EV, low confidence, insufficiently calibrated or blocked by policy.

Implemented surfaces:
- Existing `/api/market-opportunities/most-likely` now returns:
  - `topPick`
  - `highestProbabilitySupportedOutcome`
  - `mostLikelyMoneyline`
  - `mostLikelyMoneylineParlay`
  - `probabilityEducation`
- `/most-likely` page displays those sections before the ranked candidate list.
- MLB AI Coach answers most-likely outcome, most-likely moneyline and two-leg moneyline parlay questions from the same canonical scanner.

Rules:
- Official picks are never forced.
- High probability is not displayed as a recommendation unless policy says it is official eligible.
- Negative EV is not hidden.
- Unsupported markets remain unavailable.
- Started, completed, stale, invalid, live and alternate market rows are filtered by Current Board before ranking.

Informational parlay method:
- Candidate pool is current pregame moneyline rows only.
- Legs must be from distinct events.
- Raw joint probability is the product of leg model probabilities.
- Adjusted joint probability applies an 8% conservative haircut because no correlation model exists.
- The response labels this as an independence estimate and informational only.

Provider usage:
- Provider calls made by this module: 0.
- Source: stored Current Board candidates and stored odds/prediction rows.

Policy:
- Recommendation thresholds unchanged.
- Settlement, replay, calibration and official history unchanged.
