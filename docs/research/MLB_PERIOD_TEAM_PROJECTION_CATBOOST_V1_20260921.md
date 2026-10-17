# MLB F5 Margin + Team Runs CatBoost Projection V1 — 2026-09-21

State: `RESEARCH_ONLY / PROJECTION_ONLY / CLOSED`

## Purpose

Test whether a materially different nonlinear architecture could improve the projection layer for:

1. First 5 Innings margin, as a prerequisite for future F5 Spread work.
2. Team runs, as a prerequisite for future Team Totals work.

No sportsbook line entered training or model selection. No cover/over/under accuracy was calculated. Therefore this is **not** a market certification.

## Governance

- model family: CatBoost regression;
- fixed candidates before execution: depth 4, depth 6, and their ensemble;
- rolling 2025 monthly out-of-fold development;
- champion selected only by 2025 OOF MAE;
- 2026 opened only after champion selection;
- 2026 class: `HISTORICAL_2026_SEEN_DIAGNOSTIC_NOT_PRISTINE_HOLDOUT`;
- provider calls: **0**;
- Odds API historical credits: **0**;
- Official Picks writes: **0**;
- APOSTAR activation: **false**;
- production promotion: **none**.

The temporary GitHub-OIDC exporter was closed after the run and its temporary database SELECT grant was revoked.

## F5 margin

Champion selected on 2025 OOF MAE:

`depth6`

### 2025 rolling OOF

- n: **1,968**
- MAE: **2.6566 F5 runs of margin**
- RMSE: **3.4680**
- residual bias: **+0.5388**
- residual SD: **3.4259**

Monthly MAE:

- May: **2.4514**
- June: **2.5538**
- July: **3.0023**
- August: **2.7290**
- September: **2.5684**

### 2026 diagnostic

- n: **2,255**
- non-push n for directional read: **1,908**
- MAE: **2.5770**
- RMSE: **3.3661**
- residual bias: **-0.1048**
- directional sign accuracy on non-pushes: **52.10%**

Monthly MAE ranged from **2.3437** in August to **2.7142** in May.

### F5 disposition

The nonlinear CatBoost architecture did **not** improve the projection layer enough to justify deeper real-line acquisition or threshold search.

It is worse than the already-tested transparent F5 margin baselines on 2025 MAE and remains near coin-flip on 2026 non-push margin direction.

State:

`F5_SPREAD_PROJECTION_ARCHITECTURE_FAILED_NO_THRESHOLD_SEARCH`

Future F5 Spread work requires a materially different modeling surface, not another threshold sweep over this regression family.

## Team Runs

Champion selected on 2025 OOF combined home/away MAE:

`ensemble`

### 2025 rolling OOF

Home:
- n: **1,972**
- MAE: **2.5055**
- RMSE: **3.1664**
- residual bias: **+0.3990**

Away:
- n: **1,972**
- MAE: **2.6655**
- RMSE: **3.3847**
- residual bias: **+0.0741**

Combined MAE: **2.5855 runs per team**

### 2026 diagnostic

Home:
- n: **2,309**
- MAE: **2.4782**
- RMSE: **3.2147**
- residual bias: **-0.1858**

Away:
- n: **2,309**
- MAE: **2.5525**
- RMSE: **3.2447**
- residual bias: **-0.0927**

Combined MAE: **2.5153 runs per team**

### Team Totals disposition

The nonlinear model does not materially improve the already-tested simple/transparent Team Runs projection surface.

State:

`TEAM_TOTALS_PROJECTION_ARCHITECTURE_FAILED_NO_THRESHOLD_SEARCH`

Do not buy additional historical team-total lines merely to test this projection family.

## Market-level consequence

Real historical lines are confirmed to exist and have good book depth for both F5 Spread and Team Totals, but the current projection engines are not accurate enough to justify spending the remaining Odds API budget on a large line corpus.

The active constraint for these markets is now **model signal**, not merely line availability.

## Data budget

The latest successful The Odds API period/team-total pilot left **2,255 requests remaining** with a project reserve of **2,000**.

This CatBoost experiment consumed **0** Odds API credits.

No additional historical acquisition is authorized by this result.
