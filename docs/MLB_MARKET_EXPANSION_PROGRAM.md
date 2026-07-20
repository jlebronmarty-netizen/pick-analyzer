# MLB Market Expansion Program

Status: Official implementation roadmap.

This program converts the Production Readiness Audit and MLB Market Expansion Roadmap into the next engineering sequence. It does not implement a new market, activate betting, change prediction formulas, change official thresholds, mutate Current Board behavior, alter champion/V7 status, change settlement policy, change learning policy or acquire provider data.

## Source Contracts

- `/api/production-readiness/audit`
- `/api/mlb/odds/coverage?date=2026-07-19`
- `/api/mlb/markets/expansion-roadmap?includeValidation=true`
- `src/services/mlb-market-expansion-roadmap.service.ts`
- `src/services/mlb-market-capability-registry.service.ts`
- `src/config/sportsdataio-endpoint-catalog.ts`

Provider calls added by this program: `0`.

## Current Verified State

Production-supported MLB markets:
- Moneyline
- Run Line
- Full Game Total

Latest roadmap validation:
- Games: 16
- Stored odds rows: 94
- Prediction rows: 47
- Official Picks: 0
- Core full-game coverage: 100%
- Audited compact market coverage: 37.5%
- Broader requested taxonomy coverage: 16.7%

Current Board candidates are live and can change as games age through freshness and timing gates. The program should treat the prompt's 41 candidates as a prior observation, not a fixed invariant.

## Market Readiness Matrix

The official readiness score uses these weights:

| Component | Weight |
| --- | ---: |
| Current Provider Support | 14% |
| Historical Availability | 12% |
| Feature Availability | 12% |
| Prediction Complexity | 10% |
| Settlement Complexity | 12% |
| Data Completeness | 12% |
| Calibration Difficulty | 8% |
| User Value | 8% |
| Estimated Opportunity Increase | 6% |
| Engineering Complexity | 6% |

Higher scores mean safer implementation readiness. Complexity components are scored as readiness, so simpler engineering and settlement receive higher scores.

Top expansion candidates:

| Rank | Market | Wave | Readiness | Notes |
| ---: | --- | ---: | ---: | --- |
| 1 | Team Total | 1 | Highest non-production readiness | Closest extension of full-game totals with deterministic team-score settlement |
| 2 | Alternate Run Line | 2 | Moderate | Requires alternate-line prices and distribution/ladder handling |
| 3 | Alternate Total | 2 | Moderate | Requires alternate-total prices and distribution calibration |
| 4 | First Five Moneyline | 2 | Lower | Needs first-five odds, inning scores and starter-change rules |
| 5 | Pitcher Strikeouts | 3 | Lower | High user value but needs verified prop odds and player-stat settlement |
| 6 | Pitcher Outs Recorded | 3 | Lower | Similar to strikeouts, with pitch-count and hook-tendency requirements |

Markets such as batter props, NRFI/YRFI, same-game combinations and alternate player lines remain Wave 4 because they have high volatility, late-news sensitivity, settlement ambiguity, provider uncertainty or correlation risk.

## Implementation Waves

### Wave 1: Team Totals V1

Market:
- Team Total

Why:
- Closest safe expansion from existing full-game moneyline, run line and total architecture.
- Uses team-level features already partially present in the platform.
- Settles from final team score, which is simpler than player-stat, first-inning or same-game settlement.
- Adds meaningful daily opportunity volume without depending on confirmed batter lineups for every player.

Prerequisites:
- Verified team-total odds from SportsDataIO, a commercial upgrade, CSV import or another approved source.
- Team-total line and price normalization.
- Historical team-total line snapshots.
- Team-score settlement adapter.
- Team-total feature builder.
- Shadow-only prediction persistence.
- Separate calibration buckets from game totals.

Estimated opportunity impact:
- Current: about 47 prediction opportunities/day on the verified slate.
- After Wave 1: about 77-95 shadow-evaluable opportunities/day once team-total odds and gates exist.

Risk:
- Medium.

Engineering complexity:
- Medium.

### Wave 2: First Five and Alternate Full-Game Lines

Markets:
- First Five Moneyline
- First Five Run Line
- First Five Total
- First Five Team Total
- Alternate Run Line
- Alternate Total

Why:
- High user value and starter-driven explainability.
- Adds meaningful derivatives after Wave 1 proves the expansion pattern.

Blockers:
- First-five odds are not verified in production.
- First-five score/result history is missing.
- Starter-change and opener rules must be deterministic.
- Alternate lines need line-ladder storage and distribution calibration.

Estimated opportunity impact:
- After Wave 2: about 120-170 shadow-evaluable opportunities/day, depending on provider availability and line breadth.

Risk:
- High.

Engineering complexity:
- High.

### Wave 3: Pitcher Props

Markets:
- Pitcher Strikeouts
- Pitcher Outs Recorded
- Later: Hits Allowed, Earned Runs, Walks, Pitch Count, Win Decision, Quality Start

Why:
- High user value and stronger explainability than batter props.
- Starting pitcher identity is easier to ground than full batting order availability.

Blockers:
- Verified pitcher-prop odds are not stored.
- Player-stat settlement is not implemented.
- Pitch count, rest, hook tendency and opponent strikeout profiles need historical depth.
- Sportsbook rule differences must be documented.

Estimated opportunity impact:
- After Wave 3: about 180-350 shadow-evaluable opportunities/day, depending on prop coverage and starter availability.

Risk:
- Very High.

Engineering complexity:
- Very High.

### Wave 4: Batter Props, First Inning, Game Props and Same Game/Combined Markets

Markets:
- Batter Hits
- Batter Total Bases
- Batter Home Runs
- Batter Walks/Strikeouts
- NRFI/YRFI
- First Inning Run Line/Total
- Team/Game Props
- Same Game combinations
- Alternate player/pitcher lines

Why later:
- These can create the largest raw opportunity universe, but carry the highest risk.
- They depend heavily on confirmed lineups, player participation rules, late scratches, stat corrections, book-specific settlement and correlation controls.

Estimated opportunity impact:
- After Wave 4: about 400-1,200+ theoretical opportunities/day before gates.
- The modeled/eligible subset must be much smaller until data, settlement and calibration mature.

Risk:
- Very High.

Engineering complexity:
- Very High.

## Recommended First Implementation

Recommendation: **Team Totals V1**.

Expected product value:
- High. It gives users another understandable MLB market family while preserving the product's full-game intelligence story.

Expected engineering cost:
- Medium. It reuses the existing Provider SDK, odds normalization, Feature Store, Prediction SDK, Historical Builder, Settlement, Replay, Calibration, AI Brain, AI Performance Center, Current Board and Adaptive Refresh architecture.

Expected opportunity growth:
- About 30-32 additional shadow candidates on a 16-game slate after verified team-total odds and all gates exist.
- This is not a guarantee of Official Picks.

Required data:
- Team-total line and price.
- Team final score.
- Team offense profile.
- Opposing starter context.
- Bullpen context where available.
- Park/weather context.
- Lineup availability as a confidence/data-quality input, not a fabricated confirmed absence.

Required provider:
- Verified team-total sportsbook odds from current provider entitlement, commercial upgrade, approved CSV/manual import or another approved provider.

Required historical data:
- Minimum 300+ settled team-total rows before meaningful shadow calibration.
- Larger sample before Official Eligible review.

Required settlement:
- Final team runs compared with team-total line.
- Push when final team score equals the line.
- Postponement/suspension handling.
- Audit trail for stat corrections.

Required feature builders:
- Team scoring projection features.
- Opposing starter adjustment.
- Bullpen/relief context adjustment.
- Park/weather adjustment.
- Data sufficiency and missing-input contract.

Required calibration:
- Team Totals must have separate reliability buckets from full-game totals.
- No inherited confidence from existing Game Total model.

Activation:
- Shadow-only first.
- Backtest required.
- Calibration required.
- Market Intelligence Ready required.
- Official eligibility disabled until the universal gates pass.

## AI Engineering Advisor Update

The AI Brain engineering advisor now exposes the MLB Market Expansion Program priority:

- Highest Priority Task: Implement Team Totals V1
- Expected Product Value: High
- Estimated Engineering Cost: Medium
- Expected Opportunity Growth: about 30-32 additional shadow candidates on a 16-game slate after verified odds and gates
- Guardrail: no lowered official-pick standards and no betting activation

## Release Order

1. Team Totals Provider Verification
2. Team Totals Odds Normalization and Storage Contract
3. Team Totals Feature Builder
4. Team Totals Settlement Adapter
5. Team Totals Historical Import and Replay
6. Team Totals Shadow Predictions
7. Team Totals Calibration and AI Brain Reporting
8. Team Totals Current Board Preview Only
9. Official Eligibility Review after sample gates

## Blockers

- No verified stored team-total odds today.
- Historical team-total line snapshots are absent.
- Team-total settlement adapter does not exist.
- Team-total calibration sample does not exist.
- Current provider entitlement for expanded MLB markets must be verified before implementation.

## Final Decision

Market Expansion Wave 1 is **Team Totals V1**.

This is the optimal next market because it offers the best balance of user value, engineering feasibility, settlement clarity, architecture reuse and opportunity expansion while preserving Pick Analyzer's official-pick discipline.
