# MLB Data Acquisition Completion

Status: Discovery Integration Complete
Version: V1

## Completed

- SportsDataIO MLB endpoint catalog exists.
- Discovery Lab and enterprise endpoints are separated.
- Stored import evidence is visible through `/api/providers/sportsdataio/discovery`.
- Field quality and sanitized sample policy are documented.
- Projection reactivation remains blocked where identity, starter, lineup or feature quality evidence is insufficient.
- Current production markets remain moneyline, run line and full game total.

## Not Completed

- No new provider calls were made.
- No new historical import was run.
- No detailed injury feed access was added.
- No confirmed lineup feed was added.
- No player-prop or unsupported market lifecycle was activated.
- No projection rows were reactivated for user display by this mission.

## Safe Next Action

Use the discovery API to identify the narrowest next provider verification before spending quota. The preferred next verification remains a controlled, explicitly approved endpoint/date scope rather than broad historical acquisition.
