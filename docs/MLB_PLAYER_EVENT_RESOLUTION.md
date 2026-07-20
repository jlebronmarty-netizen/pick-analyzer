# MLB Player Event Resolution

Pitcher event resolution uses verified SportsDataIO GamesByDate starter context.

Starter priority:

1. Confirmed starting pitcher.
2. Fresh probable pitcher.
3. Expected starter with provider player ID.
4. Unverified.

Only confirmed, probable or expected provider-backed starters may produce shadow pitcher projections. A pitcher cannot be attached to an event unless his mapped team is one of the event participants. Provider-backed fallback identity is allowed only when SportsDataIO PlayerID exists and an internal `sport_players` row is not yet persisted.

Batter projections are preliminary unless lineup confirmation is available. The board never implies confirmed lineup participation.

