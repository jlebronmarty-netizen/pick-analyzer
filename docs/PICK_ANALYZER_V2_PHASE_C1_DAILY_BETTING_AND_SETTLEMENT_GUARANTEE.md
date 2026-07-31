# Pick Analyzer V2 Phase C1 Daily Betting And Settlement Guarantee

Date: 2026-07-31

Status: LOCAL PASS PENDING VALIDATION

Starting commit: `fff4dfed6dd770eb0e634f5cae96ccf19e60eadb`

## Goal A: Homepage Betting Experience

The homepage is no longer a redirect to `/dashboard`. It now renders Today's Betting Plan as the primary product surface.

Top sections:

- Rent Play: safest Official Pick only. If none exists, the page displays "No Rent Play Today" with the closest candidate.
- Moneyline Bet: best qualified moneyline candidate, preferring Official Pick evidence.
- Parlay Builder: strongest qualified legs with client-side toggles for probability, confidence and EV. No backend prediction changes.
- Today's Best Opportunity: best remaining qualified opportunity from existing Today evidence. AVOID and DO NOT ACT copy is not displayed as a recommended opportunity.

Everything else remains behind dedicated routes: Most Likely, Best Value, Performance, Sports, Operations and Data Coverage.

## Goal B: Settlement Guarantee

Defect repaired:

- Automatic scheduler settlement previously called `settleOperatingDay` with `prospectiveOnly: true`.
- That could leave non-prospective completed-game prediction rows pending even when authoritative results existed.

Repair:

- The automatic `settle` action now calls `settleOperatingDay` with `prospectiveOnly: false` for the selected operating date.
- Adaptive scheduler action selection now lets deterministic settlement preempt provider-backed odds refresh when both are due.
- Run-line markets are graded with spread semantics.
- Settlement summaries now include explicit blocked row reasons for missing authoritative results, ungradable/unsupported markets and missing odds needed for profit accounting.
- A new read-only monitor, `/api/operations/settlement-guarantee`, classifies recent completed-game prediction rows as SETTLED, READY_FOR_SETTLEMENT or BLOCKED with reason.

Production recovery:

- Production commit `a90052fa0e71d9606881e95a9be79a6f2da1e4a3` proved the monitor route no longer crashed, but it returned `ACTION_REQUIRED` because 12 recent completed predictions were still `READY_FOR_SETTLEMENT`.
- The adaptive status route also showed 51 total settlement-ready rows while selecting `midday_refresh` because odds were stale.
- C1 therefore adds an explicit scheduler-priority guard: already-scored settlement work runs before provider-backed market refresh so completed games cannot remain unsettled merely because live odds are stale.

Learning and Performance flow:

- Settlement writes remain scoped to prediction history settlement fields.
- Learning remains derived from settled prediction history; automatic model training is not enabled by this phase.
- Performance reads settled prediction history through the existing performance scope.

## Safety

- Provider calls introduced: 0.
- Provider credits used by implementation: 0.
- Prediction formula changes: 0.
- EV/edge/confidence/Trust changes: 0.
- Official Pick policy changes: 0.
- Provider mapping changes: 0.
- Settlement path changed only to broaden automatic selected-date settlement from prospective-only to all supported date rows and to report blocked reasons.

## Validation

Primary validator: `scripts/pick-analyzer-v2-phase-c1-daily-betting-settlement-validate.mjs`

Additional required validation: settlement, learning, performance, today, scheduler, route validation, JSON validation, changed-file ESLint, `git diff --check`, build and production read-only certification.

## Verdict

C1 can pass only when both homepage betting experience and automatic settlement guarantee pass validation and production certification.
