# MC-02 Multi-Sport Data Readiness

Status: `PRODUCTION_CERTIFIED`

MC-02 certifies the data-readiness foundation for every configured target sport. It does not activate predictions, settlement, learning, provider acquisition, scheduler changes or recommendation-policy changes.

## Entry Evidence

- MC-00: `PRODUCTION_CERTIFIED`.
- MC-01: `PRODUCTION_CERTIFIED`.
- Local and `origin/main` were aligned at `6bc0d31ce70b7164b9311a6d1c3f082b0144371e` before MC-02 work began.
- MC-STOP-005 was cleared before MC-02.
- Known unrelated dirty files remained isolated.

## Runtime Surface

MC-02 adds the bounded read-only API:

- `/api/mission-control/data-readiness`

Supported filters:

- `sportKey`
- `readinessState`
- `provider`
- `limit`

Normal reads make zero provider calls and zero remote mutations. The route derives readiness from repository configuration, existing certification artifacts, provider-budget profiles and bounded aggregate stored-data counts.

## Sport Matrix

| Sport | Readiness | Provider | Summary | Next Work |
| --- | --- | --- | --- | --- |
| MLB | `DATA_READY` | SportsDataIO isolated active scope | Canonical events, odds, results and feature inputs are certified for current operating-day use. | MC-03 may use MLB only under existing policy gates. |
| NBA | `DATA_PARTIAL` | SportsDataIO/The Odds API gated | Stored foundation exists, but authoritative result/odds readiness and production activation remain gated. | Result and odds gate before prediction activation. |
| NFL | `DATA_PARTIAL` | The Odds API shadow | Stored event, odds and mapping evidence exists, but canonical teams and authoritative results are incomplete. | Canonical team/result mapping. |
| NHL | `DATA_PARTIAL` | The Odds API shadow | Stored event, odds and mapping evidence exists, but canonical teams and authoritative results are incomplete. | Canonical team/result mapping. |
| Soccer | `DATA_PARTIAL` | The Odds API shadow/source-specific | Soccer cannot be certified as one aggregate league. | Competition selection and source certification. |
| Tennis | `DATA_FOUNDATION` | The Odds API shadow | Feature architecture exists; real event/result source remains pending. | Event and result source certification. |
| UFC | `DATA_FOUNDATION` | The Odds API shadow | Event-driven foundation exists; canonical bout/result source remains pending. | Fight-card and result source certification. |
| BSN | `PROVIDER_BLOCKED` | BSN source-specific | Stored BSN foundation exists, but odds/provider provenance is not certified and BSN is not treated as The Odds API-covered. | Approved BSN source provenance. |

## Provider Matrix

| Provider | Certified Scope | Budget Pool | Current Classification |
| --- | --- | --- | --- |
| SportsDataIO | MLB active current operating-day acquisition through protected scheduler only | Isolated HTTP request pool | MLB `DATA_READY`; NBA remains gated |
| The Odds API | Prior bounded evidence and shadow/dry-run readiness for non-MLB sports | Separate credit pool | Current quota/reset unknown on normal reads |
| BSN Sources | Source-specific official/manual/CSV/future provider path | Not combined with other providers | Provider/source provenance blocked |
| Official/manual sources | Supplemental source class only | Source-specific | Must be certified per sport |

## Exit Evidence

- Every target sport has an evidence-based readiness classification.
- Blocked sports are isolated and do not block independent sport workstreams.
- Adapter existence does not imply `DATA_READY`.
- Provider budgets remain isolated.
- BSN is not claimed as The Odds API-covered.
- Feature readiness does not activate predictions.
- Settlement and learning remain unchanged.
- Normal readiness reads report provider calls `0` and mutations `0`.

## Next Eligible Mission

MC-03 remains `PLANNED` and manual-only for prediction activation. The next READY queue item remains MC-08, but no next mission was started during MC-02.
