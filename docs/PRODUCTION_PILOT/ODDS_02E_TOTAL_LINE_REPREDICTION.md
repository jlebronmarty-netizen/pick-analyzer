# ODDS-02E Total Line Contract And Pregame Re-Prediction Repair

Status: `TOTAL_LINE_CONTRACT_READY_FOR_CUTOVER_DESIGN`

Starting commit: `7b8de5745b97dea64381513764cc331b3d0e2b34`.

Production commit observed: `7b8de5745b97dea64381513764cc331b3d0e2b34`.

Provider calls: `0`.

Database mutations: `0`.

## Verdict

ODDS-02E repairs the product contract, not provider authority.

The repository now has a server-only, provider-neutral market-line versioning contract that prevents cross-line probability reuse, prevents cross-line price binding, classifies material line movement, defines cutoff-safe re-prediction eligibility, preserves supersession lineage, and keeps settlement line-specific.

ODDS-03 remains unauthorized.

## Total Contract Root Cause

ODDS-02D classified the observed Total gap as:

`RESPONSE_CONTRACT_LIMITATION_FOR_NON_EXACT_TOTAL_LINES`

ODDS-02E narrows that to:

`ROUTE_RESPONSE_DROPPED_ALTERNATE_LINES`

The ODDS-02 shadow service normalized full provider snapshots in memory, but the captured route response persisted:

- `shadowSnapshots: 984` as a count;
- aggregate coverage;
- exact candidate matches only in `comparisons[].books`.

It did not persist non-exact total rows by event, book, side, line, and price. Therefore the captured ODDS-02C artifact cannot honestly reconstruct all moved total lines.

## Captured Evidence Boundary

ODDS-02C captured evidence proves:

| Metric | Value |
| --- | ---: |
| Current expected events | 14 |
| Mapping after ODDS-02D alias repair | 14/14 |
| Ambiguous mappings | 0 |
| Total exact predicted-line matches | 2/14 |
| Aggregate total rows in shadow coverage | 286 |
| Provider calls in ODDS-02E | 0 |

Because non-exact lines were not preserved in the captured response, ODDS-02E does not invent half-point or full-point movement counts for the 12 non-exact total candidates.

## 14-Game Dry-Run Simulation

Using the captured certification response only:

| Simulation Metric | Count |
| --- | ---: |
| Total games expected | 14 |
| Exact lines still available | 2 |
| Moved lines proven | 0 |
| New re-predictions required proven | 0 |
| Cutoff-blocked re-predictions proven | 0 |
| No-total markets proven | 0 |
| Line universe not recoverable from capture | 12 |

The correct classification for the 12 non-exact rows is:

`CAPTURE_INSUFFICIENT_FOR_NON_EXACT_LINE_UNIVERSE`

## Implemented Safety Contract

Created:

- `src/services/market-line-versioning-contract.service.ts`

The contract enforces:

- totals and run lines require exact line identity;
- moneyline has no numeric line identity;
- `Over 8.0` and `Over 8.5` are different market identities;
- best-price selection cannot cross lines;
- stale or missing source evidence cannot become actionable through capture time;
- future line-change prediction is dry-run eligible only before start and before cutoff;
- old predictions are preserved with explicit supersession lineage;
- settlement remains line-specific.

## Recommendation

The Odds API odds replacement readiness remains:

`MORE_ODDS_REPAIR_REQUIRED`

SportsDataIO remains production odds authority.

Next recommended phase:

`ODDS-02F_CAPTURE_CONTRACT_FULL_MARKET_EVIDENCE`

The next phase should repair the live shadow capture contract so future authorized captures retain all current bookmaker market evidence without exposing unnecessary public API payloads.
