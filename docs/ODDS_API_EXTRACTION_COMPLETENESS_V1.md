# Odds API Extraction Completeness V1

Date: 2026-07-29

Status: STORED-EVIDENCE AUDIT

No provider calls. No production mutation.

## Local Smoke Classification

`LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS`: two independent bounded PowerShell local-smoke wrappers exceeded their hard timeouts. This Odds API completeness certification does not use newly spawned local-server smoke; it uses stored artifacts, validators, build evidence and previously certified production smoke.

## Answers

1. Was all available The Odds API data downloaded? **No.**
2. Was the complete previous season downloaded for every supported sport? **No.**
3. Was the current season downloaded for every supported sport? **No.**
4. Were only odds downloaded, or also scores/results? Stored odds exist for some sports; score/result evidence is limited and not complete for every sport.
5. Which markets were downloaded? moneyline, run_line, spread, total.
6. Were player props downloaded? No certified broad player-prop download.
7. Which sports were skipped or blocked? NBA: Stored data is not enough for end-to-end production prediction, settlement and learning.; NFL: Canonical result/settlement/learning loop and production promotion gates are not complete.; NHL: Canonical result/settlement/learning loop and production promotion gates are not complete.; Soccer: Stored data is not enough for end-to-end production prediction, settlement and learning.; BSN: Stored data is not enough for end-to-end production prediction, settlement and learning.; Tennis: No proven schedule/odds/result/prediction lifecycle.; UFC: Stored data is not enough for end-to-end production prediction, settlement and learning..
8. What remained unqueried? Complete current/previous seasons for non-MLB sports, competition-scoped soccer, broad player props and complete score/result coverage remain unqueried or uncertified because of credit, source entitlement and architecture gates.

## Stored Snapshot Summary

| Sport | Odds rows | Markets | Earliest odds | Latest odds |
| --- | --- | --- | --- | --- |
| MLB | 54289 | moneyline, run_line, spread, total | 2026-03-26T17:14:49+00:00 | 2026-07-12T11:15:20+00:00 |
| NBA | 540 | moneyline, spread, total | 2025-12-26T22:59:21+00:00 | 2025-12-27T01:59:59+00:00 |
| NFL | 1978 | moneyline, spread, total | 2026-07-28T02:52:17+00:00 | 2026-07-28T02:54:11+00:00 |
| NHL | 426 | moneyline, spread, total | 2026-07-28T02:53:36+00:00 | 2026-07-28T02:54:08+00:00 |
| Soccer | 260 | moneyline, spread, total | 2026-07-28T02:50:14+00:00 | 2026-07-28T02:54:22+00:00 |
| BSN | 0 | none | none | none |
| Tennis | 0 | none | none | none |
| UFC | 360 | moneyline, total | 2026-07-28T02:50:28+00:00 | 2026-07-28T02:54:24+00:00 |
