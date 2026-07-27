# Historical Data Completion Baseline V3

Generated: 2026-07-27T02:27:13.343Z

This baseline is read-only and uses stored production-compatible tables only. It performs no provider calls, no imports, no feature rebuilds, no prediction generation, no epoch seeding and no production mutations.

## Summary

- Sports audited: 8
- Total stored rows observed: 263805
- Provider calls: 0
- Remote mutations: 0
- Production mutations: 0

| Sport | Previous season | Current season | Rows | Core coverage | Overall coverage | Reliability | Earliest | Latest | Providers |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| MLB | 2025 | 2026 | 257753 | 100% | 95% | CORE_AVAILABLE | 2025-03-18T10:10:00+00:00 | 2026-09-27T19:20:00+00:00 | PlayerID, abbreviation, awayTeamId, event, game, globalGameId, homeTeamId, player, provider_variant, sportsdataio, sportsdataio_game_id, team, the-odds-api |
| NBA | 2024-25 | 2025-26 | 5404 | 80% | 84% | PARTIAL | 2025-12-25T21:00:00+00:00 | 2026-07-14T02:33:35.399+00:00 | awayTeamId, canonical, event, homeTeamId, nbaDotCom, player, sportsdataio, stat, team, the-odds-api |
| NFL | 2025 | 2026 | 380 | 0% | 11% | PARTIAL | 2026-09-10T00:15:00+00:00 | 2026-10-25T17:00:00+00:00 | N/A |
| NHL | 2024-25 | 2025-26 | 0 | 0% | 0% | EMPTY_OR_BLOCKED | N/A | N/A | N/A |
| Soccer | competition_specific | competition_specific | 0 | 0% | 0% | EMPTY_OR_BLOCKED | N/A | N/A | N/A |
| BSN | 2025 | 2026 | 268 | 80% | 53% | PARTIAL | 2026-06-20T00:00:00+00:00 | 2026-07-19T01:22:36.381+00:00 | official_bsn_homepage |
| Tennis | event_driven_2025 | event_driven_2026 | 0 | 0% | 0% | EMPTY_OR_BLOCKED | N/A | N/A | N/A |
| UFC | event_driven_2025 | event_driven_2026 | 0 | 0% | 0% | EMPTY_OR_BLOCKED | N/A | N/A | N/A |

## MLB

Reliability: CORE_AVAILABLE
Completeness: core 100%, overall 95%
Blockers: none from required stored-data checks

| Dataset | Rows | Classification | Earliest | Latest | Duplicate indicator | Missing required samples | Providers |
| --- | ---: | --- | --- | --- | --- | ---: | --- |
| Teams | 30 | AVAILABLE | 2026-07-26T22:44:26.798+00:00 | 2026-07-26T22:44:26.798+00:00 | not_detected_in_sample | 0 | abbreviation, sportsdataio |
| Players | 7389 | AVAILABLE | 2026-07-14T21:51:40.51+00:00 | 2026-07-18T18:06:50.429+00:00 | not_detected_in_sample | 0 | PlayerID, provider_variant, sportsdataio, team |
| Events / schedules | 4922 | AVAILABLE | 2025-03-18T10:10:00+00:00 | 2026-09-27T19:20:00+00:00 | not_detected_in_sample | 0 | awayTeamId, globalGameId, homeTeamId, sportsdataio, sportsdataio_game_id |
| Completed events | 4012 | AVAILABLE | 2025-03-18T10:10:00+00:00 | 2026-07-26T20:05:00+00:00 | not_detected_in_sample | 0 | awayTeamId, globalGameId, homeTeamId, sportsdataio, sportsdataio_game_id |
| Future events | 847 | AVAILABLE | 2026-07-27T18:35:00+00:00 | 2026-09-27T19:20:00+00:00 | not_detected_in_sample | 0 | awayTeamId, globalGameId, homeTeamId, sportsdataio, sportsdataio_game_id |
| Results | 471 | AVAILABLE | 2026-06-21T22:59:45.497713+00:00 | 2026-07-26T23:45:04.029718+00:00 | not_detected_in_sample | 0 | N/A |
| Standings | 60 | AVAILABLE | 2026-07-15T15:23:31.344+00:00 | 2026-07-16T12:05:39.7+00:00 | not_detected_in_sample | 0 | sportsdataio |
| Team / game stats | 2926 | AVAILABLE | 2026-07-15T15:28:42.102+00:00 | 2026-07-16T03:54:22.004+00:00 | not_detected_in_sample | 0 | game, sportsdataio, team |
| Player stats | 47232 | AVAILABLE | 2026-07-14T21:51:40.539+00:00 | 2026-07-21T20:22:40.898+00:00 | not_detected_in_sample | 0 | event, player, sportsdataio, team |
| Boxscores | 2926 | AVAILABLE | 2026-07-15T15:28:42.102+00:00 | 2026-07-16T03:54:22.004+00:00 | not_detected_in_sample | 0 | game, sportsdataio, team |
| Period/quarter/inning scores | 4922 | AVAILABLE | 2025-03-18T10:10:00+00:00 | 2026-09-27T19:20:00+00:00 | not_detected_in_sample | 0 | awayTeamId, globalGameId, homeTeamId, sportsdataio, sportsdataio_game_id |
| Starters / lineups | 27 | AVAILABLE | 2026-07-22T02:15:31.189+00:00 | 2026-07-22T02:15:31.189+00:00 | not_detected_in_sample | 0 | sportsdataio, sportsdataio_game_id |
| Injuries | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Odds snapshots | 48569 | AVAILABLE | 2026-03-26T17:14:49+00:00 | 2026-07-26T22:50:34+00:00 | not_detected_in_sample | 0 | sportsdataio |
| Player props | 11 | AVAILABLE | 2026-07-26T22:48:36+00:00 | 2026-07-26T22:50:34+00:00 | not_detected_in_sample | 0 | the-odds-api |
| Feature snapshots | 72223 | AVAILABLE | N/A | N/A | not_detected_in_sample | 0 | N/A |
| Predictions | 1110 | AVAILABLE | 2026-06-21T23:21:00+00:00 | 2026-07-26T23:20:00+00:00 | not_detected_in_sample | 0 | N/A |
| Settlements | 837 | AVAILABLE | N/A | N/A | not_detected_in_sample | 0 | N/A |
| Provider identities | 59239 | AVAILABLE | 2026-07-14T21:51:40.544+00:00 | 2026-07-26T22:46:14.76+00:00 | not_detected_in_sample | 0 | sportsdataio |

## NBA

Reliability: PARTIAL
Completeness: core 80%, overall 84%
Blockers: results_empty

| Dataset | Rows | Classification | Earliest | Latest | Duplicate indicator | Missing required samples | Providers |
| --- | ---: | --- | --- | --- | --- | ---: | --- |
| Teams | 30 | AVAILABLE | 2026-07-13T12:31:50.169+00:00 | 2026-07-13T12:31:50.169+00:00 | not_detected_in_sample | 0 | canonical, sportsdataio, the-odds-api |
| Players | 579 | AVAILABLE | 2026-07-13T15:39:08.025+00:00 | 2026-07-13T21:08:15.204+00:00 | not_detected_in_sample | 0 | nbaDotCom, sportsdataio |
| Events / schedules | 14 | AVAILABLE | 2025-12-25T21:00:00+00:00 | 2025-12-27T07:00:00+00:00 | not_detected_in_sample | 0 | awayTeamId, homeTeamId, sportsdataio |
| Completed events | 13 | AVAILABLE | 2025-12-25T21:00:00+00:00 | 2025-12-27T07:00:00+00:00 | not_detected_in_sample | 0 | awayTeamId, homeTeamId, sportsdataio |
| Future events | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Results | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Standings | 60 | AVAILABLE | 2026-07-12T03:55:34.429+00:00 | 2026-07-13T15:08:52.648+00:00 | not_detected_in_sample | 0 | sportsdataio |
| Team / game stats | 18 | AVAILABLE | 2026-07-13T15:08:52.649+00:00 | 2026-07-13T15:08:52.649+00:00 | not_detected_in_sample | 0 | sportsdataio |
| Player stats | 918 | AVAILABLE | 2026-07-14T02:33:35.374+00:00 | 2026-07-14T02:33:35.395+00:00 | not_detected_in_sample | 0 | event, player, sportsdataio, stat, team |
| Boxscores | 18 | AVAILABLE | 2026-07-13T15:08:52.649+00:00 | 2026-07-13T15:08:52.649+00:00 | not_detected_in_sample | 0 | sportsdataio |
| Period/quarter/inning scores | 14 | AVAILABLE | 2025-12-25T21:00:00+00:00 | 2025-12-27T07:00:00+00:00 | not_detected_in_sample | 0 | awayTeamId, homeTeamId, sportsdataio |
| Starters / lineups | 758 | AVAILABLE | 2026-07-13T21:08:15.199+00:00 | 2026-07-13T21:08:15.212+00:00 | not_detected_in_sample | 0 | player, sportsdataio, team |
| Injuries | 6 | AVAILABLE | 2026-07-13T19:22:36.093+00:00 | 2026-07-13T19:22:36.093+00:00 | not_detected_in_sample | 0 | player, sportsdataio, team |
| Odds snapshots | 540 | PARTIAL_REVIEW_REQUIRED | 2025-12-26T22:59:21+00:00 | 2025-12-27T01:59:59+00:00 | detected | 0 | sportsdataio |
| Player props | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Feature snapshots | 47 | AVAILABLE | N/A | N/A | not_detected_in_sample | 0 | N/A |
| Predictions | 27 | AVAILABLE | 2025-12-27T04:00:00+00:00 | 2025-12-27T07:00:00+00:00 | not_detected_in_sample | 0 | N/A |
| Settlements | 27 | AVAILABLE | N/A | N/A | not_detected_in_sample | 0 | N/A |
| Provider identities | 2335 | AVAILABLE | 2026-07-12T03:55:21.284+00:00 | 2026-07-14T02:33:35.399+00:00 | not_detected_in_sample | 0 | sportsdataio |

## NFL

Reliability: PARTIAL
Completeness: core 0%, overall 11%
Blockers: teams_empty, events_empty, results_empty, odds_empty, identities_empty

| Dataset | Rows | Classification | Earliest | Latest | Duplicate indicator | Missing required samples | Providers |
| --- | ---: | --- | --- | --- | --- | ---: | --- |
| Teams | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Players | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Events / schedules | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Completed events | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Future events | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Results | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Standings | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Team / game stats | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Player stats | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Boxscores | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Period/quarter/inning scores | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Starters / lineups | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Injuries | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Odds snapshots | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Player props | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Feature snapshots | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Predictions | 190 | AVAILABLE | 2026-09-10T00:15:00+00:00 | 2026-10-25T17:00:00+00:00 | not_detected_in_sample | 0 | N/A |
| Settlements | 190 | AVAILABLE | N/A | N/A | not_detected_in_sample | 0 | N/A |
| Provider identities | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |

## NHL

Reliability: EMPTY_OR_BLOCKED
Completeness: core 0%, overall 0%
Blockers: teams_empty, events_empty, results_empty, odds_empty, identities_empty

| Dataset | Rows | Classification | Earliest | Latest | Duplicate indicator | Missing required samples | Providers |
| --- | ---: | --- | --- | --- | --- | ---: | --- |
| Teams | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Players | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Events / schedules | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Completed events | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Future events | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Results | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Standings | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Team / game stats | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Player stats | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Boxscores | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Period/quarter/inning scores | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Starters / lineups | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Injuries | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Odds snapshots | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Player props | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Feature snapshots | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Predictions | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Settlements | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Provider identities | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |

## Soccer

Reliability: EMPTY_OR_BLOCKED
Completeness: core 0%, overall 0%
Blockers: teams_empty, events_empty, results_empty, odds_empty, identities_empty

| Dataset | Rows | Classification | Earliest | Latest | Duplicate indicator | Missing required samples | Providers |
| --- | ---: | --- | --- | --- | --- | ---: | --- |
| Teams | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Players | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Events / schedules | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Completed events | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Future events | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Results | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Standings | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Team / game stats | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Player stats | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Boxscores | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Period/quarter/inning scores | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Starters / lineups | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Injuries | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Odds snapshots | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Player props | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Feature snapshots | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Predictions | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Settlements | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Provider identities | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |

## BSN

Reliability: PARTIAL
Completeness: core 80%, overall 53%
Blockers: odds_empty

| Dataset | Rows | Classification | Earliest | Latest | Duplicate indicator | Missing required samples | Providers |
| --- | ---: | --- | --- | --- | --- | ---: | --- |
| Teams | 12 | AVAILABLE | 2026-07-19T01:22:36.38+00:00 | 2026-07-19T01:22:36.38+00:00 | not_detected_in_sample | 0 | official_bsn_homepage |
| Players | 25 | AVAILABLE | 2026-07-19T01:22:36.381+00:00 | 2026-07-19T01:22:36.381+00:00 | not_detected_in_sample | 0 | official_bsn_homepage |
| Events / schedules | 38 | AVAILABLE | 2026-06-20T00:00:00+00:00 | 2026-07-18T00:00:00+00:00 | not_detected_in_sample | 0 | official_bsn_homepage |
| Completed events | 38 | AVAILABLE | 2026-06-20T00:00:00+00:00 | 2026-07-18T00:00:00+00:00 | not_detected_in_sample | 0 | official_bsn_homepage |
| Future events | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Results | 2 | AVAILABLE | 2026-06-22T20:48:27.963349+00:00 | 2026-06-22T20:48:27.963349+00:00 | not_detected_in_sample | 0 | N/A |
| Standings | 12 | AVAILABLE | 2026-07-19T01:22:36.38+00:00 | 2026-07-19T01:22:36.38+00:00 | not_detected_in_sample | 0 | official_bsn_homepage |
| Team / game stats | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Player stats | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Boxscores | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Period/quarter/inning scores | 38 | AVAILABLE | 2026-06-20T00:00:00+00:00 | 2026-07-18T00:00:00+00:00 | not_detected_in_sample | 0 | official_bsn_homepage |
| Starters / lineups | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Injuries | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Odds snapshots | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Player props | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Feature snapshots | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Predictions | 8 | AVAILABLE | 2026-06-22T23:00:00+00:00 | 2026-06-22T23:55:00+00:00 | not_detected_in_sample | 0 | N/A |
| Settlements | 8 | AVAILABLE | N/A | N/A | not_detected_in_sample | 0 | N/A |
| Provider identities | 87 | AVAILABLE | 2026-07-19T01:22:36.381+00:00 | 2026-07-19T01:22:36.381+00:00 | not_detected_in_sample | 0 | official_bsn_homepage |

## Tennis

Reliability: EMPTY_OR_BLOCKED
Completeness: core 0%, overall 0%
Blockers: teams_empty, events_empty, results_empty, odds_empty, identities_empty

| Dataset | Rows | Classification | Earliest | Latest | Duplicate indicator | Missing required samples | Providers |
| --- | ---: | --- | --- | --- | --- | ---: | --- |
| Teams | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Players | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Events / schedules | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Completed events | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Future events | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Results | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Standings | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Team / game stats | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Player stats | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Boxscores | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Period/quarter/inning scores | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Starters / lineups | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Injuries | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Odds snapshots | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Player props | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Feature snapshots | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Predictions | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Settlements | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Provider identities | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |

## UFC

Reliability: EMPTY_OR_BLOCKED
Completeness: core 0%, overall 0%
Blockers: teams_empty, events_empty, results_empty, odds_empty, identities_empty

| Dataset | Rows | Classification | Earliest | Latest | Duplicate indicator | Missing required samples | Providers |
| --- | ---: | --- | --- | --- | --- | ---: | --- |
| Teams | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Players | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Events / schedules | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Completed events | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Future events | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Results | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Standings | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Team / game stats | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Player stats | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Boxscores | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Period/quarter/inning scores | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Starters / lineups | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Injuries | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Odds snapshots | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Player props | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Feature snapshots | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Predictions | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Settlements | 0 | EMPTY | N/A | N/A | not_applicable | 0 | N/A |
| Provider identities | 0 | BLOCKED_EMPTY | N/A | N/A | not_applicable | 0 | N/A |

## Certification

- `GLOBAL_COVERAGE_BASELINE_V3_PASS`
- `GLOBAL_STORED_DATA_AUDIT_PASS`

