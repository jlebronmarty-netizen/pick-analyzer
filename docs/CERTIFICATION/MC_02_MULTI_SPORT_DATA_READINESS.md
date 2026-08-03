# MC-02 Multi-Sport Data Readiness Certification

Status: `PRODUCTION PASS`

MC-02 certifies the data-readiness foundation for MLB, NBA, NFL, NHL, Soccer, Tennis, UFC and BSN.

## Certification Boundary

This certification is data-only. It does not:

- change prediction formulas, probabilities, confidence, edge or EV;
- change Official Pick, Rent Play, Moneyline Bet, Smart Parlay or Kelly policy;
- activate predictions for new sports;
- activate settlement or learning for new sports;
- change scheduler cadence;
- combine provider budgets;
- fabricate any sport, provider, result or market coverage.

## Certified Runtime Surface

- `/api/mission-control/data-readiness`
- `/api/mission-control`

Both surfaces are read-only. Normal reads make provider calls `0` and remote mutations `0`.

## Readiness Classification

| Sport | Classification | Basis |
| --- | --- | --- |
| MLB | `DATA_READY` | Certified SportsDataIO MLB active acquisition boundary plus stored canonical events, odds, results and feature evidence. |
| NBA | `DATA_PARTIAL` | Stored teams, players, events, standings, stats, odds and preview evidence exist, but production result/odds and activation gates remain incomplete. |
| NFL | `DATA_PARTIAL` | Stored event, odds and mapping evidence exists, but canonical teams and authoritative results are not complete. |
| NHL | `DATA_PARTIAL` | Stored event, odds and mapping evidence exists, but canonical teams and authoritative results are not complete. |
| Soccer | `DATA_PARTIAL` | Aggregate soccer is not a production league; competition-specific source selection is required. |
| Tennis | `DATA_FOUNDATION` | Feature compatibility exists, but real event/result source certification is pending. |
| UFC | `DATA_FOUNDATION` | Event-driven feature compatibility and prior score evidence exist, but bout identity/result certification is pending. |
| BSN | `PROVIDER_BLOCKED` | BSN remains source-specific; The Odds API coverage is not assumed and odds/provider provenance is blocked. |

## Provider Evidence

- SportsDataIO: isolated MLB active scope. NBA and other SportsDataIO expansion remain gated.
- The Odds API: separate credit pool. Prior bounded evidence exists, but current balance/reset/cost are not rechecked on normal reads.
- BSN: source-specific and not covered by The Odds API certification.
- Official/manual sources: supplemental only until sport-specific certification.

## Validation

The MC-02 validator proves:

- all target sports are represented;
- readiness is evidence-based;
- adapter existence does not imply `DATA_READY`;
- missing provider evidence remains blocked or unknown;
- SportsDataIO, The Odds API and BSN pools are isolated;
- normal reads make zero provider calls and zero mutations;
- feature readiness does not activate predictions;
- no model, settlement, learning or scheduler policy changed;
- known dirty files remain isolated;
- payloads are bounded and no secrets are exposed.

Final classification: `MC_02_PRODUCTION_CERTIFIED`
