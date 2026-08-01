# Release 13B Live Slate Certification

Verdict: PASS PENDING PRODUCTION DEPLOYMENT OBSERVATION

## Root Cause

The active workspace displayed about 100 Research Picks because an empty current board triggered an all-stored-data fallback. The fallback rows were historical snapshots and the category fallback labeled them as Research.

## Fix

- Active board uses current board data only.
- Historical/all-stored rows are separated into History.
- Current rows must be pregame, future, same Puerto Rico operating day and non-historical.
- Duplicate active cards are collapsed by event, market and selection.
- Empty-day copy replaces stale active cards.

## Expected Counts From Pre-Fix Production Evidence

- Before active cards: 100 historical Research cards from all-stored fallback.
- After active cards when current board remains empty: 0.
- Official Picks: 0.
- Value Picks: 0.
- Research Picks: 0.
- No Bet rows: 0.

## Safety

- Prediction formulas changed: no.
- Probability outputs changed: no.
- Official Pick policy changed: no.
- Learning changed: no.
- Settlement changed: no.
- Scheduler changed: no.
- Provider contracts changed: no.
- Provider calls during certification: 0.
- Remote mutations during certification: 0.
