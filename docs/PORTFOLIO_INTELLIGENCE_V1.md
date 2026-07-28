# Portfolio Intelligence V1

Status: Preview, read-only.

Portfolio Intelligence V1 adds Combination Intelligence over existing Probability Picks opportunities. It does not create predictions, modify probabilities, alter confidence or quality formulas, change Official Pick policy, size bankroll, calculate Kelly, place wagers or claim statistical correlation.

## Evidence Sources

- Primary opportunity source: `/api/probability-picks`.
- Optional aligned market overlay: Current Board stored market candidates.
- Relationship labels are deterministic shared-exposure classifications.

## Supported Relationship Classes

- `SAME_EVENT`
- `SAME_TEAM`
- `OPPOSING_SIDES`
- `MONEYLINE_RUNLINE_RELATIONSHIP`
- `SIDE_TOTAL_RELATIONSHIP`
- `PLAYER_TEAM_RELATIONSHIP`
- `CROSS_SPORT`
- `INDEPENDENCE_UNKNOWN`
- `INSUFFICIENT_EVIDENCE`

## Guardrails

- Naive joint probability assumes independence and may overstate or understate the true combined probability.
- No dependency-adjusted joint probability is fabricated.
- No correlation coefficients are fabricated.
- Missing aligned market prices produce `N/A` style blockers rather than zero-price substitutes.
- Provider calls: 0.
- Remote mutations: 0.
