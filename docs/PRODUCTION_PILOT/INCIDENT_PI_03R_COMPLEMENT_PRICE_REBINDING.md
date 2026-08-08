# PI-03R Complement Price Rebinding

Status: LOCAL VALIDATION COMPLETE, PRODUCTION PROOF PENDING

Starting commit: `bf6db22c26d0b2ee5e251921aeb8ef90b153f1ac`

## Scope

PI-03R repairs the HIGH linkage defect proven by PI-03: a displayed canonical complement outcome could show `Odds N/A` even when an exact provider-backed opposite-side market row existed.

The repair is bounded to Current Board price binding and homepage freshness wording. It does not change prediction probability, confidence, ranking, Official Pick policy, Kelly, settlement, learning, scheduler cadence, provider budgets, freshness thresholds, Current Era, or Replay.

## Complement Contract

Moneyline:

- `home` complements `away`.
- No line transformation is allowed.

Run Line / Spread:

- `home -X` complements `away +X`.
- `away +X` complements `home -X`.
- Exact magnitude is required.
- Cross-line binding is forbidden.

Total:

- `over` complements `under`.
- The exact total line is required.
- `Over 8` may bind only to `Under 8`, never `Under 8.5`.

## Runtime Repair

`src/services/current-board.service.ts` now:

1. Attempts direct source-side odds binding first.
2. Attempts complement binding only when the canonical displayed outcome is complement-derived.
3. Requires exact event, market family, normalized complement selection, exact complement line, and same sportsbook/provider scope when source snapshot scope exists.
4. Uses only actual `sports_odds_snapshots` rows.
5. Records `canonicalPrice.bindingMode` as `DIRECT`, `COMPLEMENT`, or `UNAVAILABLE`.
6. Records source market identity and timestamps for complement-bound prices.
7. Reuses `buildMarketAlignment` for implied probability, edge, and EV calculations.

No synthetic odds are created.

## Freshness Clarity

Homepage language now distinguishes snapshot recency from underlying market evidence:

- `Snapshot captured`
- `Market evidence`

This avoids calling betting evidence fresh solely because a snapshot was recently captured.

## Safety

Complement-bound prices inherit provider/source timestamp evidence. Stale source evidence remains blocked by the Product Freshness SLA and existing Official Pick/actionability gates.

Provider calls from certification reads: `0`

Database mutations from certification reads: `0`

## Production Proof Requirement

After deployment, certify one complement-bound candidate and one direct-bound candidate in production:

- Complement candidate has real displayed odds.
- `bindingMode = COMPLEMENT`.
- Exact source market identity is present.
- Probability and confidence match the pre-repair model values.
- Direct candidate still reports `bindingMode = DIRECT`.

