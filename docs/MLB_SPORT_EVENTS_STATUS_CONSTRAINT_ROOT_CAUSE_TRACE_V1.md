# MLB sport_events.status Constraint Root Cause Trace V1

Date: 2026-07-20

## Constraint

- Constraint name: `sport_events_status_check`
- Migration file: `supabase/migrations/202607110001_nba_data_sync_v1.sql`
- Schema source: `sport_events.status text not null default 'scheduled' check (status in (...))`
- Allowed values:
  - `scheduled`
  - `live`
  - `completed`
  - `postponed`
  - `cancelled`

TypeScript source of truth:

- `src/services/mlb-event-status-mapper.service.ts`
- `SPORT_EVENT_ALLOWED_STATUSES`
- `SportEventCanonicalStatus`
- `mapSportEventStatusToDbStatus`
- `traceSportEventStatusWrite`
- `assertSportEventStatusWrite`

Duplicated status mappers found:

- `sportsdataio-mlb-prospective-preview.service.ts` local `eventStatus`
- `sportsdataio-mlb-historical-import-executor.service.ts` local `eventStatus`
- `sportsdataio-historical-import-readiness.service.ts` local `normalizeStatus`
- `nba-data-sync.service.ts` `EventStatus` from shared multi-sport types

These local mappers can still classify provider semantics, but every DB-bound `sport_events.status` value now passes through `assertSportEventStatusWrite`.

## Exact Root Cause

The production failure shape is MLB Stats API status refresh writing provider lifecycle strings directly into the constrained `sport_events.status` column.

Evidence from the repaired local runtime fixture:

| Field | Value |
| --- | --- |
| Provider | MLB Stats API |
| Function | `refreshMlbGameStatuses` |
| File | `src/services/operating-day.service.ts` |
| Write line | 646 |
| Fixture raw provider status | `Final` |
| Mapped status | `completed` |
| Legacy attempted DB status | `final` |
| Legacy attempted allowed | `false` |
| Canonical final DB status | `completed` |
| Canonical allowed | `true` |

The exact invalid value proven by local instrumentation is `final`.

The same trace fixture also proves another legacy invalid value:

| Field | Value |
| --- | --- |
| Provider | MLB Stats API |
| Function | `syncRecentResults` |
| File | `src/services/results-sync.service.ts` |
| Fixture raw provider status | `In Progress` |
| Legacy attempted DB status | `in_progress` |
| Legacy attempted allowed | `false` |
| Canonical final DB status | `live` |

Production selected an old unresolved MLB slate. A completed MLB game on that stale slate would produce MLB Stats API `Final`, and the pre-repair `refreshMlbGameStatuses` path could attempt `status='final'`, which violates `sport_events_status_check`.

## Runtime Evidence

Local command:

```powershell
npm.cmd run build
npm.cmd run start -- -p 3050
Invoke-RestMethod -Uri 'http://localhost:3050/api/operating-day/validation' -Method Get | ConvertTo-Json -Depth 12
```

Validation result:

- `success=true`
- `checks=13`
- `passed=13`
- `providerCallsMade=0`
- `statusWriteTracing.success=true`
- `statusWriteTracing.allowedValues=["scheduled","live","completed","postponed","cancelled"]`
- Trace 1: `attemptedDbStatus="final"`, `attemptedAllowed=false`, `finalDbStatus="completed"`
- Trace 2: `attemptedDbStatus="completed"`, `attemptedAllowed=true`, `finalDbStatus="completed"`
- Trace 3: `attemptedDbStatus="in_progress"`, `attemptedAllowed=false`, `finalDbStatus="live"`

No provider calls and no remote mutations were made.

## Writer Matrix

| Writer | Provider | File | Write line | Uses canonical guard? | Writes DB directly? | Safe? |
| --- | --- | --- | ---: | --- | --- | --- |
| `refreshMlbGameStatuses` | MLB Stats API | `src/services/operating-day.service.ts` | 646 | YES | Update after guard | YES |
| `fetchMlbStatsResults` / `syncRecentResults` | MLB Stats API | `src/services/results-sync.service.ts` | 640 | YES | Update after guard | YES |
| `normalizeSportsDataIoMlbSchedule` / prospective preview | SportsDataIO MLB | `src/services/sportsdataio-mlb-prospective-preview.service.ts` | 3213 | YES | Upsert guarded rows | YES |
| `normalizeSeasonSchedule` / MLB historical executor | SportsDataIO MLB | `src/services/sportsdataio-mlb-historical-import-executor.service.ts` | 2241 | YES | Upsert guarded rows | YES |
| `runSportsDataIoPilotV2` | SportsDataIO NBA | `src/services/sportsdataio-historical-import-readiness.service.ts` | 3499 | YES | Upsert guarded rows | YES |
| `runSportsDataIoPilot` | SportsDataIO NBA | `src/services/sportsdataio-historical-import-readiness.service.ts` | 3936 | YES | Upsert guarded rows | YES |
| `upsertRows('sport_events')` | The Odds API / NBA | `src/services/nba-data-sync.service.ts` | 420 | YES | Upsert guarded rows | YES |
| `storeSnapshot` | Official BSN homepage | `src/services/basketball/acquisition/bsn-acquisition-engine.ts` | 358 | YES | Upsert guarded rows | YES |

## Fix

The fix is deliberately small:

- Add DB-bound status tracing and assertion to the existing canonical status mapper module.
- Route every discovered `sport_events.status` write through `assertSportEventStatusWrite`.
- Preserve provider-specific raw status in metadata where already available.
- Keep local debug logging gated by `SPORT_EVENT_STATUS_DEBUG=true`.

No scheduler, prediction, recommendation, EV, Kelly, confidence, provider-budget, dashboard or temporal architecture changes were made.

## Certification

- Build: PASS
- `git diff --check`: pending final run after this document
- Provider calls made: 0
- Remote mutations made: 0
- Deploy: not performed
- Push: not performed
