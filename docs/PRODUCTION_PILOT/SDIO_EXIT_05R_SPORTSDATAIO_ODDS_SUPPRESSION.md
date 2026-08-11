# SDIO-EXIT-05R SportsDataIO Odds Suppression

Status: `SDIO_EXIT_05R_REPAIR_LOCAL_PASS_PUSH_REQUIRED`

Starting commit: `1eda943ef4b482774d04f55b87f9e529718f8ffc`

## Verdict

SDIO-EXIT-05R repairs the final blocker found during the zero-SportsDataIO MLB operating-window attempt.

Root cause: `LEGACY_CANONICAL_SPORTSDATAIO_ODDS_ACQUISITION_STILL_ACTIVE`.

The protected scheduler's active market-refresh branch still invoked `executeCanonicalMlbMarketAcquisition`, which called SportsDataIO `GameOddsByDate/{date}`, even when `ODDS_PRIMARY_AUTHORITY_STAGE=STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT`.

## Repair

The adaptive refresh orchestrator now checks the product odds authority before executing the legacy SportsDataIO canonical odds acquisition.

When the product odds authority is `THE_ODDS_API`:

- SportsDataIO routine MLB odds acquisition is suppressed.
- The scheduler records `SKIPPED_AUTHORITY_NOT_SPORTSDATAIO`.
- SportsDataIO HTTP requests remain `0`.
- The Odds API product-primary acquisition still executes.
- Line-versioned re-prediction still runs after The Odds API evidence.
- MLB Official schedule/status/result/starter sync remains unchanged.

When the product odds authority is SportsDataIO:

- Stage 0/legacy and `STAGE_1_DUAL_READ` continue to execute the SportsDataIO canonical path.
- The Odds API remains shadow-only in Stage 1.
- Rollback remains config-only.

## Stage Matrix

| Stage | SportsDataIO Odds HTTP | The Odds API HTTP | Product Authority | R2 Writer |
| --- | --- | --- | --- | --- |
| `SPORTSDATAIO` / `STAGE_0_SPORTSDATAIO_AUTHORITY` | YES | NO | SportsDataIO | Existing behavior |
| `STAGE_1_DUAL_READ` | YES | YES, shadow | SportsDataIO | Non-persistent / would-write |
| `STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT` | NO | YES, product primary | The Odds API | Persistent-capable |

## Safety

- No Vercel variables changed.
- No credentials removed.
- SportsDataIO remains available for explicit rollback.
- No prediction formula, model weight, Official Pick, HR-03, settlement or learning change was made.
- No stale or missing The Odds API price may silently fall back to SportsDataIO; fail-closed states remain the expected product behavior.

## Expected Production Behavior After Deployment

During the next SDIO-EXIT-05 zero-call window:

- SportsDataIO MLB routine odds calls: `0`
- The Odds API natural product-primary calls: `>0` when market refresh is eligible
- MLB Official calls: unchanged
- Current Board product provider: The Odds API
- SportsDataIO role: rollback only

Final classification: `SDIO_EXIT_05R_REPAIR_LOCAL_PASS_PUSH_REQUIRED`
