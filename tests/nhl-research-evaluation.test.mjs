import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNhlMoneylineResearch} from '../src/lib/nhl-research-evaluation.mjs';

const iso = value => new Date(value).toISOString();
const HOUR = 3600000;
const cutoff = '2026-12-01T00:00:00Z';
function game(index = 0, homeWon = true) {
  const start = Date.parse('2026-11-20T00:00:00Z') + index * 24 * HOUR;
  const freeze = start - 2 * HOUR, original = start - 22 * HOUR;
  const eventId = `nhl:202602${String(800 + index).padStart(4, '0')}`;
  const prediction = {event_id: eventId, scheduled_at: iso(start), created_at: iso(original), body: {
    eventId, scheduledAt: iso(start), capturedAt: iso(original), model: 'DRATINGS_PUBLIC_V1',
    homeId: 1, awayId: 2, homeProbability: 0.6, awayProbability: 0.4,
  }};
  const outcome = {event_id: eventId, observed_at: iso(start + 3 * HOUR), body: {
    eventId, scheduledAt: iso(start), capturedAt: iso(start + 3 * HOUR), homeId: 1, awayId: 2,
    homeScore: homeWon ? 4 : 1, awayScore: homeWon ? 1 : 4,
  }};
  const late = {event_id: eventId, model_version: 'NHL_LATE_PROBABLE_CALIBRATION_SHADOW_V6',
    scheduled_at: iso(start), frozen_at: iso(freeze), source_completed_at: iso(freeze - 60000),
    created_at: iso(freeze + 1000), home_team_id: 1, away_team_id: 2,
    official_pick: false, production_eligible: false, goalie_snapshot_id: `goalie-${index}`,
    goalie_evidence: {status: 'PREGAME_PROBABLE_SOURCE_ONLY', observedAt: iso(freeze - 40000),
      sourceSnapshotId: `goalie-${index}`, home: {displayName: 'Home Goalie'}, away: {displayName: 'Away Goalie'},
      isConfirmedStarter: false, goalieAdjustmentApplied: false},
    calibration: {status: 'PROSPECTIVE_TEST_ONLY', holdoutPassed: false, officialPromotion: false,
      expectedValue: null, originalDratingsHome: 0.6, dratingsOriginalObservedAt: iso(original),
      candidateHome: 0.56, candidateAway: 0.44,
      rolling: {status: 'FROZEN_CANDIDATE_ELIGIBLE', priorGames: 40},
      circaPrice: {status: 'CIRCA_PREGAME_RESEARCH_ONLY', eventId, capturedAt: iso(freeze - 20000),
        marketRuleVerified: false, bookmaker: 'CIRCA', observationId: `quote-${index}`,
        homeNoVig: 0.53875, awayNoVig: 0.46125, homeOdds: -124, awayOdds: 111}},
    market_proxies: {homeMoneylineProxy: 0.52}};
  const early = {event_id: eventId, model_version: 'NHL_SCORES_POISSON_SHADOW_V1',
    scheduled_at: iso(start), frozen_at: iso(start - 12 * HOUR), source_completed_at: iso(start - 12 * HOUR - 1000),
    created_at: iso(start - 12 * HOUR + 1000), home_team_id: 1, away_team_id: 2,
    official_pick: false, production_eligible: false,
    projection: {homeGoals: 3.1, awayGoals: 2.8, homeMargin: 0.3, totalGoals: 5.9},
    market_proxies: {homeMoneylineProxy: 0.55, homePucklineCoverProxy: 0.3, overGoalsProxy: 0.5}};
  return {prediction, outcome, early, late};
}
function input(games) {
  return {cutoff, predictions: games.map(g => g.prediction), outcomes: games.map(g => g.outcome),
    early: games.map(g => g.early), late: games.map(g => g.late)};
}
const reason = (report, value) => report.exclusions.some(row => row.reason === value);

test('same-game comparison reproduces hand-calculated Brier, log loss, timing and existing validator', () => {
  const data = input([game()]), before = JSON.stringify(data), result = buildNhlMoneylineResearch(data);
  assert.equal(JSON.stringify(data), before, 'source forecasts must remain immutable');
  assert.equal(result.cohorts.fourWay.games, 1);
  assert.equal(result.cohorts.fourWay.universeGames, 1);
  for (const model of result.comparisons) {
    assert.equal(model.games, 1);
    assert.equal(model.hits, 1);
    assert.ok(Math.abs(model.brier - result.validation.exactSameGamePairedMetrics[model.model].brier) <= 0.0000051);
  }
  assert.equal(result.comparisons[0].brier, 0.16);
  assert.equal(result.comparisons[0].logLoss, Number((-Math.log(0.6)).toFixed(6)));
  assert.equal(result.timing[0].medianMinutes, 1320);
  assert.equal(result.timing[2].medianMinutes, 120);
  assert.equal(result.sameInformationSet, false);
  assert.equal(result.modelPromotionAllowed, false);
  assert.equal(result.pairedDifferences[0].brier.interval95, null, 'one game cannot supply a useful bootstrap interval');
  assert.ok(result.exclusionSummary.every(row => typeof row.reasonLabel === 'string'));
});

test('calibration bins preserve empty bins and never turn missing data into a zero rate', () => {
  const result = buildNhlMoneylineResearch(input([game(0, true), game(1, false)]));
  for (const model of result.calibration) {
    assert.equal(model.bins.reduce((sum, bin) => sum + bin.games, 0), 2);
    for (const bin of model.bins) {
      if (bin.games) { assert.equal(bin.observedHomeWinRate, 0.5); assert.ok(bin.interval95); }
      else { assert.equal(bin.observedHomeWinRate, null); assert.equal(bin.meanProbability, null); assert.equal(bin.interval95, null); }
    }
  }
});

test('all four models share one cohort even when other forecasts are available', () => {
  const a = game(), b = game(1), c = game(2);
  b.late.calibration.status = 'NOT_YET_ELIGIBLE';
  b.late.calibration.candidateHome = b.late.calibration.candidateAway = null;
  b.late.calibration.circaPrice = null;
  const data = input([a, b, c]); data.late.pop();
  const result = buildNhlMoneylineResearch(data);
  assert.equal(result.cohorts.fourWay.games, 1);
  assert.equal(result.cohorts.dratingsOriginal.games, 3);
  assert.equal(result.cohorts.earlyPoisson.games, 3);
  assert.equal(result.cohorts.fourWay.excludedGames, 2);
  assert.ok(reason(result, 'FOUR_MODEL_PROBABILITIES_NOT_AVAILABLE'));
  assert.ok(reason(result, 'NO_VALID_V6_FREEZE_AT_CUTOFF'));
  assert.ok(result.comparisons.every(row => row.games === 1));
});

test('late backfilled outcomes and future receipts cannot enter an earlier report cutoff', () => {
  const a = game(), b = game(1), data = input([a, b]);
  data.cutoff = iso(Date.parse(b.outcome.body.scheduledAt) + HOUR);
  const result = buildNhlMoneylineResearch(data);
  assert.equal(result.cohorts.fourWay.games, 1);
  assert.equal(result.cohorts.dratingsOriginal.games, 1);
  assert.ok(reason(result, 'AFTER_REPORT_CUTOFF'));
  assert.ok(reason(result, 'FINAL_NOT_AVAILABLE_AT_CUTOFF'));
});

test('copied DRatings probability and source timestamp must match the immutable original', () => {
  for (const mutate of [
    item => { item.late.calibration.originalDratingsHome = 0.7; },
    item => { item.late.calibration.dratingsOriginalObservedAt = iso(Date.parse(item.late.frozen_at) + 1000); },
    item => { item.prediction.body.capturedAt = 'invalid'; },
    item => { item.prediction.body.eventId = 'nhl:2026020000'; },
  ]) {
    const value = game(); mutate(value);
    const result = buildNhlMoneylineResearch(input([value]));
    assert.equal(result.cohorts.fourWay.games, 0);
    assert.ok(reason(result, 'ORIGINAL_DRATINGS_PROVENANCE_NOT_VERIFIED'));
  }
});

test('existing V6 source and goalie captured-at guards are reused', () => {
  for (const mutate of [
    item => { item.late.source_completed_at = iso(Date.parse(item.late.frozen_at) + 1000); },
    item => { item.late.goalie_evidence.observedAt = iso(Date.parse(item.late.frozen_at) + 1000); },
    item => { item.late.official_pick = true; },
  ]) {
    const value = game(); mutate(value);
    const result = buildNhlMoneylineResearch(input([value]));
    assert.equal(result.cohorts.fourWay.games, 0);
    assert.ok(reason(result, 'INVALID_FROZEN_ASOF_CONTRACT'));
  }
});

test('stored final identity, nonnegative score and body timestamp are required', () => {
  for (const mutate of [
    item => { item.outcome.body.eventId = 'nhl:2026020000'; },
    item => { item.outcome.body.homeScore = -1; },
    item => { item.outcome.body.capturedAt = 'not-a-date'; },
  ]) {
    const value = game(); mutate(value);
    const result = buildNhlMoneylineResearch(input([value]));
    assert.equal(result.cohorts.fourWay.games, 0);
    assert.equal(result.cohorts.dratingsOriginal.games, 0);
    assert.equal(result.cohorts.earlyPoisson.games, 0);
    assert.ok(reason(result, 'INVALID_FINAL_IDENTITY_TIME_OR_SCORE'));
  }
});

test('repeated same-game freezes cannot inflate denominators or cherry-pick conflicts', () => {
  const data = input([game()]);
  data.late.push(structuredClone(data.late[0]));
  const identical = buildNhlMoneylineResearch(data);
  assert.equal(identical.cohorts.fourWay.games, 1);
  assert.ok(reason(identical, 'IDENTICAL_DUPLICATE_IGNORED'));
  data.late[1].calibration.candidateHome = 0.9;
  data.late[1].calibration.candidateAway = 0.1;
  const conflict = buildNhlMoneylineResearch(data);
  assert.equal(conflict.cohorts.fourWay.games, 0);
  assert.ok(reason(conflict, 'CONFLICTING_DUPLICATE_EVENT'));
  assert.equal(conflict.coverage.late.distinctGames, 1);
});

test('frozen market arithmetic cannot silently disagree with its saved price pair', () => {
  const value = game();
  value.late.calibration.circaPrice.homeNoVig = 0.9;
  value.late.calibration.circaPrice.awayNoVig = 0.1;
  const result = buildNhlMoneylineResearch(input([value]));
  assert.equal(result.cohorts.fourWay.games, 0);
  assert.ok(reason(result, 'FROZEN_CIRCA_PRICE_PAIR_INCONSISTENT'));
});

test('paired uncertainty is deterministic and grouped by independent event, with date sensitivity', () => {
  const data = input(Array.from({length: 8}, (_, i) => game(i, i % 3 !== 0)));
  const one = buildNhlMoneylineResearch(data);
  const reordered = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? [...value].reverse() : value]));
  const two = buildNhlMoneylineResearch(reordered);
  assert.deepEqual(one.pairedDifferences, two.pairedDifferences);
  for (const pair of one.pairedDifferences) {
    assert.equal(pair.games, 8);
    assert.equal(pair.dayBlockSensitivity.blocks, 8);
    assert.ok(pair.brier.interval95.low < pair.brier.interval95.high);
    assert.equal(pair.validatedImprovement, false);
  }
});

test('unavailable and empty sources return JSON-safe honest empty states', () => {
  const empty = buildNhlMoneylineResearch(input([]));
  assert.equal(empty.status, 'NO_MATCHED_GAMES');
  assert.ok(empty.comparisons.every(row => row.games === 0 && row.brier === null && row.accuracy === null));
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(empty)));
  const missing = buildNhlMoneylineResearch({...input([]), outcomes: undefined});
  assert.equal(missing.status, 'UNAVAILABLE');
  assert.equal(missing.coverage.outcomes.available, false);
  const badCutoff = buildNhlMoneylineResearch({...input([game()]), cutoff: 'invalid'});
  assert.equal(badCutoff.status, 'UNAVAILABLE');
  assert.equal(badCutoff.cohorts.fourWay.games, 0);
});
