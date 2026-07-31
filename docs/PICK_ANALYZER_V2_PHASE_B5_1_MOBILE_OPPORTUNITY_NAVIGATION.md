# Pick Analyzer V2 Phase B5.1 Mobile Opportunity Navigation

## Verdict

Status: `LOCAL_PASS_PENDING_PRODUCTION`

Baseline commit: `fee705bebeb595e49a7e4caca8ee029228c8469c`

Phase: bounded P1 UX repair after B5. B6 was not started.

## Root Cause

The mobile bottom navigation already had five primary items, but the visible `Opportunities` item was implemented as a direct link to `/most-likely`. That made Most Likely reachable in one tap, but it did not visibly expose the other opportunity destinations from the primary mobile UI.

The affected mobile destinations were:

- `Official Picks / Probability Picks`
- `Best Value`
- `Current Board / Watchlist` where supported

The routes and product surfaces already existed, so this was a discoverability and information-architecture defect, not a backend, route, model, provider or recommendation-policy defect.

## Mobile Navigation Before

Primary mobile bottom navigation:

1. Today -> `/dashboard`
2. Opportunities -> `/most-likely`
3. Performance -> `/performance`
4. Sports -> `/sports-center`
5. More -> `/dashboard#advanced-details`

Defect: `Opportunities` looked like a category but behaved as a single direct Most Likely link.

## Mobile Navigation After

Primary mobile bottom navigation remains limited to five visible items:

1. Today
2. Opportunities
3. Performance
4. Sports
5. More

The `Opportunities` item now opens a mobile navigation-only sheet with visible text links to:

- Today's Best Opportunity
- Official Picks / Probability Picks
- Most Likely
- Best Value
- Current Board / Watchlist

No full opportunity taxonomy, data tabs or backend route was added.

## Access Paths

Most Likely:

`Today -> Opportunities -> Most Likely`

Best Value:

`Today -> Opportunities -> Best Value`

Official Picks / Probability Picks:

`Today -> Opportunities -> Official Picks / Probability Picks`

Current Board / Watchlist:

`Today -> Opportunities -> Current Board / Watchlist`

Repository note: a standalone `/current-board` page route is not present. The supported watchlist/current-board-adjacent user surface remains the Current Board-derived Best Value and market-intelligence view.

Today's Best Opportunity:

`Today -> Opportunities -> Today's Best Opportunity`

## Exact Repair

Updated `src/components/dashboard/DashboardShell.tsx` only for runtime UI:

- Kept the bottom nav at five primary items.
- Converted mobile `Opportunities` from a direct anchor into an accessible button.
- Added a mobile-only Opportunities sheet.
- Added visible text links for each required opportunity destination.
- Added focus transfer to the first sheet link on open.
- Added Escape close.
- Added backdrop close.
- Added close button.
- Closed the menu after destination navigation.
- Preserved desktop sidebar and desktop header navigation.
- Preserved existing URLs and did not create redirects.

## Accessibility

The sheet uses:

- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby`
- `aria-haspopup="dialog"`
- `aria-expanded`
- `aria-controls`
- keyboard Escape close
- focus movement to the first destination on open
- visible labels, not icons only
- minimum mobile tap-target sizing
- focus-visible rings

## Desktop Non-Regression

Desktop navigation remains based on the existing sidebar and header links. B5.1 does not force mobile sheet behavior onto desktop and does not expose every advanced destination as a desktop primary item.

## API And Business Rule Safety

B5.1 changes no API, service, provider, scheduler, settlement, learning, prediction, probability, confidence, EV, edge, Trust, Official Pick policy, conviction or actionability logic.

Provider calls introduced: `0`

Provider credits used: `0`

Database mutations introduced: `0`

Prediction writes: `0`

Settlement writes: `0`

Learning writes: `0`

## Production Evidence

Pre-change production runtime commit: `fee705bebeb595e49a7e4caca8ee029228c8469c`

Post-change production verification must be completed after automatic Vercel deployment serves the B5.1 commit. No manual Vercel deployment is authorized by this phase.

## Final Verdict

Local static/build certification target: `PICK_ANALYZER_V2_PHASE_B5_1_MOBILE_OPPORTUNITY_NAVIGATION_PASS`

Production classification is reserved for the final response after automatic deployment verification.
