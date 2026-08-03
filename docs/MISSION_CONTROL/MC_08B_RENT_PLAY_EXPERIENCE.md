# MC-08B Rent Play Experience

Status: `LOCAL_VALIDATION_PASS_PENDING_PRODUCTION`

MC-08B makes Rent Play the clearest and most trustworthy primary recommendation on the homepage. It preserves the MC-08A homepage hierarchy and changes only the Rent Play presentation and contract.

## Contract

Rent Play now uses a typed `rent_play_v1` presentation contract built from existing stored Today evidence. It includes:

- status and actionability;
- selection, event, market and odds;
- model probability, implied probability and probability advantage;
- confidence, edge and expected value;
- canonical market timestamp, market age and freshness status;
- Official Pick distinction;
- readiness gates using `PASS`, `FAIL`, `PENDING` and `NOT_AVAILABLE`;
- supporting reasons, risks, blockers and warnings;
- what would change the decision;
- source surface and evidence.

Missing values remain unavailable. They are not coerced to zero.

## Source Priority

Rent Play uses existing evidence only:

1. Existing actionable Official Pick.
2. Existing high-probability candidate that passes the Rent Play gates.
3. Waiting candidate when model evidence exists but freshness blocks action.
4. No eligible Rent Play.

Most Likely remains distinct from Rent Play. Official Pick remains distinct from Rent Play. MC-08B does not promote any candidate into Official Picks.

## Product States

- `ACTIONABLE`
- `REVIEW_ONLY`
- `WAITING_FOR_FRESH_PRICE`
- `NO_ELIGIBLE_PLAY`
- `MARKET_UNAVAILABLE`
- `POLICY_BLOCKED`
- `NO_GAMES`
- `UNKNOWN`

## Safety

- Provider calls introduced: `0`.
- Provider credits consumed: `0`.
- Database mutations introduced: `0`.
- Prediction writes: `0`.
- Result writes: `0`.
- Settlement writes: `0`.
- Learning writes: `0`.
- Scheduler cadence changes: `0`.
- Refresh cadence changes: `0`.
- Official Pick policy changes: `0`.
- Prediction ranking changes: `0`.

MC-08C was not started.

## Local Validation

- MC-08B validator: `PASS` 34/34.
- MC-08A validator: `PASS` 37/37.
- Mission Control validator: `PASS` 57/57.
- MC-02 validator: `PASS` 24/24.
- OE-003F validator: `PASS` 28/28.
- OE-003E validator: `PASS` 32/32.
- C1 product validator: `PASS` 31/31.
- B2/B3/B4/B5/B5.1/B6/B6.1 product validators: `PASS`.
- Route/artifact consistency: `PASS` 14/14.
- Unsupported-market policy lock: `PASS` 19/19.
- Scheduler health alignment: `PASS` 6/6.
- JSON validation: `PASS`.
- Markdown validation: `PASS`.
- Changed-file ESLint: `PASS`.
- Targeted secret scan: `PASS`.
- `git diff --check`: `PASS`.
- Build: `PASS` with 396 generated static pages.
