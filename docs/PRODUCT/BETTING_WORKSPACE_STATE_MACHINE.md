# Betting Workspace State Machine

Status: RELEASE 13B

## States

Pregame:

- visible on active board;
- selectable;
- can be added to user bet slip;
- user-entered odds and stake remain separate from model data.

Live:

- not active;
- read-only when visible in History;
- cannot be added to bet slip.

Final:

- removed from active board;
- available through History or results surfaces;
- cannot be added to bet slip.

Settled:

- belongs to results, performance and learning flows;
- does not become a user wager result automatically.

Learned:

- model learning and performance remain separate from personal wagers.

## Release 13B Boundary

This release changes workspace selection and presentation only. It does not change prediction generation, model probabilities, Official Picks, settlement, learning, scheduler cadence, provider behavior or performance scoring.
