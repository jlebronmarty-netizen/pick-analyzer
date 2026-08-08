# UX-01 Dynamic Time-of-Day Greeting

Status: LOCAL IMPLEMENTATION COMPLETE, PRODUCTION PROOF PENDING

Starting commit: `44983a5f569c34a8742aee2237a2543e9fe667d9`

## Scope

UX-01 changes only the Daily Brief greeting on the homepage. The previous text was hardcoded as:

`Good Morning. What should I do today?`

That copy stayed visible all day. The new greeting is calculated from the user's display timezone preference.

## Contract

Display timezone drives the greeting:

- 00:00 through 11:59: `Good Morning.`
- 12:00 through 17:59: `Good Afternoon.`
- 18:00 through 23:59: `Good Evening.`

If the display timezone is unavailable or invalid, the existing product fallback is `America/Puerto_Rico`.

Operating timezone remains separate. UX-01 does not change operating-date bucketing, scheduler behavior, Performance grouping, prediction selection, settlement, learning or replay.

## Implementation

`src/lib/time-of-day-greeting.ts` provides `getTimeOfDayGreeting({ date, timeZone, locale })`.

The helper uses `Intl.DateTimeFormat` with the provided IANA timezone and a supplied `Date`, so deterministic boundary tests can exercise the exact contract without reading server-local time.

`src/components/home/HomeBettingPlan.tsx` calls the helper from the client-side personalization context. The homepage refreshes the greeting once per minute and recalculates when the user's display timezone changes in Settings.

Hydration safety is handled by rendering the dynamic heading with `suppressHydrationWarning`; the browser owns the current-time greeting while operating data remains API-driven.

## Language Foundation

The helper supports the existing EN/ES personalization foundation without introducing a new localization system:

- EN: `Good Morning.`, `Good Afternoon.`, `Good Evening.`
- ES: `Buenos dias.`, `Buenas tardes.`, `Buenas noches.`

The homepage question remains within the existing homepage copy scope.

## Safety

UX-01 is presentation-only. It does not change:

- prediction probabilities;
- confidence;
- ranking;
- Official Pick policy;
- Rent Play, Moneyline, Smart Parlay or Watchlist policy;
- odds, edge, EV or freshness contracts;
- settlement;
- learning;
- scheduler;
- provider budget;
- Performance;
- Current Era;
- Replay.

Certification reads must make zero provider calls and zero database mutations.
