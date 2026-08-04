# MC-08F Personalization Experience Certification

Status: PRODUCTION CERTIFIED

## Certification Summary

MC-08F introduces the `personalization_v1` display contract, a `/settings` preference surface, homepage preference rendering and Performance display preference support.

## Local Evidence

Local validation passed:

- MC-08F validator: PASS (20/20)
- MC-08A through MC-08E validators: PASS
- Mission Control validator: PASS (57/57)
- Changed-file ESLint: PASS
- JSON validation: PASS
- Markdown changed-doc link validation: PASS
- Targeted secret scan: PASS
- git diff --check: PASS
- Production build: PASS (398 static pages)

## Production Evidence

Production certification passed on commit `fabe9768cdcad2aca02773741ee44596945c7c59`. Read-only checks returned HTTP 200 for the required production surfaces, rendered homepage/settings/performance MC-08F markers, and observed zero provider calls where reported.

Required production surfaces:

- `/api/system/version`
- `/`
- `/performance`
- `/api/dashboard/today`
- `/api/current-board?mode=current&limit=200`
- `/most-likely`
- `/best-value`
- `/betting-workbench`
- `/game-intelligence`

## Guardrails

Provider calls during certification: 0 expected.

Remote mutations during certification: 0 expected.

Prediction writes, result writes, settlement writes and learning writes: 0 expected.

No model, policy, scheduler or provider behavior changed.

## Production Certification

- Production commit: `fabe9768cdcad2aca02773741ee44596945c7c59`
- Homepage desktop/mobile/dark/light render: PASS
- Settings mobile/light render: PASS
- Performance desktop render: PASS
- Horizontal overflow: none observed
- Provider calls from certification reads: 0 where reported
- Remote mutations from certification reads: 0 where reported
- MC-08G: not started
- MC-03: not started
