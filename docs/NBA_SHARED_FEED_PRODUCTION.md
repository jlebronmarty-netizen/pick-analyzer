# NBA shared market data — production candidate, 2026-11-02

User authorized production and automatic operation. This branch is a release candidate, not evidence of an activated production application.

The central private gateway is the sole scheduler (every five minutes). No existing app cron is changed. It refreshes main markets for up to 16 non-final games from five hours ago to twelve hours ahead. Points/rebounds/assists/threes rotate across up to four games within two hours of start or in progress, bounded at 64 provider calls and 45 seconds per run. Coverage and failures remain explicit; this is not exhaustive sportsbook coverage.

The browser loads the schedule and selected market automatically; polls selected quotes every 60 seconds only while visible, backs off on failure and stops at confirmed final/cancellation. Runtime cache is regional, transient, not an audit ledger and not an atomic distributed lock.

Production APIs require the authenticated generated VERCEL_URL hostname. The canonical page redirects there so existing public app pages remain public. Vercel must protect generated production deployment URLs before publishing. Production→Production Trusted Sources permissions are required in the central gateway. Preview uses the known private Preview gateway.

No provider key in consumers. No model, Official Picks, betting, settlement, calibration, historical snapshot or database changes. Unrelated NBA/MLB stale pipelines are not repaired by this module.

Release gates: build, anonymous denial, real production service access, UI verification, then canonical promotion. Missing permissions must block release, not cause authentication to be disabled.
