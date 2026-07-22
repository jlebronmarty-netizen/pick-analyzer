# MLB Learning Scheduler

MLB Learning Brain plugs into the existing operating-day and provider-budget architecture.

## Sequence

1. incremental schedule/event sync
2. probable starter sync when legitimately available
3. player/team evidence sync
4. pregame snapshot creation
5. shadow projection generation
6. final result/player stat sync
7. shadow projection settlement
8. daily learning aggregation
9. drift and health checks
10. weekly or sample-gated challenger training
11. promotion evaluation

Dashboard and learning-center reads never call providers.
