# Pick Analyzer V2 Phase B6 Mobile Decision Experience

## Verdict

Status: `LOCAL_PASS_PENDING_PRODUCTION`

Baseline commit: `0463d48e05423aaa3359fbbc9461d4a74596622f`

B7 was not started.

## Mobile Issue Matrix

| Component | Viewport | Observed behavior | Severity | User impact | Repair | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| Verdict hero | 320-430px | Large desktop hero consumed too much first viewport. | P1 | User delayed seeing the rest of the decision. | Added mobile sticky verdict strip and reduced mobile hero scale. | Static B6 validator and build. |
| Best Opportunity hero | 320-430px | Selection/event text used desktop sizing and could create awkward wrapping. | P1 | Pick was harder to scan quickly. | Added mobile typography, safe wrapping and tighter spacing. | Static source validation. |
| Primary metrics | 320-430px | Eight desktop-style metric cards appeared before details. | P1 | Too much density before Why/Risks/Readiness. | Reordered to probability, implied probability, edge, EV, confidence and freshness first in two-column mobile layout. | Static source validation. |
| Conviction / Actionability | 320-430px | Separate large cards could dominate the page. | P2 | The action state competed with the hero. | Compact paired cards with two-line rationale and expandable details. | Static source validation. |
| Why / Risks / Readiness | 320-430px | All sections stacked, increasing scroll depth. | P1 | User had to scroll through all details. | Added mobile segmented control with Why, Risks and Readiness tabs. | Static source validation. |
| Readiness rows | 320-430px | Labels could truncate in compact rows. | P2 | Blocker labels lost meaning. | Rows stack vertically on mobile and avoid truncation. | Static source validation. |
| Alternatives preview | 320-430px | Up to six cards could be visible. | P2 | Preview became a full list. | Mobile shows no more than three alternatives; desktop can retain six. | Static source validation. |
| Advanced Evidence | 320-430px | Disclosure could sit close to bottom navigation. | P2 | Technical section could be obscured. | Added mobile bottom padding and kept collapsed by default. | Static source validation. |
| Bottom navigation | 320-430px | B5.1 structure needed preservation. | P1 | Opportunities discoverability could regress. | No structural change; B5.1 sheet retained. | B5.1 validator. |

## Layout Before

The mobile Today page used the desktop order and density: large verdict hero, large Best Opportunity hero, eight metric cards, separate explanation/status/detail sections, stacked Why/Risks/Readiness, alternatives and performance.

## Layout After

The mobile order is:

1. Sticky verdict strip.
2. Today's Best Opportunity hero.
3. Conviction + Actionability.
4. Compact primary metrics.
5. Segmented decision details: Why, Risks and Readiness.
6. What Would Change My Mind.
7. Alternatives preview.
8. Performance snapshot.
9. Advanced Evidence.
10. Bottom navigation.

## Sticky Verdict Implementation

`TodayDecisionPanel` adds a mobile-only sticky strip showing the verdict and actionability state. It is not rendered as a sticky full hero, does not affect desktop, and uses existing verdict/actionability labels only.

## Hero Changes

The Best Opportunity hero uses smaller mobile typography, safe text wrapping, tighter spacing and a two-column primary metric layout. Official vs not-official badges remain visible.

## Segmented Decision Details

Mobile users get a semantic tablist with:

- Why
- Risks
- Readiness

Only one section is visible at a time on narrow screens. Desktop keeps the richer stacked sections.

## Metric Layout

Mobile metric priority:

1. Probability
2. Implied probability
3. Edge
4. EV
5. Confidence
6. Freshness

Missing values remain unavailable and are not coerced to zero.

## Navigation Preservation

B5.1 bottom navigation remains:

- Today
- Opportunities
- Performance
- Sports
- More

The Opportunities sheet remains the certified discoverability path.

## Accessibility

B6 keeps semantic headings, accessible buttons, focus-visible states, screen-reader labels, text labels plus color, large tap targets, safe-area support and no keyboard trap. The segmented control uses `role="tablist"`, `role="tab"` and `role="tabpanel"`.

## State Handling

The mobile layout accounts for loading, error, no Official Pick, no eligible opportunity, stale data, unsupported market, missing metrics and long labels without adding formulas or data.

## Desktop Non-Regression

Desktop retains the B4/B5 decision sections, expanded card density and sidebar/header navigation. The new segmented control is mobile-only.

## Files Changed

- `src/components/dashboard/TodayDecisionPanel.tsx`
- `src/components/dashboard/AdvancedEvidenceDisclosure.tsx`
- `docs/PICK_ANALYZER_V2_PHASE_B6_MOBILE_DECISION_EXPERIENCE.md`
- `docs/pick-analyzer-v2-phase-b6-mobile-decision-experience.json`
- `scripts/pick-analyzer-v2-phase-b6-mobile-decision-experience-validate.mjs`
- `docs/PROJECT_STATUS.md`
- `docs/MASTER_ROADMAP.md`

## Safety

Provider calls introduced: `0`

Provider credits used: `0`

Database mutations introduced: `0`

Prediction writes: `0`

Settlement writes: `0`

Learning writes: `0`

## Production Evidence

Pre-change production runtime commit: `0463d48e05423aaa3359fbbc9461d4a74596622f`

Post-change production verification is required after automatic deployment serves the B6 commit.

## Manual Device-Test Status

No real mobile device test was performed. B6 is static responsive certification plus build and production route verification.

## Deferred B7-B8 Work

- B7: deeper Performance trust integration.
- B8: operations/admin separation.

## Final Verdict

`PICK_ANALYZER_V2_PHASE_B6_MOBILE_DECISION_EXPERIENCE_PASS`
