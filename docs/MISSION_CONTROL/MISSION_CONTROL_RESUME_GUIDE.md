# Mission Control Resume Guide

Use this guide when resuming Pick Analyzer work.

## Required Opening Checks

Run:

```powershell
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Then read:

- `START_HERE.md`
- `docs/PROJECT_STATUS.md`
- `docs/MASTER_ROADMAP.md`
- `docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json`
- `docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md`
- `docs/MISSION_CONTROL/MISSION_CONTROL_STOP_CONDITIONS.md`

## Reusable Continuation Prompt

```text
Continue Pick Analyzer V2 from the current repository state.

Read START_HERE.md, docs/PROJECT_STATUS.md, docs/MASTER_ROADMAP.md and docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json.

Do not restart completed releases or OE-003 work.
Do not modify prediction formulas, Official Picks, Kelly, settlement, learning, scheduler cadence or provider contracts unless the active mission explicitly authorizes it.
Protect unrelated dirty files.

Use Mission Control to identify the next READY mission.
Before editing, confirm dependencies and stop conditions.
Execute only one bounded mission.
Run targeted validation first, then broader validation.
Commit only intended files.
Push once and observe automatic deployment only when runtime changes require it.
Stop after the mission certification.
```

## Resume Decision Rules

- If `MC-00` is not production-certified, finish Mission Control certification first.
- If a provider call is required, stop unless the mission explicitly authorizes it.
- If a sport lacks canonical event/result/settlement evidence, block that sport only.
- If a model change is proposed, require the statistical experimentation workflow and human approval.
