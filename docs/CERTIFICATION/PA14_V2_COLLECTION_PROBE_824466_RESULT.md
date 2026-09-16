# PA-14 V2 — Collection Probe Result for gamePk 824466

Date: 2026-09-16

Target:
- canonical gamePk: `824466`
- pitcher MLBAM id: `808967`
- pitcher: Yoshinobu Yamamoto
- opponent: Cincinnati
- target start: `2026-09-15T22:40:00.000Z`
- retained pregame provider timestamp: `2026-09-15T03:45:57.000Z`
- cutoff: `2026-09-15T03:46:01.693Z`

## Result

`PA14_V2_COLLECTION_PROBE_824466 = BLOCKED_FAIL_CLOSED`

The frozen `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0` builder rejected this target with all of the following contract reasons:

- `INCOMPLETE_PA`
- `MISSING_VELOCITY`
- `STRIKE_TYPE_CONFLICT`

The audit found:

- 26 source starts admitted to the builder input census;
- 150 opponent games in the same-season opponent census;
- 2,561 pitcher Statcast rows;
- 22,220 opponent Statcast rows;
- zero missing opponent games;
- eight opponent games containing unfinished PA evidence that remains unresolved under the frozen contract.

The probe did not relax, reinterpret, impute, or repair frozen V2 semantics. In particular, no missing velocity was synthesized, no description/type collision was silently rewritten, and incomplete plate appearances were not treated as complete.

## Persistence boundary

The block occurred before evidence-bundle persistence. No PA-14 V2 bundle for `(824466, 808967)` was inserted or certified.

The stored replay path therefore was not used to create a second certification candidate from this target.

## Safety

- research-only / shadow-only boundary preserved;
- no model training;
- no model promotion;
- no Official Picks writes;
- APOSTAR remained inactive;
- no sportsbook or odds-provider calls;
- no production serving changes;
- Pitcher-K V1 remained closed.

## Next collection rule

Future PA-14 V2 evidence collection must use genuinely retained pregame source-state evidence and the same frozen V2 contract. Targets blocked by source completeness, velocity, vocabulary, identity, BF reconciliation, or temporal gates must remain blocked. A larger and pitcher-diverse stored dataset is still required before any V2 training gate may be considered.
