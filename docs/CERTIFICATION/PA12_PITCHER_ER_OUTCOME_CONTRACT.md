# PA-12 — Exact Pitcher Earned Runs Outcome Contract

Date: 2026-09-15

## Current verdict

`PA12_OUTCOME_CONTRACT_CANDIDATE_READY_FOR_CONSUMER_VALIDATION`

This work isolates **observed Pitcher Earned Runs truth** from any model, projection, sportsbook price or recommendation.

Contract:

`SHARED_MLB_PITCHER_ER_OUTCOME_V1`

Candidate Consumer:

`GET /api/consumer/v1/mlb/pitcher-earned-runs?season=2025&cursor=...&limit=...`

## Production data audit

Current Supabase audit on 2026-09-15:

- Retrosheet `data,er` records: **20,868**;
- duplicate `(game_reference, pitcher_source_id)` ER keys: **0**;
- mapped starter rows on `mlb_pitcher_prop_backtest_2025_v1_enriched`: **4,473**;
- mapped rows with official ER: **4,473 / 4,473**;
- rows with `target_game_pk`: **4,473 / 4,473**;
- rows with `mlbam_pitcher_id`: **4,473 / 4,473**;
- duplicate `(target_game_pk, mlbam_pitcher_id)` starter keys: **0**;
- starters with positive outs: **4,470**;
- zero-out starts: **3**;
- strict 2025 pregame feature rows among positive-out starts: **4,470 / 4,470**.

Identity mapping distribution:

- `NORMALIZED_EXACT_NAME`: **4,457**;
- `EXPLICIT_TEAM_DATE_NAME_EXCEPTION`: **16**;
- fuzzy runtime identity: **not allowed**.

## Raw source semantics

Every 2025 Retrosheet `data,er` row currently has:

- `historical_only = true`;
- `postgame_known = true`;
- `pregame_eligible = false`;
- `training_eligible = false` on the raw record itself;
- `validation_status = parsed`;
- valid 64-hex `checksum_sha256`: **20,868 / 20,868**.

The Consumer preserves these source flags exactly. It does **not** relabel raw records as source-training-eligible.

A separate derived field, `researchOutcomeEligible`, is true only when the exact postgame ER row maps to exact MLB game/pitcher identity and the starter recorded positive outs. This is an outcome-label admission flag only and does not admit any pregame features.

## Consumer row identity and lineage

Each accepted row exposes:

- `canonicalGamePk`;
- `pitcherMlbamId`;
- game date and pitcher name;
- exact observed `observedEarnedRuns`;
- starter outs;
- identity mapping method;
- fixed research split;
- source historical/postgame/pregame/training flags;
- Retrosheet canonical game reference;
- Retrosheet pitcher source ID;
- raw record ID;
- source filename and line;
- parser version;
- source-line SHA-256 checksum.

Any missing/duplicate source row, unsupported identity method, invalid ER value, bad checksum or source-flag drift fails closed.

## Separation from the old PR #25 model draft

PR #25 demonstrated useful research evidence for a Pitcher ER model, including official `data,er` labels and a strict historical feature split. It predates current main and remains a draft.

PA-12 is deliberately being rebuilt from current main as a **data/outcome contract first**. No R2 model from PR #25 is promoted or treated as certified by this contract.

## Safety

- read-only Consumer;
- no DDL/DML;
- no sportsbook/provider calls;
- no Official Picks writes;
- no APOSTAR activation;
- no model probability or recommendation;
- Runs Allowed is never substituted for Earned Runs;
- missing/ambiguous outcomes remain unavailable.

## Remaining certification gate

Before PA-12 can be marked resolved:

1. CI contract check must pass;
2. production/preview Consumer must return real rows with exact MLBAM/gamePk identity and retained source checksum;
3. pagination must reproduce the audited **4,473** unique starter rows with **4,470** research-outcome-eligible rows and **3** zero-out exclusions;
4. duplicate/missing/source-drift behavior must remain fail-closed;
5. only then may Pick Edge certify the read-only PA-12 outcome boundary.
