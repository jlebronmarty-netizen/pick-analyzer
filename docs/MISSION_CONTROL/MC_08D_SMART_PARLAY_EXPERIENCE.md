# MC-08D Smart Parlay Experience

Status: `PRODUCTION_CERTIFIED`

MC-08D makes the homepage Smart Parlay a typed, user-controlled presentation contract over existing stored Today evidence. It does not change prediction, ranking, provider, scheduler, settlement, learning, Rent Play, Moneyline Bet or Official Pick behavior.

## Inventory Finding

Before MC-08D, the homepage Smart Parlay was a compact C1-era client widget that preselected up to three qualified legs and multiplied leg probabilities in the browser. That was useful for an early proof of interaction, but it was not an honest certified parlay contract because leg dependence and correlation were not certified.

Existing parlay-related surfaces remain separate:

- `/api/probability-picks/parlays` exposes projection-only probability parlays with its own limited contract.
- `/api/parlays` and `SmartParlaysPanel` are older dashboard/optimizer surfaces and are not the canonical homepage Smart Parlay contract.
- `/betting-workbench` supports user-controlled bet slip and parlay safety, but does not automatically save homepage selections.

MC-08D therefore keeps the homepage source as `/api/dashboard/today` with `/api/current-board?mode=current&limit=100` as secondary read-only context.

## Contract

Smart Parlay now uses `smart_parlay_v1` with:

- status and mode;
- bounded available, selected and rejected legs;
- per-leg probability, odds, implied probability, confidence, edge, EV, freshness and actionability;
- Rent Play, Moneyline Bet, Most Likely, Best Value and Official Pick relationships;
- selected-leg count, minimum and maximum leg count;
- combined odds only when every selected leg has valid canonical decimal odds;
- jointProbability = unavailable when no certified method exists;
- jointProbabilityMethod = `NOT_CERTIFIED`;
- freshness limited by the stalest selected leg;
- explicit `CLEAR`, `POTENTIAL`, `BLOCKED` or `UNKNOWN` correlation status;
- recommendation summary, reasons, risks and what would change the decision;
- provider calls 0 and remote mutations 0.

Unknown values remain null, unavailable or `UNKNOWN`. They are not substituted with zero.

## Leg Universe

The available leg universe is bounded to current stored candidates from existing Today evidence. Unsupported props, first-five, first-half, team-total, alternate-line and incomplete identity rows are excluded or rejected. Duplicate selections and direct opposite sides are blocked.

Stale, unavailable, post-start or policy-blocked legs may be shown only as review or blocked evidence. They cannot make the parlay actionable.

## Selection Policy

The user selects and deselects legs locally in the browser.

Default suggested legs are allowed only when at least two actionable, fresh, non-duplicated legs are available. MC-08D does not force a two-leg or three-leg parlay to make the card look populated.

If no safe suggestion exists, the builder says:

`No safe suggested combination is available.`

## Probability And Correlation

MC-08D does not fabricate joint win probability. It does not multiply individual probabilities silently, and it does not invent correlation coefficients.

Combined odds are standard mechanical price multiplication from selected canonical prices only. Combined odds do not equal model confidence.

Same-event selections are marked `POTENTIAL` unless a direct duplicate or opposite-side conflict makes them `BLOCKED`.

## Safety

- Provider calls introduced: `0`.
- Provider credits consumed: `0`.
- Database mutations introduced: `0`.
- Prediction writes: `0`.
- Result writes: `0`.
- Settlement writes: `0`.
- Learning writes: `0`.
- Wager writes: `0`.
- Scheduler cadence changes: `0`.
- Refresh cadence changes: `0`.
- Official Pick changes: `0`.
- Rent Play changes: `0`.
- Moneyline Bet changes: `0`.
- Most Likely ranking changes: `0`.
- Best Value ranking changes: `0`.

MC-08E was not started.

## Production Certification

Production certification passed on commit `f9faf649d89cd343034e935225d7215dafcc754b`.

- Homepage HTTP: `200`.
- Desktop render: `PASS`.
- Mobile render: `PASS`.
- Smart Parlay appears after Moneyline Bet and before Watchlist.
- Desktop observed state: `NO_SAFE_COMBINATION`.
- Mobile observed state: `NO_GAMES`.
- Desktop available leg count: `8`.
- Default selected leg count: `0`.
- User selection and deselection: `PASS` for desktop available legs.
- Combined odds: `UNAVAILABLE` because no selected combination had all required canonical prices.
- Joint probability method: `NOT_CERTIFIED`.
- Correlation status: `UNKNOWN` with no selected multi-leg combination.
- Missing odds, joint probability and timestamps render as unavailable, not zero.
- Provider calls: `0`.
- Remote mutations: `0`.
- Wager writes: `0`.
- Horizontal overflow: `false`.

MC-08E is READY but was not started.

## Local Validation

- MC-08D validator: `PASS` 47/47.
- MC-08C validator: `PASS` 43/43.
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
