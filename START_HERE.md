# Start Here

Read this before changing code, data, routes, providers, settlement, learning or product UI.

## What Pick Analyzer Is

Pick Analyzer is a betting intelligence platform. It is not a sportsbook, picks-selling service or generic statistics dashboard.

The product exists to answer one question:

> What is the smartest betting decision I can make today?

## Decision Core

Decision Core is the public identity of the intelligence system behind Pick Analyzer.

Use Decision Core terminology when describing the intelligence layer:

- Decision Core Analysis
- Decision Core Confidence
- Decision Core Health
- Decision Core Learning
- Decision Core Journal

Decision Core must preserve recommendation policy, settlement truth, learning integrity and user trust.

## Documentation Hierarchy

1. [Master Program V2](docs/MASTER_PROGRAM/PICK_ANALYZER_MASTER_PROGRAM_V2.md)
2. [Current Release Plan](docs/RELEASES/RELEASE_01_EXECUTION_PLAN.md)
3. Work Package or sprint instructions
4. Implementation
5. Validation
6. Deployment
7. Production certification
8. Release review

The Master Program is the source of truth. If the product direction changes, update the Master Program first.

## Repository Map

- [Documentation Index](docs/README.md)
- [Mission Control](docs/MISSION_CONTROL/README.md)
- [Release Documents](docs/RELEASES/README.md)
- [Product Documents](docs/PRODUCT/README.md)
- [Architecture Documents](docs/ARCHITECTURE/README.md)
- [Certification Documents](docs/CERTIFICATION/README.md)
- [History Documents](docs/HISTORY/README.md)

## Development Rules

- Do not fabricate data, probabilities, results or confidence.
- Do not recommend unsupported markets.
- Do not silently leave completed games unsettled.
- Do not bypass validation or production certification.
- Do not commit unrelated files.
- Do not start a future release until the current sprint or release is closed.
- Use Mission Control for current execution state, next eligible work and stop conditions.

## Sprint 0 Rule

Sprint 0 organizes the repository foundation only. It does not change product behavior, APIs, providers, predictions, settlement, learning or UI.
