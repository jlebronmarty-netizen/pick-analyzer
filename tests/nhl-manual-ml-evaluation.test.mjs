import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNhlManualMlEvaluation, nhlManualMlTime, NHL_MANUAL_ML_REGISTERED_AT} from '../src/lib/nhl-manual-ml-evaluation.mjs';

// Synthetic, internally consistent analytical fixtures. These are never provider
// evidence and never enter the real read-only research report.
const clone = x => structuredClone(x);
const day = (n = 0) => new Date(Date.parse('2026-10-01T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const minusDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
const at = (date, hour) => `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;
const variant = (report, id) => report.variants.find(v => v.id === id);
const attempt = (report, id, feature = 'shots_l10') => report.forecastRows.find(r => r.eventId === id && r.variantId === feature);

function fixture(index = 0, {date = day(index), anchorType = 'LATE_RESEARCH_ANCHOR'} = {}) {
  const id = `nhl:202602${String(1000 + index).padStart(4, '0')}`, scheduledAt = at(date, 23);
  const original = at(date, 14), freeze = anchorType === 'STRICT_ORIGINAL' ? original : at(date, 21);
  const generated = at(date, anchorType === 'STRICT_ORIGINAL' ? 12 : 19);
  const available = at(date, anchorType === 'STRICT_ORIGINAL' ? 13 : 20), prior = minusDays(date, 1);
  const team = (side, code) => {
    const home = side === 'home', shift = home ? index % 4 : 1, rest = home ? index % 3 : (index + 1) % 3;
    const recent = Array.from({length: 10}, (_, i) => `nhl:202602${String(5000 + index * 10 + i).padStart(4, '0')}`);
    return {abbrev: code,
      season: {gp: 20, gf: 60 + shift * 2, ga: 60, gf_pg: 3 + shift / 10, ga_pg: 3, through_date: prior},
      last10: {gp: 10, gf: 25 + shift * 2, ga: 25, gf_pg: 2.5 + shift / 5, ga_pg: 2.5,
        shots_for_pg: 27 + shift * 2, shots_against_pg: 28, complete: true, sequence_verified: true,
        newest_date: minusDays(date, rest + 1), oldest_date: minusDays(date, 25), calendar_verified_through: prior,
        expected_event_ids: [...recent], periods: [1, 2, 3].map(period => ({period, gp: 10, goals_coverage: 10, shots_coverage: 10,
          gf_pg: 0.8, ga_pg: 0.8, shots_for_pg: 9, shots_against_pg: 9}))},
      recent_event_ids: recent,
      special_teams: {pp_pct: 0.15 + shift / 50, pk_pct: 0.8, games_played: 20, is_current_gp_match: true, captured_at: at(date, 11), through_date: prior},
      rest: {days_off: rest, verified: true, back_to_back: rest === 0, as_of_date: date, last_game_date: minusDays(date, rest + 1)},
      reported_goalie: {name: 'Synthetic goalie', status: 'NO_CONFIRMADO', checked_at: at(date, 11), source_time: null,
        recent_sample: {gp: 5, sa: 130, ga: 15, saves: 115}},
    };
  };
  const payload = {schema_version: 'NHL_MANUAL_FEATURES_V1', event_id: id, scheduled_at: scheduledAt, available_as_of: generated,
    local_date: date, scope: 'PROSPECTIVE_RESEARCH_INPUTS', forecast_probability: null, official_pick: false, model_promoted: false,
    teams: {away: team('away', 'MTL'), home: team('home', 'BUF')},
    coverage: {both_last10_complete: true, both_goalies_confirmed: false, standings_current: true, standings_through: prior},
    provenance: {slate_verified: true, slate_captured_at: at(date, 11), publication_at: generated, standings_method: 'OFFICIAL_STANDINGS',
      standings_captured_at: at(date, 11), standings_through: prior, special_teams_captured_at: at(date, 11),
      archived_boxscores_last_capture: at(date, 10), history_through: prior}},
    snapshot = {event_id: id, available_as_of: available, inserted_at: available, scheduled_at: scheduledAt,
      source_snapshot_sha256: 'a'.repeat(64), source_run_id: `synthetic-${index}`, schema_version: payload.schema_version, feature_payload: payload};
  const decision = {eventId: id, decisionId: `synthetic-decision-${index}`, modelVersion: 'DRATINGS_PUBLIC_V1', forecastAt: freeze,
    persistedAt: anchorType === 'STRICT_ORIGINAL' ? freeze : freeze.replace('00:00.000', '00:01.000'), originalForecastAt: original,
    originalPersistedAt: original, scheduledAt, homeTeamId: 7, awayTeamId: 8, homeAbbrev: 'BUF', awayAbbrev: 'MTL',
    homeProbability: 0.52, awayProbability: 0.48, referenceSourceId: `synthetic-reference-${index}`, anchorType,
    identityVerified: true, identitySourceId: `synthetic-directory-${index}`, identityCapturedAt: at(date, 10),
    comparators: [{id: 'circa', label: 'Circa sin margen', homeProbability: 0.55, awayProbability: 0.45, availableAt: freeze,
      sourceId: `synthetic-price-${index}`, fullGameContractVerified: false}]};
  const homeWon = index % 4 >= 2;
  const outcome = {eventId: id, scheduledAt, observedAt: at(new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10), 3),
    homeTeamId: 7, awayTeamId: 8, homeAbbrev: 'BUF', awayAbbrev: 'MTL', homeScore: homeWon ? 4 : 2, awayScore: homeWon ? 2 : 4, final: true};
  return {snapshot, decision, outcome};
}

function dataset(count = 46, options = {}) {
  const rows = Array.from({length: count}, (_, i) => fixture(i, options));
  return {snapshots: rows.map(r => r.snapshot), decisions: rows.map(r => r.decision), outcomes: rows.map(r => r.outcome),
    cutoff: '2027-01-01T00:00:00.000Z', policy: {anchorType: options.anchorType ?? 'LATE_RESEARCH_ANCHOR', registeredAt: NHL_MANUAL_ML_REGISTERED_AT}};
}

test('typed empty and invalid requests expose null metrics without a fallback probability', () => {
  const empty = buildNhlManualMlEvaluation(dataset(0));
  assert.equal(empty.status, 'EMPTY');
  assert.equal(empty.variants.length, 4);
  assert.equal(empty.forecastRows.length, 0);
  for (const v of empty.variants) {
    assert.equal(v.candidateMetrics.games, 0); assert.equal(v.candidateMetrics.brier, null);
    assert.equal(v.pairedDifference.vsBaseline.brier.estimate, null);
    assert.equal(v.pairedDifference.vsBaseline.brier.interval95, null);
  }
  assert.equal(buildNhlManualMlEvaluation({cutoff: 'bad'}).status, 'INPUT_UNAVAILABLE');
  assert.equal(buildNhlManualMlEvaluation({...dataset(0), policy: null}).status, 'INPUT_UNAVAILABLE');
  assert.equal(buildNhlManualMlEvaluation({...dataset(0), policy: {ridgePenalty: 1}}).status, 'INPUT_UNAVAILABLE');
  assert.equal(buildNhlManualMlEvaluation({...dataset(0), policy: {referenceModel: 'POISSON'}}).status, 'INPUT_UNAVAILABLE');
});

test('seven unfinalized manual events distinguish original cutoff from the late research anchor', () => {
  const input = dataset(7); input.outcomes = [];
  for (const r of input.snapshots) {
    r.feature_payload.provenance.standings_method = 'PRESERVED_SEED'; r.feature_payload.provenance.standings_captured_at = null;
    const later = clone(r); later.available_as_of = later.inserted_at = r.available_as_of.replace('20:00', '20:15'); later.source_run_id += '-second';
    input.snapshots.push(later); if (input.snapshots.length === 14) break;
  }
  const late = buildNhlManualMlEvaluation(input);
  assert.equal(late.coverage.snapshotRows, 14); assert.equal(late.coverage.matchedAsOf, 7);
  assert.equal(late.coverage.pending, 7); assert.equal(late.coverage.settled, 0);
  assert.equal(late.status, 'INSUFFICIENT_SETTLED_HISTORY');
  assert.equal(variant(late, 'goals_season_l10').eligibleGames, 0);
  for (const id of ['shots_l10', 'special_teams', 'rest']) assert.equal(variant(late, id).eligibleGames, 7);
  assert.ok(late.events.every(r => r.sourceRunId.endsWith('-second')));
  assert.ok(late.forecastRows.every(r => r.candidateHomeProbability === null && r.controlHomeProbability === null));
  const strict = clone(input); strict.policy.anchorType = 'STRICT_ORIGINAL';
  for (const d of strict.decisions) { d.anchorType = 'STRICT_ORIGINAL'; d.forecastAt = d.persistedAt = d.originalForecastAt; }
  const original = buildNhlManualMlEvaluation(strict);
  assert.equal(original.coverage.validDecisions, 7); assert.equal(original.coverage.matchedAsOf, 0); assert.equal(original.coverage.noSnapshotAsOf, 7);
});

test('selection is the last persisted version before the individual anchor, with no fallback from an invalid latest row', () => {
  const input = dataset(1); input.outcomes = [];
  const future = clone(input.snapshots[0]); future.source_run_id = 'after-anchor';
  future.available_as_of = future.inserted_at = future.available_as_of.replace('20:', '22:');
  future.feature_payload.teams.home.last10.shots_for_pg = 99;
  input.snapshots.push(future);
  assert.equal(buildNhlManualMlEvaluation(input).events[0].sourceRunId, 'synthetic-0');
  future.available_as_of = future.inserted_at = future.available_as_of.replace('22:', '20:');
  future.available_as_of = future.inserted_at = future.available_as_of.replace('00:00.000', '30:00.000');
  future.feature_payload.scheduled_at = '2026-10-01T23:00:00.000001Z';
  const invalid = buildNhlManualMlEvaluation(input);
  assert.equal(invalid.coverage.matchedAsOf, 0);
  assert.ok(invalid.exclusions.some(r => r.reason === 'INVALID_MANUAL_CONTRACT'));
});

test('microsecond boundaries remain strict and explicit-zone timestamps are required', () => {
  assert.equal(nhlManualMlTime('2026-11-23T22:07:27.520001+00:00') - nhlManualMlTime('2026-11-23T22:07:27.520000Z'), 1);
  assert.equal(nhlManualMlTime('2026-02-30T10:00:00Z'), null);
  assert.equal(nhlManualMlTime('2026-11-23T22:07:27'), null);
  assert.equal(nhlManualMlTime('2026-11-23T24:00:00Z'), null);
  const input = dataset(1); input.outcomes = [];
  input.snapshots[0].available_as_of = input.snapshots[0].inserted_at = input.decisions[0].forecastAt.replace('.000Z', '.000001Z');
  assert.equal(buildNhlManualMlEvaluation(input).coverage.matchedAsOf, 0);
  input.snapshots[0].available_as_of = input.snapshots[0].inserted_at = input.decisions[0].forecastAt;
  assert.equal(buildNhlManualMlEvaluation(input).coverage.matchedAsOf, 1);
  input.cutoff = input.snapshots[0].available_as_of.replace('.000Z', '.000001Z');
  input.decisions[0].persistedAt = input.decisions[0].forecastAt;
  assert.equal(buildNhlManualMlEvaluation(input).coverage.matchedAsOf, 1);
});

test('each fit uses forty prior independent events, identical control rows, and training-only scaling', () => {
  const input = dataset(), original = clone(input), report = buildNhlManualMlEvaluation(input);
  assert.equal(report.status, 'DESCRIPTIVE_REPLAY_AVAILABLE'); assert.deepEqual(input, original);
  const last = attempt(report, input.decisions[45].eventId), first = attempt(report, input.decisions[40].eventId);
  assert.equal(first.trainingGames, 40); assert.equal(last.trainingGames, 45);
  assert.equal(new Set(last.trainingEventIds).size, 45);
  assert.ok(!last.trainingEventIds.includes(last.eventId));
  assert.ok(nhlManualMlTime(last.trainingMaxObservedAt) < nhlManualMlTime(last.forecastAt));
  assert.equal(last.classification, 'ASOF_REPLAY'); assert.equal(last.issuedAt, null); assert.equal(last.prospectiveForecastIssued, false);
  assert.ok(last.candidateHomeProbability > 0 && last.candidateHomeProbability < 1);
  assert.ok(last.controlHomeProbability > 0 && last.controlHomeProbability < 1);
  const expectedMean = input.snapshots.slice(0, 45).reduce((sum, r) => {
    const h = r.feature_payload.teams.home.last10, a = r.feature_payload.teams.away.last10;
    return sum + (h.shots_for_pg - h.shots_against_pg) - (a.shots_for_pg - a.shots_against_pg);
  }, 0) / 45;
  assert.equal(last.trainingStandardization[0].mean, expectedMean);
  assert.equal(attempt(report, input.decisions[39].eventId).candidateHomeProbability, null);
  const v = variant(report, 'shots_l10');
  assert.equal(v.scoredGames, 6); assert.equal(v.baselineMetrics.games, 6); assert.equal(v.controlMetrics.games, 6); assert.equal(v.candidateMetrics.games, 6);
  assert.ok(v.pairedDifference.vsBaseline.brier.interval95);
  assert.ok(v.pairedDifference.vsInterceptOnly.brier.interval95);
  assert.equal(v.calibration.candidate.reduce((n, b) => n + b.games, 0), 6);
  const comparator = v.comparators[0];
  assert.equal(comparator.games, 6); assert.deepEqual(comparator.eventIds, v.scoredEventIds);
  assert.equal(comparator.baselineMetrics.games, 6); assert.equal(comparator.controlMetrics.games, 6);
  assert.equal(comparator.candidateMetrics.games, 6); assert.equal(comparator.comparatorMetrics.games, 6);
  assert.equal(report.policy.ridgePenalty, 10); assert.equal(report.policy.interceptPenalized, false);
  assert.equal(report.modelPromoted, false); assert.equal(report.databaseWrites, 0); assert.equal(report.providerCalls, 0);
});

test('changing the target label or adding a later result revision cannot change its earlier fit', () => {
  const input = dataset(), before = buildNhlManualMlEvaluation(input), target = input.decisions.at(-1).eventId;
  [input.outcomes.at(-1).homeScore, input.outcomes.at(-1).awayScore] = [input.outcomes.at(-1).awayScore, input.outcomes.at(-1).homeScore];
  const revision = clone(input.outcomes[0]);
  [revision.homeScore, revision.awayScore] = [revision.awayScore, revision.homeScore];
  revision.observedAt = '2026-12-01T10:00:00.000Z'; input.outcomes.push(revision);
  const after = buildNhlManualMlEvaluation(input);
  assert.deepEqual(attempt(after, target), attempt(before, target));
  assert.ok(after.exclusions.some(r => r.reason === 'CONFLICTING_DUPLICATE_OUTCOME'));
  assert.equal(after.coverage.settled, before.coverage.settled - 1);
});

test('after-cutoff duplicates never quarantine an earlier valid snapshot, decision, or outcome', () => {
  const input = dataset(1), before = buildNhlManualMlEvaluation(input);
  const d = clone(input.decisions[0]); d.homeProbability = 0.8; d.awayProbability = 0.2; d.persistedAt = '2027-01-02T10:00:00Z';
  const o = clone(input.outcomes[0]); o.observedAt = '2027-01-02T10:00:00Z'; o.homeScore = 9;
  const s = clone(input.snapshots[0]); s.inserted_at = s.available_as_of = '2027-01-02T10:00:00Z';
  input.decisions.push(d); input.outcomes.push(o); input.snapshots.push(s);
  const after = buildNhlManualMlEvaluation(input);
  assert.deepEqual(after.events, before.events); assert.deepEqual(after.variants, before.variants);
  assert.equal(after.exclusions.filter(r => r.reason === 'AFTER_REPORT_CUTOFF').length, 3);
});

test('a same-day game is embargoed even when its final is available before the target anchor', () => {
  const input = dataset(42), sameDay = fixture(100, {date: day(41)});
  sameDay.decision.scheduledAt = sameDay.snapshot.scheduled_at = sameDay.snapshot.feature_payload.scheduled_at = at(day(41), 15);
  sameDay.decision.forecastAt = sameDay.decision.persistedAt = sameDay.decision.originalForecastAt = sameDay.decision.originalPersistedAt = at(day(41), 13);
  sameDay.snapshot.available_as_of = sameDay.snapshot.inserted_at = at(day(41), 12);
  sameDay.snapshot.feature_payload.available_as_of = sameDay.snapshot.feature_payload.provenance.publication_at = at(day(41), 12);
  sameDay.decision.comparators = [];
  sameDay.outcome.scheduledAt = sameDay.decision.scheduledAt; sameDay.outcome.observedAt = at(day(41), 18);
  input.snapshots.push(sameDay.snapshot); input.decisions.push(sameDay.decision); input.outcomes.push(sameDay.outcome);
  const r = attempt(buildNhlManualMlEvaluation(input), input.decisions[41].eventId);
  assert.equal(r.trainingGames, 41); assert.ok(!r.trainingEventIds.includes(sameDay.decision.eventId));
});

test('a known incomplete previous PR date is withheld as a whole within each feature cohort', () => {
  const input = dataset(43), pending = fixture(100, {date: day(40)});
  input.snapshots.push(pending.snapshot); input.decisions.push(pending.decision);
  const r = attempt(buildNhlManualMlEvaluation(input), input.decisions[42].eventId);
  assert.equal(r.trainingGames, 41);
  assert.ok(r.excludedIncompleteTrainingDates.includes(day(40)));
  assert.ok(!r.trainingEventIds.includes(input.decisions[40].eventId));
});

test('a result at exactly the forecast boundary, or persisted later, is unavailable for training', () => {
  const input = dataset(41), target = input.decisions[40];
  input.outcomes[0].observedAt = target.forecastAt;
  let r = attempt(buildNhlManualMlEvaluation(input), target.eventId);
  assert.equal(r.trainingGames, 39); assert.equal(r.candidateHomeProbability, null);
  input.outcomes[0].observedAt = at(day(1), 3); input.outcomes[0].persistedAt = target.forecastAt;
  r = attempt(buildNhlManualMlEvaluation(input), target.eventId);
  assert.equal(r.trainingGames, 39); assert.equal(r.candidateHomeProbability, null);
});

test('training gates apply to each feature, not to the total archive count', () => {
  const input = dataset(42);
  input.snapshots[0].feature_payload.teams.home.special_teams.pp_pct = null;
  input.snapshots[1].feature_payload.teams.home.special_teams.pp_pct = null;
  const report = buildNhlManualMlEvaluation(input), target = input.decisions[41].eventId;
  assert.equal(attempt(report, target, 'special_teams').trainingGames, 39);
  assert.equal(attempt(report, target, 'special_teams').candidateHomeProbability, null);
  assert.equal(attempt(report, target, 'shots_l10').trainingGames, 41);
  assert.ok(attempt(report, target, 'shots_l10').candidateHomeProbability !== null);
});

test('one-class or constant-feature training does not create fake fitted probabilities', () => {
  const oneClass = dataset(41); for (const o of oneClass.outcomes) { o.homeScore = 4; o.awayScore = 2; }
  let r = attempt(buildNhlManualMlEvaluation(oneClass), oneClass.decisions.at(-1).eventId);
  assert.equal(r.reason, 'SINGLE_CLASS_TRAINING'); assert.equal(r.controlHomeProbability, null); assert.equal(r.candidateHomeProbability, null);
  const constant = dataset(41);
  for (const row of constant.snapshots) for (const side of ['away', 'home']) {
    const t = row.feature_payload.teams[side]; t.rest.days_off = 1; t.rest.back_to_back = false;
    t.rest.last_game_date = t.last10.newest_date = minusDays(row.feature_payload.local_date, 2);
  }
  const report = buildNhlManualMlEvaluation(constant);
  r = attempt(report, constant.decisions.at(-1).eventId, 'rest');
  assert.equal(r.reason, 'NO_TRAINING_FEATURE_VARIATION'); assert.equal(r.coefficient, null);
  assert.equal(r.controlHomeProbability, null); assert.equal(r.candidateHomeProbability, null);
  assert.equal(variant(report, 'rest').observedFeatureRanges[0].hasVariation, false);
  assert.equal(variant(report, 'rest').observedFeatureRanges[0].min, 0);
});

test('zero and missing values remain distinct; percent-scale PP/PK is rejected, never rescaled', () => {
  const input = dataset(1); input.outcomes = [];
  input.snapshots[0].feature_payload.teams.home.special_teams.pp_pct = 0;
  assert.equal(variant(buildNhlManualMlEvaluation(input), 'special_teams').eligibleGames, 1);
  input.snapshots[0].feature_payload.teams.home.special_teams.pp_pct = 20;
  const report = buildNhlManualMlEvaluation(input);
  assert.equal(variant(report, 'special_teams').eligibleGames, 0);
  assert.equal(variant(report, 'shots_l10').eligibleGames, 1);
  assert.ok(report.exclusions.some(r => r.reason === 'INVALID_SPECIAL_TEAMS_UNITS'));
  input.snapshots[0].feature_payload.teams.home.special_teams.pp_pct = null;
  assert.equal(variant(buildNhlManualMlEvaluation(input), 'special_teams').eligibleGames, 0);
});

test('L10 requires a complete internally consistent window without the target or future dates', () => {
  for (const mutate of [
    f => { f.teams.home.recent_event_ids[0] = f.event_id; f.teams.home.last10.expected_event_ids[0] = f.event_id; },
    f => { f.teams.home.recent_event_ids = f.teams.home.recent_event_ids.slice(0, 1); f.teams.home.last10.expected_event_ids = [...f.teams.home.recent_event_ids]; },
    f => { f.teams.home.recent_event_ids[1] = f.teams.home.recent_event_ids[0]; },
    f => { f.teams.home.last10.newest_date = f.local_date; },
    f => { f.teams.home.season.through_date = '2027-01-01'; },
    f => { f.coverage.both_last10_complete = false; },
  ]) {
    const input = dataset(1); mutate(input.snapshots[0].feature_payload);
    assert.equal(buildNhlManualMlEvaluation(input).coverage.matchedAsOf, 0);
  }
  const incomplete = dataset(1); incomplete.snapshots[0].feature_payload.teams.home.last10.periods[0].shots_coverage = 9;
  const report = buildNhlManualMlEvaluation(incomplete);
  assert.equal(variant(report, 'shots_l10').eligibleGames, 0); assert.equal(variant(report, 'special_teams').eligibleGames, 1);
});

test('nested future captures fail closed even for an unmodeled goalie', () => {
  for (const mutate of [
    f => { f.provenance.publication_at = f.scheduled_at; },
    f => { f.teams.away.reported_goalie.checked_at = f.scheduled_at; },
    f => { f.teams.home.special_teams.captured_at = f.scheduled_at; },
    f => { f.provenance.archived_boxscores_last_capture = 'not-a-time'; },
  ]) {
    const input = dataset(1); mutate(input.snapshots[0].feature_payload);
    const report = buildNhlManualMlEvaluation(input);
    assert.equal(report.coverage.matchedAsOf, 0);
    assert.ok(report.exclusions.some(r => r.reason === 'FUTURE_OR_INVALID_SOURCE_TIMESTAMP'));
  }
});

test('the season hypothesis stays registered but blocked for a seed with no primary capture', () => {
  const input = dataset(1), f = input.snapshots[0].feature_payload;
  f.provenance.standings_method = 'PRESERVED_SEED'; f.provenance.standings_captured_at = null;
  const report = buildNhlManualMlEvaluation(input);
  assert.equal(report.variants.length, 4); assert.equal(variant(report, 'goals_season_l10').eligibleGames, 0);
  assert.equal(variant(report, 'shots_l10').eligibleGames, 1); assert.equal(variant(report, 'special_teams').eligibleGames, 1);
  assert.equal(variant(report, 'rest').eligibleGames, 1);
  assert.equal(report.coverage.goalies.numericRecentSamples, 2); assert.equal(report.coverage.goalies.modeled, false);
  for (const method of ['BOGUS', 'SEED_PLUS_VERIFIED_OFFICIAL_FINALS', 'OFFICIAL_NHL_STANDINGS']) {
    const adverse = dataset(1); adverse.snapshots[0].feature_payload.provenance.standings_method = method;
    assert.equal(variant(buildNhlManualMlEvaluation(adverse), 'goals_season_l10').eligibleGames, 0);
  }
});

test('pregame identity and baseline availability are required without using postgame identities', () => {
  for (const mutate of [
    d => { d.identityVerified = false; },
    d => { d.identityCapturedAt = d.scheduledAt; },
    d => { d.originalPersistedAt = d.scheduledAt; },
    d => { d.modelVersion = 'POISSON'; },
    d => { d.homeProbability = '0.52'; },
    d => { d.persistedAt = d.scheduledAt; },
  ]) {
    const input = dataset(1); mutate(input.decisions[0]);
    assert.equal(buildNhlManualMlEvaluation(input).coverage.validDecisions, 0);
  }
  const mismatch = dataset(1); mismatch.snapshots[0].feature_payload.teams.home.abbrev = 'ZZZ';
  assert.ok(buildNhlManualMlEvaluation(mismatch).exclusions.some(r => r.reason === 'MANUAL_DECISION_IDENTITY_MISMATCH'));
});

test('finals validate time, score, identity and final status before any training or scoring', () => {
  for (const mutate of [
    o => { o.observedAt = o.scheduledAt; },
    o => { o.observedAt = '2026-09-30T10:00:00Z'; },
    o => { o.homeScore = -1; },
    o => { o.homeScore = o.awayScore; },
    o => { o.homeScore = 3.5; },
    o => { o.capturedAt = '2026-09-30T10:00:00Z'; },
    o => { o.homeTeamId = 10; },
    o => { o.final = false; },
  ]) {
    const input = dataset(1); mutate(input.outcomes[0]);
    const report = buildNhlManualMlEvaluation(input);
    assert.equal(report.coverage.settled, 0); assert.equal(report.comparison.baseline.games, 0);
  }
});

test('identical events count once, conflicting decisions/snapshots are quarantined', () => {
  const input = dataset(1); input.decisions.push(clone(input.decisions[0])); input.snapshots.push(clone(input.snapshots[0])); input.outcomes.push(clone(input.outcomes[0]));
  let report = buildNhlManualMlEvaluation(input);
  assert.equal(report.coverage.matchedAsOf, 1); assert.equal(report.coverage.settled, 1); assert.equal(report.comparison.baseline.games, 1);
  input.decisions[1].homeProbability = 0.6; input.decisions[1].awayProbability = 0.4;
  report = buildNhlManualMlEvaluation(input); assert.equal(report.coverage.validDecisions, 0);
  input.decisions.pop(); input.snapshots[1].feature_payload.teams.home.special_teams.pp_pct = 0.9;
  report = buildNhlManualMlEvaluation(input); assert.equal(report.coverage.matchedAsOf, 0);
  assert.ok(report.exclusions.some(r => r.reason === 'CONFLICTING_DUPLICATE_SNAPSHOT'));
});

test('comparators retain their own available paired denominator and reject post-anchor quotes', () => {
  const input = dataset(3); input.decisions[0].comparators[0].availableAt = input.decisions[0].scheduledAt;
  const report = buildNhlManualMlEvaluation(input), c = report.comparison.comparators[0];
  assert.equal(c.availableGames, 2); assert.equal(c.games, 2); assert.equal(c.baselineMetrics.games, 2); assert.equal(c.comparatorMetrics.games, 2);
  assert.equal(c.pairedDifference.games, 2); assert.equal(c.fullGameContractVerifiedGames, 0);
});

test('fixed registration metadata does not pretend an earlier report issued any forecast', () => {
  const input = dataset(1); input.cutoff = '2026-10-03T00:00:00Z';
  const report = buildNhlManualMlEvaluation(input);
  assert.notEqual(report.status, 'INPUT_UNAVAILABLE');
  assert.equal(report.policy.registeredAt, NHL_MANUAL_ML_REGISTERED_AT);
  assert.equal(report.policy.registeredAtIsForecastIssuance, false); assert.equal(report.policy.prospectiveForecastsIssued, 0);
});
