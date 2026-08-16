# NBA-03A Continuous Shadow Scheduler Operating Policy

Status: `NBA_03A_CONTINUOUS_SHADOW_OPERATING_POLICY_CERTIFIED_READY_FOR_PUBLICATION`

Natural NBA Current Era shadow automation is proven, but continuous operation
must not become uncontrolled accumulation. The current sample has 40 pending
shadow rows, 0 settled rows and one event with 16 rows, while stored future NBA
events begin on 2026-10-20. The next problem is rate control, not execution
correctness.

## Certified Initial Policy

Keep the Vercel Cron wake-up cadence at `*/30 * * * *`, but separate wake-up
from permission to create new rows. The scheduler may wake every 30 minutes and
no-op before provider access when continuous collection is not currently useful.

Continuous accumulation is controlled by a new default-off flag:

`NBA_CURRENT_ERA_SHADOW_CONTINUOUS_ENABLED=true`

The repaired verification flag is not a continuous-operation flag and should be
unset after the repaired verification gate is complete:

`NBA_CURRENT_ERA_SHADOW_REPAIRED_VERIFICATION_ENABLED`

Initial continuous caps:

- 3 new rows per provider-consuming run.
- 3 new rows per UTC day.
- 2 The Odds API calls per UTC day.
- soft pause at 60 pending shadow rows.
- hard pending guard remains 75.
- 6 rows per event.
- 3 rows per event-market.

These caps preserve cross-event coverage and keep the system from filling the
pending guard before natural settlement can produce evidence.

## Provider Policy

Continuous operation must not silently reuse the repaired canary override.
Provider-consuming continuous runs require the explicit continuous flag plus the
internal daily row and provider-call caps. SportsDataIO and historical odds calls
remain 0.

## Stop Conditions

Continuous collection must no-op before provider access when the daily row cap,
daily provider-call cap, soft pending pause, hard pending guard, lock conflict or
review state blocks collection. Any isolation violation, duplicate anomaly,
provider failure, persistence failure, schema error, Official Pick exposure,
product exposure, learning/calibration mutation, Historical Replay mutation or
MLB mutation requires explicit human review before resumption.

## Performance

`INSUFFICIENT_CURRENT_ERA_SETTLED_SAMPLE`

The 40 rows are forward shadow evidence only. They do not certify accuracy,
profitability, Official Picks or production recommendations.
