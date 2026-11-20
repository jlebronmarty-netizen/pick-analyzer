# College evaluation integrity — November 19, 2026

This change corrects the evaluation of stored forecasts. It does not change a
model, generate picks, acquire provider data, rewrite forecasts/results, change
schedules, or certify sportsbook prices or profitability.

## NCAAF: missing errors were counted as zero

The learning reader used `Number.isFinite(Number(absolute_error))`. JavaScript
converts `null` to zero, allowing disputed outcomes with no error into the MAE
denominator. A pure helper now requires an exact `NUMERIC` status and a finite,
nonnegative number. Genuine zero remains eligible; null, strings, booleans and
non-numeric outcomes are excluded. Identical forecast copies count once and
conflicting copies are excluded together, without order-based selection.

The existing learning API retains `marginMae` and `totalMae`, adds `marginN`
and `totalN`, and exposes an audit breakdown. Both learning cards show the
matching sample. The NCAAF board derives its numeric MAE and denominator from
the same helper and distinguishes these from W/L evaluation. Its ledger
adapter also requires an original `PROJECTION` row.

### Production-data audit before publication

Read-only SQL on Pick Analyzer at **2026-11-19 19:32:31 Puerto Rico** reproduced
the bug on the exact learning-reader cohort (latest 3,000 diagnostic rows;
328 actually present). No duplicate forecast IDs occurred in either numeric
market. These are diagnostic rows, not the separate complete forecast ledger.

| Market | Previous denominator | Disputed null errors removed | Valid numeric denominator | Previous MAE | Corrected MAE on this snapshot |
| --- | ---: | ---: | ---: | ---: | ---: |
| Point margin | 108 | 5 | 103 | 13.1612654320988 | 13.8001618122977 |
| Total points | 110 | 6 | 104 | 12.525 | 13.2475961538462 |

The production learning API independently returned the same previous MAEs.
The higher corrected errors describe an honest denominator, not a model
change or a deterioration in the original predictions. This table is a
fixed audit snapshot; natural future collection may change counts.

Reproduction query (SELECT only):

```sql
with sampled as (
  select forecast_id, market, outcome_status, absolute_error
  from public.ncaaf_causal_diagnostics_v1
  order by analyzed_at desc limit 3000
)
select market, count(*) as loaded_rows,
  count(distinct forecast_id) as unique_forecasts,
  count(*) filter (where outcome_status = 'DISPUTE') as disputes,
  count(*) filter (where absolute_error is null) as null_errors,
  count(*) filter (where outcome_status = 'NUMERIC'
    and jsonb_typeof(to_jsonb(absolute_error)) = 'number'
    and absolute_error >= 0) as corrected_n,
  avg(coalesce(absolute_error, 0)) filter (where absolute_error is null
    or jsonb_typeof(to_jsonb(absolute_error)) = 'number') as previous_mae,
  avg(absolute_error) filter (where outcome_status = 'NUMERIC'
    and jsonb_typeof(to_jsonb(absolute_error)) = 'number'
    and absolute_error >= 0) as corrected_mae
from sampled
where market in ('POINT_MARGIN', 'TOTAL_POINTS')
group by market;
```

## NCAAB: timing, identity and sample transparency

The report-only reconciliation now requires the forecast to precede both the
original and corrected tip time, validates exact event identity, and rejects
invalid final timestamps/scores. Permitted home/away correction and a bounded
two-hour tip correction remain supported when genuinely pregame. Equivalent
repeated finals use the earliest valid receipt. The only production caller
is `getNcaabDailyReport`; stored observations are unchanged.

The dashboard exposes the existing margin and total bias, defined as
**projection minus actual**, and explains the full loaded cohort. It also
reports exclusions and counts exact duplicates once while excluding conflicting
event copies together. Filters on the cards do not change this summary.

The production overview read returned 858 observations: 811 forecasts and 47
abstentions. The pure numeric report on that loaded snapshot contained 724
valid finals, 81 pending forecasts and six under review; no duplicate events,
invalid identities, invalid numeric inputs or remaining invalid timestamps.
MAE was 12.945 margin / 14.394 total points, with bias -6.239 / -2.019.
This uses the loaded overview cohort, not the earlier 715-game SQL cohort.

A separate read-only query at 19:33 PR examined the 730 events with archived
final observations. It found zero forecast emissions rendered post-start by
a corrected kickoff within two hours and zero embedded event-ID mismatches.
The new guard therefore addresses a demonstrated code vulnerability, without
claiming that this particular defect inflated the current live NCAAB sample.

## Validation and boundaries

- 17 pure numerical/lifecycle tests pass, including disputed null errors,
  genuine zero, invalid inputs, duplicate conflict/order, and empty samples.
- 101 dashboard multisport tests pass, including new exact-identity and
  corrected-kickoff tests and all 73 original frozen forecast parity cases.
- The college workflow now actually executes both numerical helper suites
  and triggers on all affected evaluator, service, UI and test paths.
- Independent code review found no blocking defect. Full build, Preview and
  GitHub status are checked on the proposed commit before publication.
- The original local build attempts exhausted Node's default heap during
  TypeScript; an increased-heap sequential build and hosted validation are
  tracked in the release checks. No TypeScript gate is disabled.
- Database operations performed for this review were SELECT only. Provider
  calls, new forecasts, historical rewrites, schema changes, environment
  changes, schedule changes and model promotions: zero.

The source-certificate repair is a separate prerequisite PR. This college
change does not modify MLB runtime logic or certification files. Publication
remains separate from preparing and validating the branch.
