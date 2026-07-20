# MLB Projection Integrity

MLB Projection Integrity V1 keeps the Universal Projection Engine sportsbook-independent while preventing weak or invalid rows from appearing as user-facing insight.

Rules:

- Player projections require stable identity.
- Pitcher projections require event starter context.
- Team rows based only on league baselines are blocked from the user board.
- Missing statistics remain missing; they are not converted to zero.
- Physically impossible values are marked invalid rather than silently clamped.
- Projection rank is evidence strength, not betting probability.

Health is exposed through `/api/mlb/projections/health`.

