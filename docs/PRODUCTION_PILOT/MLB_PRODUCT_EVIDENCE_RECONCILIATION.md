# MLB Product Evidence and Eligibility Reconciliation

Date: 2026-08-11

Starting commit: `fec381683f832ddffeb9052abec4c5f614edf94c`

Classification: `MLB_PRODUCT_EVIDENCE_RECONCILIATION_REPAIR_READY_FOR_DEPLOYMENT`

## Scope

This repair reconciles homepage, Today service, Current Board, Most Likely and Performance product evidence after the MLB final closeout and The Odds API product-primary transition.

It does not change prediction formulas, confidence, EV, Kelly, rankings, Official Pick policy, settlement, learning, HR-03, odds authority, MLB data-source mode, provider cadence or SportsDataIO rollback availability.

The Odds API remains product odds authority. MLB Official remains primary non-odds MLB source. SportsDataIO remains rollback-only for MLB.

## Production Evidence

Read-only production evidence from `/api/system/version`, `/api/dashboard/today`, `/api/current-board?mode=current&limit=200`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/best-value`, `/api/performance`, `/api/operations/health` and `/api/model/shadow-calibration` showed:

- Production commit: `fec381683f832ddffeb9052abec4c5f614edf94c`
- Provider calls from certification reads: `0`
- Database mutations from certification reads: `0`
- Games Today: `15`
- Dashboard prediction candidates: `39`
- Dashboard informational candidates: `39`
- Official Picks: `0`
- Current Board games: `15`
- Current Board candidates: `39`
- Current Board event coverage: `15`
- Current Board markets: `15` Moneyline, `15` Run Line, `9` Total
- Current Board modeled value count: `2`
- Best Value semantics: `28` candidates with positive EV, `0` candidates passing policy
- Performance denominator: `45 canonical predictions`
- Operations health: `HEALTHY`
- Current Board status: `READY`
- SportsDataIO routine MLB calls today: `0`

## Root Cause

The product contradiction was not caused by event discovery, prediction generation, provider authority, settlement or learning.

The root cause was a Today-service aggregation mismatch:

- Current Board already exposed product-priced The Odds API evidence for current games.
- The Today service still used a legacy odds-coverage diagnostic as the only per-game stored-odds signal.
- For several games, that diagnostic reported zero rows even though Current Board candidates had canonical price evidence.
- That caused `market_prices_not_refreshed`, `Waiting for sportsbook refresh`, and `NO_ODDS_STORED` copy to leak into the homepage.

## Hard Missing Data

Hard missing data means the system cannot safely evaluate or present a market without fabricating evidence.

Current hard gaps:

- No Player Props activation.
- No Future Markets activation.
- Some exact Total lines are not current-board displayable because exact-line binding is enforced.
- Official Pick policy remains blocked for all current candidates.

## Soft Missing Data

Soft missing data means evidence exists, but product copy or denominator labels were too broad.

Soft gaps repaired:

- Product-priced Current Board evidence was not recognized by Today's per-game odds coverage status.
- Homepage Value Candidates used policy-qualified rows instead of evidence-first positive-EV rows.
- Homepage Games Skipped could fall back to policy-qualified candidate gaps instead of analyzed-game coverage.
- Market Quality could repeat stale sportsbook-refresh copy while product market evidence existed.

## Denominator Contract

The visible product surfaces intentionally use different denominators:

- Performance: `45 canonical predictions`
- Current Board: `39 Current Board candidates`
- Most Likely: `39 analyzed current-board rows`
- Best Value evidence: `28 positive-EV rows`
- Official Picks: `0 policy-approved rows`

This is expected only when each surface labels the denominator. It is not acceptable for one surface to summarize 15 games as skipped or waiting for refresh while Current Board has current product-priced evidence for those games.

## Repair

Runtime repair:

- `src/services/dashboard-today.service.ts`
  - Reconciles legacy odds diagnostics with Current Board canonical price evidence.
  - Prevents `gamesWaitingForOdds` from counting a pregame event as waiting when Current Board has canonical product price evidence.
  - Prevents per-game operational status from reporting `NO_ODDS_STORED` solely because the legacy diagnostic is empty.

- `src/components/home/HomeBettingPlan.tsx`
  - Shows Value Candidates from evidence-first positive-EV counts before falling back to local qualified rows.
  - Computes Games Skipped from analyzed-game coverage, not policy-qualified candidate count.
  - Replaces stale sportsbook-refresh copy with `Current market evidence available` when Current Board displayable markets exist.

## Eligibility

No candidate was promoted.

Rows remain `ANALYZED_ONLY` / `NOT_OFFICIALLY_ELIGIBLE` when policy blockers exist. `PRODUCTION_GATE_BLOCKED`, `QUARANTINED_ROW`, low confidence, calibration and threshold blockers remain intact.

## Validation

Validator: `scripts/mlb-product-evidence-eligibility-reconciliation-validate.mjs`

The validator proves:

- Current Board product price evidence is counted by the Today service.
- Legacy diagnostics cannot force `NO_STORED_ODDS` when product price evidence exists.
- Homepage value evidence is separated from Official Pick eligibility.
- Homepage skipped games are based on analyzed-game coverage.
- No provider credentials, hardcoded authority config or prediction-policy edits were introduced.

## Recommendation

Publish the bounded repair, deploy, and read-only certify that `/api/dashboard/today` no longer reports sportsbook refresh missing when Current Board product price evidence exists.
