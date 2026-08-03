# Mission Control

Mission Control is the Pick Analyzer V2 read-only command center.

It answers:

- What is the current certified project state?
- What mission is next?
- Which workstreams are blocked, ready or complete?
- Which stop conditions prevent autonomous execution?
- Which production and repository evidence supports the answer?

Mission Control does not replace the Master Program, Master Roadmap, Project Status or certification artifacts.

P1.3 adds a prospective production-evaluation policy contract. P1.4 is production certified after post-P1.3 persisted prediction evidence was observed on production. P2.0 is production-certified, and P2.1 is locally implemented pending validation and production certification. This does not start MC-03 and does not resume MC-08E.

## Source Of Truth Boundaries

- Master Program: product vision, rules and release methodology.
- Master Roadmap: high-level planned direction.
- Mission Control: current execution state, queue, stop conditions and next eligible mission.
- Project Status: human-readable project journal.
- Certification artifacts: proof of validation and production evidence.
- Mission Control Log: append-only mission history.

## Runtime Surfaces

- `/api/mission-control`
- `/api/mission-control/data-readiness`
- `/mission-control`

Both surfaces are read-only. They do not call providers, write data, start jobs, trigger deployment, settle games, generate predictions or mutate learning.

## Documents

- [Mission Control Program V2](MISSION_CONTROL_PROGRAM_V2.md)
- [Mission Control Checklist](MISSION_CONTROL_CHECKLIST.md)
- [Mission Control Status](MISSION_CONTROL_STATUS.json)
- [Mission Control Log](MISSION_CONTROL_LOG.md)
- [Mission Control Stop Conditions](MISSION_CONTROL_STOP_CONDITIONS.md)
- [Mission Control Queue](MISSION_CONTROL_QUEUE.md)
- [Mission Control Resume Guide](MISSION_CONTROL_RESUME_GUIDE.md)
- [MC-01 Operational Readiness Closure](MC_01_OPERATIONAL_READINESS_CLOSURE.md)
- [MC-02 Multi-Sport Data Readiness](MC_02_MULTI_SPORT_DATA_READINESS.md)
- [MC-08B Rent Play Experience](MC_08B_RENT_PLAY_EXPERIENCE.md)
- [MC-08C Moneyline Bet Experience](MC_08C_MONEYLINE_BET_EXPERIENCE.md)
- [MC-08D Smart Parlay Experience](MC_08D_SMART_PARLAY_EXPERIENCE.md)
