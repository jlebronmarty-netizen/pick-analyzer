# R9 immutable market recovery: persistence certified, board freshness blocked

R9_MARKET_PERSISTENCE_CERTIFIED_UI_FRESHNESS_BLOCKED

The immutable writer respects SELECT/INSERT-only grants. Ordinary SELECT replaces SELECT FOR UPDATE for immutable observations, values and picks. Existing unique identities arbitrate insert races; matching canonical rereads reuse and mismatches block. Native enrichment keeps its separate guarded UPDATE contract. No privileges or production schema changed.

The exact preserved 286-row plan passed the actual writer under production-equivalent grants. Disposable interleaving verified one winner, matching reuse and mismatching conflict. Ten R9 groups, three checkpoint checks, 74 real-feature/Champion/physical checks and the required runtime/regression stack passed; build passed.

The original production run completed with 13 preserved predictions, 13 preserved mappings, 286 observations, 286 values and zero picks. Paid Odds were reused. A second pass reused every deterministic row with no provider calls or writes. Original freeze, evidence, failure lineage and accounting remain preserved. Intermediate readiness-hash and checkpoint-headroom failures were repaired prospectively; history was not rewritten. The checkpoint repair retains the original size ceiling and reserves bounded replacement-failure headroom.

The next natural scheduled invocation returned HTTP 200 and completed with 12 predictions, 264 observations, 264 values and 8 Policy V1 picks. Independent canonical reconstruction reused all 264 values and 8 picks with zero inserts. Two games lacked starters and one acquired evidence after its freeze; all were individually blocked.

Production market persistence is certified. Full end-to-end board freshness is not: all 26 current board rows remain BLOCKED, 24 with stale native-row evidence and two with older market/temporal blockers. The canonical read returns no errors, but eight persisted picks are not displayed as actionable. UI_REDESIGN_READY remains NO. No UI changes or weakened freshness guards were made. A separate canonical read-model review is the next step.

Aggregate R9 accounting through the completed scheduled validation: MLB Official 8, shared Statcast 0, Odds 1; cumulative Odds 6/20, legacy usage retained separately. Business inserts 1120; guarded native update 1; immutable updates 0; runtime inserts 4 and updates 115. DDL, DELETE, conflicts, duplicates and started-game leakage are zero. This cutoff excludes subsequent normal automation. At readback, no unresolved failed run remained and the lease was released.

Edge v12 matches the exact ten-file manifest; mandatory server-only bearer authentication passes and missing/wrong/public credentials are rejected. Champion, the 76-feature contract, preprocessing, Policy V1 and settlement boundaries remain unchanged. The 19 inherited tracked changes are preserved.

Detailed evidence stays private. This public audit includes aggregate certification evidence only, without raw production rows, private provider payloads, storage objects, credentials, bearer hashes or reservation metadata.
