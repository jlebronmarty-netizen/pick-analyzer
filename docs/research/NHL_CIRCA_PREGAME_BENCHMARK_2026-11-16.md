# NHL — Circa vs DRatings paired pregame research audit (2026-11-16)

**Scope:** Pick Analyzer, 2026–27 NHL season. Research-only, no official forecasts, picks, cron, database schema, or production changes. Source: existing `public.nhl_free_predictions_v1`, `public.nhl_free_outcomes_v1`, and `public.nhl_free_quote_observations_v1` in the Pick Analyzer Supabase project. No new provider calls.

## Evidence from read-only SQL

- Recorded DRatings ML predictions: 85; outcomes matched: 83; remaining two were from the ongoing Nov 16 slate.
- Entire 83-result cohort: DRatings directional ML 51/83 = 61.45%; Brier 0.2334. This is not automatically the same cohort as the priced comparison.
- 64 completed games had two-sided Circa ML quotes captured before the game start.
- **On the paired 64 only:** DRatings Brier 0.2403, Circa normalized no-vig Brier 0.2291; DRatings 37/64 directional, Circa 41/64.
- Mean paired Brier difference `DRatings - Circa` 0.01114. Simple IID-normal approximate 95% CI 0.00154 to 0.02073, **not** a formal validation certificate: game correlation, nonrandom coverage, repeated hypothesis exploration, source bias and limited season coverage make uncertainty larger.
- Frozen ex-ante 70% Circa / 30% DRatings blend: Brier 0.2322; worse than pure Circa in the same paired cohort.
- Chronological halves, not model selection: earlier n=32 DRatings 0.2097, Circa 0.2067, blend 0.2074; later n=32 DRatings 0.2708, Circa 0.2516, blend 0.2569.
- Disagreement grouped after inspection (exploratory): <3pp n=32 DRatings 0.2161, market 0.2147; 3–7pp n=27 0.2473 vs 0.2392; >=7pp n=5 0.3569 vs 0.2673. **Do not turn five games into a betting rule.**
- Seven Poisson challenger SHADOW entries: all frozen before game start, zero eligible official picks. Five outcomes available at audit; directional ML 2/5, research Over 5.5 3/5, hypothetical home -1.5 3/5. These are proxies, *not* validated real contracts.
- Poisson freeze ledger: none of seven with `fullGameOTSOResolved`, `confirmedBookContract` or `marketOddsAvailable` true; mean hypothetical tie mass 0.1600.

## Reproducible paired ML comparison (read-only)

```sql
WITH games AS (
  SELECT p.event_id, p.scheduled_at,
         (p.body->>'homeProbability')::float8 AS dratings_home,
         CASE WHEN (o.body->>'homeScore')::int > (o.body->>'awayScore')::int
              THEN 1.0 ELSE 0.0 END AS home_won
  FROM public.nhl_free_predictions_v1 p
  JOIN public.nhl_free_outcomes_v1 o USING (event_id)
), quotes AS (
  SELECT q.event_id, q.captured_at,
         (q.body->>'homeOdds')::float8 AS home_american,
         (q.body->>'awayOdds')::float8 AS away_american,
         ROW_NUMBER() OVER (PARTITION BY q.event_id ORDER BY q.captured_at DESC) AS rn
  FROM public.nhl_free_quote_observations_v1 q
  JOIN games g ON g.event_id=q.event_id
  WHERE q.captured_at < g.scheduled_at
    AND q.body->>'homeOdds' IS NOT NULL
    AND q.body->>'awayOdds' IS NOT NULL
    AND q.body->>'sportsbook' = 'CIRCA'
), paired AS (
  SELECT g.*,
      (CASE WHEN q.home_american<0 THEN -q.home_american/(100-q.home_american)
            ELSE 100/(100+q.home_american) END)
      / ((CASE WHEN q.home_american<0 THEN -q.home_american/(100-q.home_american)
              ELSE 100/(100+q.home_american) END)
         + (CASE WHEN q.away_american<0 THEN -q.away_american/(100-q.away_american)
                 ELSE 100/(100+q.away_american) END)) AS circa_novig_home
  FROM games g JOIN quotes q ON g.event_id=q.event_id AND q.rn=1
), losses AS (
  SELECT *, POWER(dratings_home-home_won,2) AS dratings_brier,
     POWER(circa_novig_home-home_won,2) AS circa_brier,
     POWER((0.7*circa_novig_home+0.3*dratings_home)-home_won,2) AS blend_brier
  FROM paired
)
SELECT COUNT(*) AS paired_games,
  ROUND(AVG(dratings_brier)::numeric,4) AS dratings_brier,
  ROUND(AVG(circa_brier)::numeric,4) AS circa_brier,
  ROUND(AVG(blend_brier)::numeric,4) AS blend_70_market_30_dratings,
  SUM(((dratings_home>=0.5)=(home_won=1))::int) AS dratings_directional_correct,
  SUM(((circa_novig_home>=0.5)=(home_won=1))::int) AS circa_directional_correct
FROM losses;
```

## Protocol before any model improvement claim

1. Preserve latest **pre-game** Circa source evidence by matchup identity; check what scoring-period/book contract is actually quoted (including OT/SO), price timestamp, and both sides. Reject unverifiable odds.
2. Evaluate prospectively at a fixed cutoff, on one observation per game, comparing Brier, log loss, calibration, accuracy, and prices at a common time. Maintain an immutable untouched holdout and paired uncertainty; do not tune using test period.
3. For puck line and totals, join real same-line contracts and rules first. Do not grade fixed research -1.5/5.5 proxies as quoted bets or infer ROI from unpriced samples.
4. For Poisson, replace 50/50 simulated tie allocation with a **separate researched OT/SO component** using only prior evidence; evaluate its contribution on future holdout, not this tiny prospective n=5.
5. Evaluate PP/PK, fatigue, goaltender form, verified starter status and player shooting rates as **lagged** candidate features, ablate one at a time, requiring consistent improvement over the paired no-vig reference before promotion.
6. Continue normal free archived ingestion and shadow freezing; monitor provider failures and settled-game reconciliation. Keep all official picks, MLB, NBA, other sports and scheduled jobs unchanged.

**Decision:** There is no currently validated Pick-specific NHL accuracy improvement. The empirical finding supports using Circa as a benchmark and possible probability anchor in research, **not** an official automatic substitute or a claimed profitable betting system.
