# MLB Research-Only Odds Reserve Guard V1

Status: RESEARCH-ONLY / OPERATIONAL COST REPAIR

## Problem

Two supplementary research captures initialized their in-process quota state to null:
- PA13 Pitcher ER forward pricing capture;
- Run Line V2 HOME +1.5 alternate capture.

Both checked the 2,000-credit reserve only after their first provider call. Once the account was already below reserve, each new invocation could still spend one credit before stopping.

Observed on 2026-09-23 through 2026-09-24:
- PA13: 6 jobs / 6 credits;
- Run Line alternate: 9 jobs / 9 credits.

These paths are research-only and are not the core product price authority.

## Repair

Before either research-only path calls The Odds API:
1. read the latest persisted MLB Odds API remaining-credit value across date boundaries;
2. accept either requestsRemainingAfter or requestsRemaining metadata;
3. if the known value is <= 2,000, return BLOCKED_CREDIT_RESERVE with zero provider calls;
4. if the known value is above reserve, initialize the existing in-loop guard with that value.

## Explicit non-scope

The core ML / Run Line / Totals acquisition is currently product-authoritative (STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT). This repair does not alter or disable that product feed.

## Boundaries

- no model/formula/threshold changes;
- no Official Picks changes;
- APOSTAR disabled;
- no historical Odds API calls;
- no production eligibility change for research models;
- no line or identity changes.
