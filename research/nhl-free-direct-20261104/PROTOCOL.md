# NHL free direct forward cohort V1

Owner authorization: restore NHL in Pick using free sources only. Cohort opened November 4, 2026. Prior Hub exports and historical profits are not recovered or certified by this change. NHL_READ_BRIDGE_V1 remains a strict legacy parser; its ledger must be recovered independently. New selections must never be pooled under the old policy/model identifier.

## Frozen policy

`DRATINGS_PUBLIC_ARGMAX_V1`: for an official pregame NHL game, select the side with strictly greater publicly published DRatings win probability. Ties abstain. Probabilities must be in (0,1), complementary within 0.002; exact normalized full names, home/away orientation and a unique official start within 15 minutes are required. First captured selection per official event is immutable and precedes official start. No own trained/calibrated model or official betting policy is claimed.

Full game winner includes OT/SO. Optional paired Circa ML quotes come only from the same detail table, correctly oriented. Best Line, mixed books, synthetic odds, paid fallback and retrospective price fills are forbidden. Entry prices remain null when absent. Current snapshots may change without changing the first selection.

Official NHL score API finals require both integer, nonnegative, unequal scores and identical event ID, team IDs and scheduled time. Unknown state, missing score and conflicting score observations remain unresolved/review. Corrected official finals are recorded, not overwritten. Long-postponed schedule changes require review, not inferred settlement. No automatic voids.

Accuracy = W/(W+L) for this new forward cohort. Profit/ROI = flat 1u only on settled observations with original captured quotes; unpriced entries never enter profit/ROI. These are arithmetic model records, not executed bets, certified calibration or guaranteed ROI. No imports of DRatings' historical record or the former Hub profit.

## Acquisition and safety

Production-only authenticated cron at UTC minutes 7/37; fixed allowlisted NHL/DRatings paths, slot dedup and 10-minute database lease. Maximum 12 FREE requests and 230 seconds per run, one official NHL team directory, three calendar dates plus at most two unresolved prior dates. The directory joins numeric team ID and exact abbreviation to full official names; nickname-only score payloads are never matched by guessed city prefixes. No transport retries or redirects. Each attempted request updates persisted call count before the call, then archives timestamp, HTTP status, SHA256 and compressed raw payload. 401/403 blocks subsequent calls to that host until explicit review. Sources collected during this task do not supply NBA/NCAAB/MLB or alter their ledgers.

Page/API reads call zero providers and write zero rows. RLS and revoked browser grants protect five isolated NHL tables; only the existing server service role may acquire. Sources, first forecasts and final observations are append-only. Failure and missing data are visible; no filled-in prices/probabilities/results. Previous 503 Hub bridge history is pending recovery, not assumed deleted.

## Validation

Legacy parser/integration tests plus new source/schema/cutoff/identity/price absence/score conflict tests. Full multisport suite, scoped lint, full production build, database grants/RLS, deployed unauthenticated cron rejection, live first scheduled run and read-only endpoint/UI verification. No promotion of Official Picks.
