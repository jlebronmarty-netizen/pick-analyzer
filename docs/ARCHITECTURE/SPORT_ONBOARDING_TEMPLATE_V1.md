# Sport Onboarding Template V1

Status: `SPORT_ONBOARDING_TEMPLATE_READY`

This template captures the evidence gates required before any new sport can leave preview/shadow mode.

## Required Gates

| Gate | Requirement |
| --- | --- |
| Provider authority | Identify odds, schedule/status, results and stat providers separately. |
| Entity identity | Canonical team/player/event IDs must be mapped with collision checks. |
| Current odds | Exact event/market/selection/line prices must be fresh and timestamped. |
| Schedule/status | Pregame, live, final, postponed and cancelled states must be normalized. |
| Results | Final score/stat identity must map to the same canonical event used by predictions. |
| Prediction scope | Supported markets must be explicitly enumerated; unsupported markets fail closed. |
| Settlement | Market-specific settlement rules must be deterministic and push/void aware. |
| Learning | Learning labels must be deduplicated and separated from recommendation exposure. |
| Performance | Default production scope must exclude replay, legacy and preview rows. |
| Calibration | Calibration starts shadow-only and requires out-of-sample validation. |
| Scheduler | Natural protected scheduler operation must be proven without duplicate writers. |
| Provider budget | Provider calls must have explicit ledgers and no hidden fallback spend. |
| Product safety | Stale, unsupported or missing evidence must never become actionable. |
| Rollback | Provider and model rollback must be config-only or explicitly documented. |

## Recommended Sequence

1. Provider inventory and cost model.
2. Event and team identity mapping.
3. Stored current odds shadow capture.
4. Results and settlement identity.
5. Supported-market prediction coverage.
6. Read-only product surfacing.
7. Current Era activation.
8. Historical replay, when legitimate historical data exists.
9. Shadow calibration.
10. Pilot-week natural scheduler proof.
11. Promotion review.

## Current Next-Sport Ranking

| Rank | Sport | Recommendation |
| ---: | --- | --- |
| 1 | NBA | Best next candidate after MLB closeout because existing NBA readiness and player-stat services already exist. |
| 2 | NFL | Strong user value, but lower daily cadence and seasonality make pilot evidence slower. |
| 3 | NHL | Viable after odds/results mapping, but market depth and model maturity are lower. |
| 4 | Soccer | Requires competition-by-competition identity and settlement design. |
| 5 | BSN | Useful niche follow-up, but provider/source durability needs more work. |

No new sport is started by this template.
