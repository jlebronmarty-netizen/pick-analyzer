# Table Tennis — read-only SHADOW integration

Sport card → `/table-tennis` → cached server-side read of Sports Edge Hub `/api/table-tennis/read-bridge` → validated immutable forecasts/canonical finals → model metrics and daily calendar. `/api/table-tennis/overview` exposes the same report. No model, provider acquisition or settlement writer exists in Pick for this integration.

## Display and accounting

- TT_ML_V1: original probability A/B and highest-probability direction, recorded decimal NetBet quote, no-vig and raw edge. W/L accuracy, binary Brier and natural-log log loss use evaluable first-seen forecasts only. Probability tie selects A to match the source scorer.
- TT_TOTAL_V1: projected full-match points, actual points, MAE and signed error (projection minus actual). No frozen O/U line or directional selection exists, so W/L, accuracy and ROI are not invented.
- Sport/global card contributes ML W/L only; Totals is named alongside ML but contributes no binary observations. Abstentions and ambiguous links do not count as pending evaluated picks. Unavailable feeds stay unavailable rather than becoming zero.
- Canonical final association follows the source player-pair ±10-minute convention, including reversed orientation. Unlike the existing aggregate scorer's nearest match, ambiguous links or a final claimed by multiple same-model forecasts remain unscored and visible. This presentation is descriptive accounting, not a new canonical settlement ledger or execution/contract certification.
- Date-scoped main calendar uses PR/UTC−4 and unique event IDs across models. Lists show original SHADOW forecasts. Official Picks always remains zero for this sport. Raw edges are visible inside the module and excluded from the current-value ranking: no source recommendation/freshness policy is certified.
- Filters: model, upcoming, all, evaluated, ML win/loss, Totals scored, pending, abstention and ambiguous. 40-row pagination bounds the rendered list. Old start times say the expected start passed, not that a live/final state is known.

## Source and boundaries

The new source bridge is allowlisted, paginated, requires exact counts/unique IDs and fails closed when incomplete. It exposes no credentials, raw provider payloads or arbitrary SQL/table selectors. Source database permission is not copied into Pick; existing server-side configuration serves the stored public research report. No database migration or RLS change is needed. No provider requests, database writes, new crons, training, retuning, Official promotion or other sport changes.

Source experimental odd/even PR #26 stays separate; only the two models already in source main are displayed. Soccer automation stays in its own chat/workstream.

## Verification

- 66 dashboard tests PASS, including synthetic accounting tests for probabilities, reversed orientation, separate denominators, ambiguous/shared finals, invalid counts, post-start captures, stale reads, duplicate IDs, empty states and calendar isolation.
- 16 focused source tests PASS, including frozen model/shadow regressions and reader failures.
- 107 immutable MLB runtime pins and 37 R3 sources PASS.
- Scoped ESLint, TypeScript and full source production build PASS; Pick full production build verified before release.
- Source preview returns sanitized SOURCE_UNAVAILABLE because service-role configuration is branch-scoped to the research preview. No secret was read or copied to make a new branch work. The tested source reader is verified on its production configuration before Pick release.

Hosted counts, deployment IDs and visual evidence are added in the final verification receipt/PR. All performance remains RESEARCH/SHADOW with small prospective samples, not model validation or ROI evidence.

## First verified hosted read

2026-10-17: source production bridge HTTP 200, 28 observations and 329 canonical reference finals. Each model: 5 forecasts, 9 abstentions, 2 evaluated and 3 awaiting a matched final; no ambiguous links. ML: 1 WIN/1 LOSS (50%), Brier 0.26344438737818227, log loss 0.7201073367425235. Totals: MAE 21.673156845805835 points, mean error −17.776017560798905 points. These are descriptive results from only two matches, not validation. Latest first-seen forecast capture 2026-10-17T04:31:27.150Z.

Source production merge: `2bb85098b3f7af755906cc0fdee71ae5488d2895`, PR #27. Preview absence of the branch-scoped server key was diagnosed and preserved; production provided the authorized configured reader. Both full builds PASS.
