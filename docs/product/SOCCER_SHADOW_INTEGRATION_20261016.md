# Soccer SHADOW integration — 2026-10-16

## Display scope and source

Soccer tile, `/soccer`, `/api/soccer/overview`, combined daily calendar and valid Shadow pick/edge sections consume Sports Edge Hub `/api/soccer/read-bridge` through a fixed, read-only adapter. LaLiga O/U 2.5 only; `SOCCER_POISSON_V0`; SHADOW / RESEARCH. Legacy Soccer prediction/feature endpoints are unchanged and do not supply this cohort.

Source research PR #23 commit `63f7a4dcb53770217c5549399f8e9bf4c1dbc437`, snapshot `research/soccer-v0/prospective/2026-10-16T0217Z_matchday9_snapshot.json`. Git blob `397b31877f1fc286fa6361a3de70acd2d01d60ac` exactly matched fetched bytes; SHA256 `61e6feef5637415a796ce8abff76d40ec6229f5614a548e18af9c8bd22b56fc6`. Source bridge PR #24 selectively publishes three new display files without merging research, executing a model, calling a provider or activating automation. The repository is private, so no anonymous GitHub token or repository credential is copied into Pick.

The source contains seven quoted projections, all INSUFFICIENT_HISTORY, and three non-2.5/missing-quote exclusions out of ten fixtures. Its original whole-second frozen timestamp is retained; final quote capture is 353ms later within the same second, explicitly allowed up to one-second precision. The exact quote timestamp is preserved. Refresh/readAt never replaces capturedAt/lastUpdated. TheRundown FREE delay of 300 seconds and affiliate IDs 3/19/23 are retained without inventing sportsbook names or execution availability. Three exclusions lack resolved UTC tips and do not become invented timed calendar games.

## Qualification and accounting

- No Soccer Official Picks, writes, promotion, new scheduler or paid/provider request.
- Raw edges remain diagnostic when warmup fails, even if they exceed 8pp; no STRONG label is assigned to these seven rows and none enters picks/rankings/performance.
- Future valid Shadow selections require frozen QUALIFIED/STRONG plus explicit warmupComplete and evidence: >=5 home venue games, >=5 away venue games, >=20 league games, asOf <= entry capture, and last input date strictly before target UTC date. Counts reuse the existing source model gate; model code/thresholds are not changed.
- Source status/bucket must match its declared 3/5/8pp levels. Paired no-vig, complementary probabilities, chosen side, edge, timing and duplicates are independently checked. Invalid/incomplete reports fail closed to HTTP503, not partial metrics.
- Qualified/Strong are still SHADOW. PASS/SHADOW buckets remain informational. Frozen valid selections can enter the daily recorded-pick list; only future unstarted, unsettled selections with entry capture AND price update within 45 minutes enter informational edge. This is a UI freshness cap, not retuning or an executable-edge claim.
- Accuracy = wins/(wins+losses), ROI = flat one-unit net profit / decided bets, VOID excluded. Closing no-vig prices remain separate; CLV = closing minus entry no-vig for frozen side. Report metrics must match independently verified source outcomes/quotes. Blocked rows never enter qualified-pick accounting. Without denominators, accuracy/profit/ROI/CLV stay null. Current valid-pick pending count is zero, not seven.
- Hypothetical gate/settlement test fixtures are test-only and never persisted as real observations. Original seven remain blocked and unsettled.

## Delivery limitation

The deployed read bridge publishes an immutable checkpoint and performs zero provider requests, zero DB reads/writes. Upstream continuous acquisition and settlement publication are **not** deployed or activated by this integration; PR #23 remains open. On a later separately verified source checkpoint deployment, Pick automatically consumes the updated bridge without redeploying Pick; current gate enforcement supports valid future rows, but no such rows currently exist. This is not an unattended source publisher and no ongoing process is claimed. The UI and API identify PUBLISHED_CHECKPOINT and continuousCollection=false.

## Verification

59 dashboard tests PASS: warmup bypass and stale-price exclusion, real seven-row projection, probability/no-vig/edge arithmetic, timestamps, unique identities, post-start exclusion, independent sample settlement/ROI validation and UI classification. Scoped ESLint and the 107 immutable MLB runtime guards / 37 R3 sources PASS. Full builds, hosted preview/production checks, immutable MLB ledger fingerprints and final release receipts complete deployment verification. No mobile-device certification is claimed.

A failed first source preview is preserved in the source delivery notes: Turbopack changed 12 doubles in imported JSON and strict integrity rejected HTTP503. Exact runtime file bytes and scoped tracing correct this without rounding probabilities/prices. Each row keeps original frozenAt so later cumulative publication can add settlements after kickoff without invalidating original pregame timestamps.
