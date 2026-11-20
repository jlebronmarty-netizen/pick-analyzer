# Offline NCAA pregame archive

For research, from a trusted capture made at response receipt. Requires Python 3.11+.
The input JSON object contains sport_key, captured_at (timezone required), and events
(the original The Odds API full-game US spreads/totals response array with American prices).
Supply only the response body with capture metadata. Keep API credentials, headers and
request URLs out of the archive. A bookmaker update time cannot establish receipt time.
The November pilot summary lacks the original response envelope and cannot be imported as evidence.

Export forecasts.sql as a JSON array for the entire capture window, padding both ends by
at least ten minutes. Bind start_at and end_at as timezone-qualified timestamps. Use the
same frozen export on retries. Run from this directory:

    python replay.py capture.json forecasts.json research.sqlite
    python -m unittest discover

One transaction saves the input and accepted groups, their original prices and timestamps,
forecast identifiers, projections, signed point distances and rejection counters.
Replays of identical evidence are idempotent. Conflicting evidence or forecasts at the
same league and capture time abort. The SQLite file is a local research archive, not a
tamper-proof ledger. Keep it outside the repository.

The matcher requires a unique forecast with both teams in provider home/away order,
at most ten minutes of schedule drift, and a forecast available by receipt. It rejects
receipt at either scheduled start or later. Only the documented Indiana St Sycamores
alias is enabled. Coverage is conditional on the completeness of the supplied export.
An earlier actual start requires a separately verified actual-start cutoff before settlement.
Market contract, jurisdiction and prospective selection still need verification before ROI.
Live collection requires an atomic reservation shared by all callers on the same provider
account, deduplicated capture slots, reconciliation of response credits, and a confirmed
2,000-credit reserve including outstanding reservations. This offline tool makes zero API calls.
