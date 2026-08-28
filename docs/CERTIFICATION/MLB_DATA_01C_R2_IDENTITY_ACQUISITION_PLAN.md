# MLB-DATA-01C-R2 Authoritative Identity Acquisition Plan

Certification verdict: `MLB_DATA_01C_R2_IDENTITY_ACQUISITION_PLAN_BLOCKED`

Generated artifact: `docs/CERTIFICATION/mlb-data-01c-r2-identity-acquisition-plan.json`

## Scope

R2 is a plan-only phase. It made zero MLB Official calls, zero SportsDataIO calls, zero Odds API calls, zero weather calls, zero production DML mutations, zero production schema mutations, zero canonical mapping writes, zero feature writes, zero model writes, zero prediction writes, zero automation changes and zero cron changes.

## Baseline

Production, `origin/main` and local HEAD were aligned at `b1b53d38fc4eb00bbb0a69ae862e0223108cd034` before planning. Read-only production inventory preserved the R1 state:

- Raw Statcast rows: 712,528.
- Unique pitch identities: 712,528.
- Duplicate pitch identities: 0.
- Games: 2,430.
- Teams: 30.
- Date range: 2025-03-18 through 2025-09-28.
- Canonical home rows: 712,528.
- Canonical away rows: 712,528.
- `event_id` rows written: 0.
- Canonical pitcher rows written: 0.
- Canonical batter rows written: 0.
- Feature/model/prediction rows: 0.
- 2026 raw rows: 0.

## Existing Identity Paths

`provider_entity_mappings` remains the correct reusable crosswalk infrastructure. Its durable external identity key is `sport_key + entity_type + provider + provider_id + season`, and its `internal_id` points to the canonical Pick entity. No migration is required for the identity repair contract.

Existing repository evidence supports MLB Official game identity through:

- `src/services/mlb-official-data-provider.service.ts`
- `src/services/mlb-official-replacement.service.ts`
- `src/services/results-sync.service.ts`

These paths establish MLB Stats API schedule and live-feed contracts for `gamePk`, teams, status, start time, probable pitcher and lineup evidence.

## Acquisition Inputs

The R2 artifact contains the full 2,430-game input inventory with each Statcast `game_pk`, game date, source home/away teams, prior dry-run classification, ambiguity count and existing provider evidence.

The R2 artifact also contains the full 1,469-player input inventory with each source MLBAM person id, source role, audit-only source names where present, existing provider evidence, canonical candidates and previous gap classification. Names remain audit-only evidence and are not identity keys.

## Source Selection

The preferred authoritative source is `MLB Official / MLB Stats API`.

Game identity is plan-ready from existing repository contracts. The preferred game path is bulk or date-level schedule acquisition, then exact deterministic reconciliation to `sport_events.id` using existing provider identity, official date, canonical home/away teams, official start time, doubleheader/game number and game-results linkage.

Player identity is not execution-ready. The repository does not establish an exact no-call person endpoint contract for all 1,469 MLBAM source person ids with official player identity fields. Therefore R2 returns `NEEDS_ENDPOINT_CONTRACT_VERIFICATION` instead of guessing a player request shape.

## Request Volume

Game calls planned:

- Preferred bulk range: 1 schedule range request if accepted by the future authorized execution gate.
- Conservative date-level fallback: 184 schedule date requests.
- Avoided path: 2,430 individual game calls.

Player calls planned:

- `NEEDS_ENDPOINT_CONTRACT_VERIFICATION`.
- If a future exact person endpoint is verified, the bounded individual upper candidate is 1,469 person requests before cache hits.
- Bulk person acquisition remains `UNKNOWN` until verified.

## Safety Contracts

The cache contract keys games by `game_pk` and players by `person_id`, preserving provider, requested identity, response identity, retrieval time, response digest and acquisition version.

Future crosswalk persistence remains separately gated. The future write contract for `provider_entity_mappings` requires one MLBAM `game_pk` to exactly one `sport_events.id`, and one MLBAM `person_id` to exactly one `sport_players.id`; 0, conflicting 1, or more-than-1 states fail closed.

Future raw canonical mapping remains separately gated and may only write `event_id`, `canonical_pitcher_id`, `canonical_batter_id`, mapping state, mapping metadata and `mapped_at`. Source IDs, source teams, raw payloads, raw digests and score-state fields remain immutable.

## Downstream Gate

`MLB_DATA_01D_2025_FEATURE_BUILD_READY = NO`.

R2 does not authorize identity acquisition execution, crosswalk persistence or raw canonical mapping writes. The next safe phase is a bounded endpoint-contract verification plan for MLB Official player identity.
