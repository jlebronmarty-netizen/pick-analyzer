# NBA-03A Cross-Event Shadow Accumulation Policy

Status: `NBA_03A_CROSS_EVENT_SHADOW_ACCUMULATION_POLICY_CERTIFIED`

## Purpose

NBA-03A has proven single-row and bounded batch `CURRENT_ERA_SHADOW` persistence, but the first 10-row accumulation batch concentrated entirely on one event because the existing canary ordering is event-flat: future events are ordered by start time, odds are ordered by newest snapshot, and candidates are emitted event-by-event.

That ordering is deterministic and not a defect, but it is not a representative sampling policy for forward shadow evidence. The cross-event accumulation policy is an evidence-collection policy only. It does not use probability, confidence, edge, EV, sportsbook preference, favorite/underdog status or expected winner.

## Certified Policy

`NBA_03A_CROSS_EVENT_SHADOW_ACCUMULATION_POLICY_V1`

The policy runs after existing eligibility gates. It never makes an ineligible candidate eligible.

For a requested batch size:

- `eventCap = max(2, ceil(batchSize / 5))`
- `eventMarketCap = max(1, ceil(eventCap / 2))`
- `modelIdentityCap = max(1, ceil(batchSize / 25))`

Selection is deterministic:

1. Start from the existing Safe Canary candidate order.
2. Keep only `writeEligible` candidates with a stable `candidateKey`.
3. Preserve first-seen event order from the existing canary.
4. Round-robin across events.
5. Within each event, preserve existing candidate order.
6. Enforce event, event/market and model-identity caps.
7. Stop at the requested batch size or when no eligible candidate can be added.

## Model Identity vs Price Evidence

The model prediction identity remains:

- sport
- event
- market
- selection/team
- exact line
- model version

Sportsbook is attached price evidence. Sportsbook variants are useful for price diagnostics and CLV research, but they should not dominate small batches before broader event/market coverage exists. This policy allows sportsbook variants as batch size grows, without changing persisted identity or idempotency rules.

## Dry-Run Result

Stored-data dry-run, no provider calls and no database mutations:

- Current Era rows before: 11
- Current Era rows after: 11
- Events scanned: 25
- Price candidates: 1000
- Write eligible: 246
- Already persisted: 31

For the next 10 candidates:

- Old ordering: 2 events, largest event share 80%, 4 model identities
- New policy: 10 events, largest event share 10%, 10 model identities

For the next 25 candidates:

- Old ordering: 2 events, largest event share 68%, 5 model identities
- New policy: 25 events, largest event share 4%, 25 model identities

For the next 50 candidates:

- Old ordering: 3 events, largest event share 48%, 8 model identities
- New policy: 25 events, largest event share 4%, 50 model identities

## Safety

No rows were written. The policy does not activate scheduler automation, NBA Official Picks, product visibility, learning, calibration, bankroll, notifications or MLB changes.

Next recommended action: authorize one bounded cross-event accumulation batch using this certified policy, with fresh dry-run revalidation immediately before any write.
