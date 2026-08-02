# Mission Control Stop Conditions

Mission Control stop conditions prevent unsafe autonomous continuation.

| ID | Type | Stop When | Resume Evidence |
| --- | --- | --- | --- |
| MC-STOP-001 | HARD_STOP | Prediction formulas, Official Picks, Kelly, settlement or learning behavior would change outside an approved mission. | Approved mission scope and rollback plan. |
| MC-STOP-002 | PROVIDER_BLOCK | Provider call or quota spend is required without explicit authorization. | Provider, sport, endpoint, call cap, reserve impact and business reason are documented. |
| MC-STOP-003 | SPORT_BLOCK | A sport lacks canonical event, result, odds or settlement crosswalk evidence. | Canonical source and ownership are proven for that sport. |
| MC-STOP-004 | MISSION_BLOCK | A validator exposes a true runtime, policy or certification regression. | Targeted validator and impacted release validators pass. |
| MC-STOP-005 | EXTERNAL_WAIT | Production deployment, GitHub Actions or provider reset evidence is pending. | Timestamped external success evidence is recorded. |
| MC-STOP-006 | HUMAN_APPROVAL | Autonomous execution activation or model promotion is required. | Explicit human approval plus before/after evidence and rollback plan. |

Stop conditions can block one sport or mission without blocking unrelated ready work.
