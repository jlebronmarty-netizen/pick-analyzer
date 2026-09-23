# MLB Approved Prop Full-Slate Capture Recovery V1

Status: RESEARCH-ONLY / SHADOW-ONLY

## Problem

The approved-prop job planned the full MLB slate but stopped after the first event when The Odds API returned a remaining-credit count below the hard reserve of 2,000. On 2026-09-23:

- planned events: 15;
- first 10:45 event call cost: 25 credits;
- remaining after that call: 1,890;
- persisted prop coverage: one canonical game only.

The previous implementation discovered the quota only after spending the first event call and considered the job complete when all executed HTTP calls succeeded, even when most planned events were never attempted.

## Repair

1. Preflight the latest persisted The Odds API remaining-credit count before any new provider call.
2. If the last known remaining count is at or below 2,000, make zero new Odds API calls.
3. Completion is based on planned-event coverage, not merely HTTP success.
4. Use BALLDONTLIE as a separate prospective fallback provider when Odds API cannot complete the slate.
5. BALLDONTLIE player props are normalized only from strict-pregame timestamps.
6. BDL player identity maps by unique exact-normalized player name into the canonical MLBAM directory; fuzzy matching remains forbidden.
7. The daily evaluator accepts both approved sources and still requires exact line + exact side + exact MLBAM identity + pregame quote.

BALLDONTLIE's current MLB Player Props endpoint supplies all props for one game in one response and documents the pitcher/batter prop families required by the approved runtime. Milestone-only rows are not converted into an opposite side.

## Safety

- research-only;
- no historical Odds API requests;
- The Odds API reserve remains 2,000;
- no automatic reserve reduction;
- Official Picks unchanged;
- APOSTAR disabled;
- production eligibility false;
- no fuzzy player identity;
- no postgame quote acceptance;
- no formula/threshold changes.
