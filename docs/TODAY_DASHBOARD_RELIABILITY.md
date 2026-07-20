# Today Dashboard Reliability

Status: Repaired
Version: V1
Last updated: 2026-07-19

## Root Cause

The AI Experience dashboard added richer User Mode sections, but the Today path still treated several independent reads as all-or-nothing work. `/api/dashboard?mode=today` used unbounded dependency waits for core services, and `UserTodayPanel` used one browser `Promise.all` for the Today API plus optional Most Likely, Best Value and AI Bet Finder requests. A slow or failed optional dependency could surface as `Today is temporarily unavailable` even when useful core sections were still available.

Local reproduction against the production build found degraded Supabase-backed reads returning `fetch failed`; before this repair, the Today API waited about 42.8 seconds before returning a degraded payload.

## Dependency Classification

Critical:

- operating date
- current operating-day games or explicit no-games state
- basic Current Board summary
- next-slate context

Optional:

- Today's Story details
- Most Likely rankings
- Best Value rankings
- AI Bet Finder explanation rows
- top opportunity
- provider budget and operating-day status details

## Repair

- The Today aggregator now uses timed settled dependency handling.
- Independent read-only dependencies run in parallel.
- Optional insight sections are embedded in the Today response when available.
- Optional section failures become typed `UNAVAILABLE` sections instead of hard panel failure.
- The client renders available sections from `/api/dashboard?mode=today` first and uses standalone insight APIs only as safe fallback.
- The API returns a predictable envelope with `success`, `status`, `generatedAt`, `operatingDate`, `partial`, `sections`, `warnings`, `errors` and `timing`.

## Performance

Local production-build validation with degraded Supabase reads:

- Before: about 42.8 seconds for `/api/dashboard?mode=today`.
- After cold degraded request: about 2.3 seconds wall time, 1.8 seconds server timing.
- After warm degraded requests: about 1.8-2.2 seconds wall time, 1.8 seconds server timing.
- `/dashboard` shell: about 0.44 seconds.

The route performs zero provider calls and zero remote mutations on page load.

## Remaining Limits

Production validation and deployment remain required. If production database/network dependencies are healthy, available sections should render with `AVAILABLE` status; if an optional section is slow or degraded, the main Today panel still renders with a compact partial notice.
