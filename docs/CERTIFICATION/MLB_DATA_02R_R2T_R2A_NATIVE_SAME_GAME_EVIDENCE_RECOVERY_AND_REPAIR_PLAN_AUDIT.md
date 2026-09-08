# R2T-R2A native same-game evidence recovery and repair plan

Verdict: **MLB_DATA_02R_R2T_R2A_NATIVE_SAME_GAME_EVIDENCE_RECOVERY_AND_REPAIR_PLAN_CERTIFIED**.

This certifies the read-only audit and preview plan. **No production data was repaired. R2T-R2 persistence was not resumed. LIVE_EXECUTE remains contained.**

Prior package: `6f782635304815e2e0dcafe6e326e5059c3dea4d`. The new package is the enclosing local commit; resolve with `git log -1 --format=%H -- docs/CERTIFICATION/MLB_DATA_02R_R2T_R2A_NATIVE_SAME_GAME_EVIDENCE_RECOVERY_AND_REPAIR_PLAN.json`. Exactly one bounded local commit; no push.

## Exact inventory

The prior “18 fields” are an inventory catalog, not 18 missing cells. Across 15 fixed games there are **270 cells: 105 gaps and 165 valid present values**. The canonical JSON records all 270 individually, including game_pk, physical table/column/JSON path, current value, absence versus null, required type, consumer, evidence, classification, proposed value and mutation policy.

Every target is in `public.pick2_mlb_games`. Metadata paths below are JSON paths in the physical `metadata` column. Missing/NULL/ALIAS_ONLY are actual gap states; present values are not falsely classified as gaps. No invalid or conflicting current value was found within the inspected 18-field contract.

| Field | Current state/count | Required type | Consumer |
| --- | --- | --- | --- |
| home_team_id | ALIAS_ONLY (15) | text FK sports_teams.id | target/team/bullpen/first-inning identity |
| away_team_id | ALIAS_ONLY (15) | text FK sports_teams.id | target/team/bullpen/first-inning identity |
| game_type | NULL (15) | MLB Official gameType string; R1 accepts R only | R1 certified regular-season target gate |
| metadata.officialDate | MISSING (15) | MLB Official YYYY-MM-DD date | R1 explicit official-date provenance |
| metadata.abstractGameState | MISSING (15) | verbatim MLB Official abstractGameState string | R1 pregame status provenance |
| metadata.homeProbablePitcher.id | MISSING (15) | positive MLBAM integer | home starter identity/provenance |
| metadata.awayProbablePitcher.id | MISSING (15) | positive MLBAM integer | away starter identity/provenance |
| game_pk | PRESENT_VALID (15) | positive bigint primary key | all target/FK scope |
| scheduled_at | PRESENT_VALID (15) | timestamptz | pre-start cutoff |
| game_date | PRESENT_VALID (15) | date | target feature date |
| doubleheader | PRESENT_VALID (15) | N/Y/S string | doubleheader disambiguation |
| game_number | PRESENT_VALID (15) | positive integer | doubleheader disambiguation |
| source_payload_digest | PRESENT_VALID (15) | SHA-256 text | source identity |
| season | PRESENT_VALID (15) | integer | certified builder season |
| official_status | PRESENT_VALID (15) | verbatim detailed MLB status text | scheduled/pregame status guard |
| source | PRESENT_VALID (15) | provider text | MLB Official provenance |
| created_at | PRESENT_VALID (15) | timestamptz | observation availability |
| updated_at | PRESENT_VALID (15) | timestamptz | latest observed starter/target availability |

## All 15 affected games

Home/away canonical columns are currently NULL for every row. The identity columns below show **same-game MLB Official team ID / proposed existing canonical team suffix**. Each suffix expands to the existing `baseball_mlb:mlb:sportsdataio:team:{suffix}` ID; no ID is created.

Every row has stored `official_status=Scheduled`, `game_type=NULL`, `doubleheader=N`, and `game_number=1`. All share seven affected fields: home_team_id, away_team_id, game_type, metadata.officialDate, metadata.abstractGameState, metadata.homeProbablePitcher.id, metadata.awayProbablePitcher.id. Both probable-pitcher fields remain UNKNOWN for game 823092; the other 28 IDs exist in same-game nested starter_evidence.

| game_pk | Stored game_date | scheduled_at UTC | Home MLB / canonical suffix | Away MLB / canonical suffix | Home / away starter MLBAM |
| --- | --- | --- | --- | --- | --- |
| 823092 | 2026-09-08 | 2026-09-09T01:40:00Z | 136 / 13 | 140 / 28 | UNKNOWN / UNKNOWN |
| 823174 | 2026-09-08 | 2026-09-09T01:45:00Z | 137 / 15 | 138 / 31 | 694738 / 687273 |
| 823250 | 2026-09-08 | 2026-09-09T01:40:00Z | 135 / 33 | 120 / 35 | 663554 / 683000 |
| 823414 | 2026-09-08 | 2026-09-08T22:40:00Z | 143 / 12 | 117 / 30 | 691725 / 669713 |
| 823500 | 2026-09-08 | 2026-09-08T23:05:00Z | 147 / 29 | 115 / 23 | 693645 / 687312 |
| 823738 | 2026-09-08 | 2026-09-08T23:40:00Z | 158 / 32 | 112 / 9 | 694819 / 656849 |
| 823821 | 2026-09-08 | 2026-09-08T22:40:00Z | 146 / 22 | 121 / 18 | 645261 / 640455 |
| 823901 | 2026-09-08 | 2026-09-09T02:10:00Z | 119 / 1 | 113 / 2 | 669373 / 666157 |
| 824063 | 2026-09-08 | 2026-09-08T23:40:00Z | 118 / 5 | 109 / 14 | 608379 / 669203 |
| 824228 | 2026-09-08 | 2026-09-08T22:40:00Z | 116 / 17 | 142 / 20 | 623454 / 665152 |
| 824551 | 2026-09-08 | 2026-09-08T23:40:00Z | 145 / 16 | 134 / 4 | 680732 / 696149 |
| 824714 | 2026-09-08 | 2026-09-08T22:45:00Z | 111 / 25 | 108 / 21 | 663776 / 672282 |
| 824792 | 2026-09-08 | 2026-09-08T22:35:00Z | 110 / 19 | 114 / 10 | 687064 / 676440 |
| 824875 | 2026-09-08 | 2026-09-08T23:15:00Z | 144 / 26 | 139 / 11 | 700363 / 642547 |
| 824957 | 2026-09-08 | 2026-09-09T01:40:00Z | 133 / 24 | 141 / 3 | 678022 / 667755 |

All scheduled instants fall on September 8 in America/Puerto_Rico, including five whose UTC date is September 9. Those conversions are explanatory; neither UTC date nor Puerto Rico date fills missing MLB officialDate. Exact game_pk and gameNumber remain mandatory through doubleheaders or reschedules. No neighboring-game date or team match is used.

## Authoritative source search

Twenty bounded source queries cover native games, canonical raw Statcast pitches, snapshots, all six daily feature tables, market mappings, predictions, native results, pitcher/batter game rollups, canonical team/crosswalk tables, exact event mappings, a stored event window and stored context snapshots. There were no truncated/error results.

- Native games: 15 rows; unchanged from the R2 audit.
- Raw pitches, all daily feature domains, market mappings, predictions, results and game rollups: zero rows for the fixed game_pk scope.
- One snapshot exists for game 824792: `036e2267-99bd-41c0-b123-2bde12f9cb6b`. It is a prediction_bundle with digest-only features and empty native_identity_metadata. It is rejected as an authoritative schedule source and remains untouched.
- Canonical teams and existing team crosswalks: 30 each. Crosswalks use the existing SportsDataIO canonical namespace; there is no direct stored MLB Official team crosswalk in that table.
- Exact target-game event edges: zero. Thirty-two stored event-window candidates have no exact target game_pk edge and are excluded. Stored context snapshots in the bounded window: zero. Event-linked starter/lineup data cannot be joined by a fabricated team/date match.
- The existing MLB Official acquisition cache contains no exact payload for these 15 games. It does contain explicit team entity IDs/aliases usable for identity translation. Historical reconciliation artifacts add no missing same-game state. R1/R2 certificates preserve the same native omissions; their repeated values are not independent provider proof.
- Searches stayed within allowed stored/certified sources. `.tmp/` and `.worktrees/` were not inspected. No claim is made that those protected caches contain no evidence.

## Recovery classifications

Counts use the **105 actual gap cells**, excluding the 165 present cells.

| Category | Meaning | Count |
| --- | --- | --- |
| A | Recoverable directly from canonical existing data | 0 |
| B | Recoverable from persisted source metadata | 28 |
| C | Recoverable from existing cache plus canonical identity system | 30 |
| D | Requires future authoritative provider evidence | 47 |
| E | Irrecoverable with current evidence, without a viable identified recovery path | 0 |
| F | Conflicting evidence requiring manual review | 0 |

The 47 D fields comprise 15 game types, 15 explicit official dates, 15 abstract game states and two unknown starters. These classifications describe evidence accessible under the instruction. They do not assert that a future provider response proves an earlier state, or that inaccessible archives do not exist.

### Alias recovery and no cross-game inference

Each proposed team value starts with that target game's persisted `metadata.mlb_official_identity.{side}_mlb_team_id`. The exact official ID selects a cached team entity alias; the existing 01C canonical team mapping is checked against current `sports_teams` and `provider_entity_mappings`. All 30 resolve uniquely.

Cached team entities appear inside historical schedule records, but only the stable entity ID/name/abbreviation is used for translation. No historical game's participant assignment, date, type, status or starter is copied into the target. Tests change all cached game dates/types/states and prove alias results are unchanged; missing current-game official IDs do not fall back to names or dates. Conflicting canonical aliases require manual review.

The 01C whole phase was blocked on other identities. This audit relies only on its explicit team-MAPPED entries, rechecked against the current canonical tables. Existing quarantined provider-statistics flags are retained; identity translation does not promote those statistics or change Champion semantics.

### Date, game type and status

Date recovery is **PARTIAL**: stored game_date/scheduled_at are retained, but missing explicit officialDate requires an authoritative same-game observation. Do not guess it from scheduled_at, another game or the calendar.

Game-type recovery is **BLOCKED pending evidence**: no default to regular season from season=2026.

Status recovery is **PARTIAL**: detailed Scheduled is present; abstract state is missing. Scheduled, Preview, Warmup, In Progress, Final, Postponed, Suspended and Cancelled remain distinct provider states. A future changed state must carry its actual observation time and must not overwrite historical pregame meaning.

### Starter recovery

Starter recovery is **PARTIAL**: 28 same-game nested probable-pitcher objects can be copied to the R1-consumed metadata location. Their persisted observation upper bound is `2026-09-08T11:40:54.85083+00:00`, before the listed scheduled starts. This is a database observation bound, not a fabricated vendor publication timestamp.

The original affected-run run_as_of was not established in this audit. No retroactive eligibility is claimed. Require observation <= the explicitly intended run_as_of < first pitch. A future different assignment is CHANGED evidence requiring reconciliation and a new snapshot/run; it cannot replace immutable prior pregame history. Both starters for game 823092 remain UNKNOWN.

## Exact future DML preview and policy

The necessity matrix is complete:

- 165 cells: NO_REPAIR_REQUIRED.
- 58 cells: DATA_REPAIR_REQUIRED for the selected physical-enrichment plan: 30 canonical team fields and 28 metadata aliases.
- 47 cells: PROVIDER_RECOVERY_REQUIRED, excluded from executable/proposed mutations because new values are unknown.
- 0 actual conflicts: MANUAL_REVIEW_REQUIRED count 0.
- No additional CODE_MAPPING_REPAIR is selected: the previous mapping fix is preserved, and this phase adds audit/plan tooling only.

The canonical JSON contains every one of the **58 exact known-value patches**, with table, game_pk, column/JSON path, old value/state, new value, evidence source/timestamp, reason, mutation type and original row/source digests.

**Maximum: 15 row updates, with 58 logical field patches, coalesced into at most one bounded UPDATE per game_pk. INSERT=0, DELETE=0, DDL=0. This cap is not authorization.** The 47 unresolved patches are excluded and must receive a new reviewed preview after evidence recovery. Applying only the known 58 patches would not clear Gate 4.

Null/absent known-value additions are SAFE_CANONICAL_ENRICHMENT. Status/schedule fields are MUTABLE_STATUS_FIELD and require new timestamped evidence. Missing unsupported values remain UNKNOWN. Existing non-null immutable fields are retained; replacing them would be an IMMUTABLE_CONFLICT, not an actual conflict detected here.

Before any future mutation: re-read the exact row; compare its entire original digest, source digest and null/absent target state; reject any change; require the same target game identity. Merge only the named metadata keys, preserving starter_evidence and all unrelated metadata. Preserve source_payload_digest, created_at, snapshots, predictions, Official Picks and settlement/replay history. Never backdate timestamps. Read back exact values/FKs after separately authorized repair. No UPDATE, INSERT, DELETE or DDL was executed here.

## Resume and validation

After separately authorized same-game evidence recovery, regenerate/review the exact repair preview before any DML. Once native Gate 4 passes, resume R2T-R2 at **Gate 5**, continuing real snapshot/domain persistence, readback, all-game generation, downstream stages, checkpoint/resume and idempotency. Keep UNKNOWN/CHANGED starter games blocked individually.

Stored parity for game 824552 at `2026-09-05T01:51:21.667Z` remains preserved. Champion V1, preprocessing, 76-feature manifest and source-order binding were not modified; parity was not unnecessarily rerun. Only complete R2T-R2 certification can lead to separate R3 live re-enablement certification.

Validation: dedicated plan validator **28/28 PASS**; actual R2B LIVE_EXECUTE trap test stops before provider/repository invocation; preserved-file checks PASS; changed-file ESLint PASS; build exit 0 with 400 static pages. Final whitespace and secret checks are recorded in the canonical JSON.

Read-only network ledger: **38 requests; zero forbidden requests, provider calls, production DML and production DDL**. Live refresh, training, Champion changes, automation, cron and settlement remain zero. All 19 inherited unstaged generated artifacts remain byte-identical and excluded from the commit. Protected directories are untouched.

Canonical artifact: [R2T-R2A JSON](MLB_DATA_02R_R2T_R2A_NATIVE_SAME_GAME_EVIDENCE_RECOVERY_AND_REPAIR_PLAN.json). Supplemental query/validation evidence is under `C:/Users/jlebr/AppData/Local/Temp/pick-analyzer-r2tr2a-tyuQ9S`; it does not replace the canonical plan.
