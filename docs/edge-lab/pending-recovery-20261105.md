# TT pending-result recovery

Purpose: recover finals for original eligible forecasts that aged out of recent provider pages. No formula changes or reconstruction of historical predictions. The new source-only Hub route verifies the same Pick production OIDC identity and reads the existing server credential internally.

Budget unchanged: one recent results page, at most one player-filtered pending page, and one prematch request. When no pending target exists the original two recent pages remain. Daily9/monthly240 and8h cooldown remain enforced by existing SQL. Refreshing a screen makes zero provider calls.

Recovery groups markets by original event, waits at least1hour after kickoff, prioritizes never/recently least-attempted events, and persists query-side/page cursor in existing runs. Both participants and kickoff must still match the existing ttOutcome function; ambiguity remains DISPUTE. Empty search is not a loss or void. A query at page100 rotates to the other participant and explicitly records the ceiling. Coverage is partial, not a promise that the provider retains all history.

Source reference: https://api.pulsescore.net/api/tipsport/doc/swagger-ui-init.js exposes /api/tipsport/results filters sport,league,team,final,page,limit. Current player filter is a substring search; it is retrieval only, not an identity assertion.

NHL, MLB pause, schedules, credentials, subscriptions and old forecasts are outside this change. Test/build success alone does not certify a real recovered final; record actual runtime evidence separately.
