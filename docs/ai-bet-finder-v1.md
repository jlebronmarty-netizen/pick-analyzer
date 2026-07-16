# AI Bet Finder V1

Status: Completed as deterministic orchestration.

AI Bet Finder is a read-only betting-intelligence workspace over the Current Board, Most Likely, Best Value, Arbitrage and Bet Slip Optimizer surfaces. It does not call a language model, provider, or mutation endpoint. It routes natural-language prompts through deterministic intent parsing and returns typed responses that preserve the existing official-pick gates.

## Supported Actions

- `SEARCH`: find current-board candidates by market, probability, confidence, odds range, underdog/favorite, positive edge/EV, conservative risk, Most Likely, Best Value and Arbitrage intents.
- `COMPARE`: compare two current-board candidates without changing stored prediction rows.
- `EXPLAIN`: explain why a candidate is analyzed, passed, ineligible or unavailable.
- `BUILD_TICKET`: ask the existing Bet Slip Optimizer for official mode and return `NO TICKET TODAY` when no official picks exist; preview mode remains explicitly quarantined and non-wagering.
- `WHAT_CHANGED`: compare immutable preview lineage when stored feature-snapshot metadata has previous-preview or comparison context.

## Safety Contract

- Provider calls: 0.
- Remote mutations: 0.
- Model probabilities are not recalculated independently.
- Stored prediction rows are not altered.
- Official picks, Top Picks, Play of the Day, Kelly, bankroll, portfolio and Production Gate behavior are unchanged.
- Raw `prediction_history` access is limited to immutable version comparison for `WHAT_CHANGED`.
- Props are unavailable until verified prop odds and required player-level context exist.

Required props response:

`Pitcher/player props are not currently available because verified prop odds and the required player-level context are missing.`

## Query QA Contract

Each response includes deterministic metadata:

- query understood
- Current Board mode and as-of timestamp
- latest odds capture
- candidates scanned
- candidates matched
- official-pick status
- provider calls made
- remote mutations made

The supported QA prompts are `Most likely today`, `Best value today`, `Best underdog between +100 and +180`, `Totals only`, `Low risk`, `Compare Mets moneyline with Under 9.5`, `Why no picks today?`, `Why not Mets moneyline?`, `Build my ticket`, `What changed?` and `Arbitrage`.

Candidate matching is selection-aware: an explicit Mets/NYM moneyline query resolves to `NYM Moneyline`, while total queries resolve to `Under 9.5 Total` when that stored current-board row is available. `Why no picks today?` explains the official gate globally rather than selecting an unrelated candidate.

## Current Validation

The deterministic fixture suite covers 24 cases across search, Best Value, empty positive-EV results, favorite/underdog filters, odds range filters, compare, explain, ticket building, unavailable props, unavailable arbitrage, What Changed, zero-call accounting and official-gate preservation.

Current smoke examples:

- `Best value today`: no positive modeled-value candidate is available.
- `Most likely today`: returns the three current `NYM @ PHI` analyzed preview candidates.
- `Build my ticket`: returns `NO TICKET TODAY`.
- `Arbitrage`: unavailable because verified multi-book pricing is absent from stored data.
- `Pitcher props`: returns the required unavailable-props message.
