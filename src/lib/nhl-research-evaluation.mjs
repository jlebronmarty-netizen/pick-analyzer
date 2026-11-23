// Read-only research evaluation. This module scores immutable forecasts; it never
// generates probabilities, recalibrates a model, or grants promotion eligibility.
import {evaluateNhlV6Paired} from './nhl-v6-prospective-validation.mjs';
import {gradeNhlFrozenSnapshots} from './nhl-challenger-freeze-core.mjs';
import {selectNhlV6CircaAsOf} from './nhl-late-v6-core.mjs';

export const NHL_MONEYLINE_RESEARCH_VERSION = 'NHL_MATCHED_MONEYLINE_RESEARCH_V1';
const MINUTE = 60000;
const BOOTSTRAP_ITERATIONS = 2000;
const BOOTSTRAP_SEED = 20261123;
const MODELS = [
  ['dratings', 'DRatings original'],
  ['circaNoVig', 'Circa sin margen'],
  ['poisson', 'Poisson tardío'],
  ['calibrated', 'V6 experimental'],
];
const BINS = [0, 0.4, 0.5, 0.6, 0.7, 1];
const REASONS = {
  INVALID_EVENT_ID: 'Identidad del partido inválida',
  INVALID_CAPTURE_TIMESTAMP: 'Falta una fecha válida de captura',
  INVALID_PERSISTENCE_TIMESTAMP: 'Fecha de almacenamiento inválida',
  AFTER_REPORT_CUTOFF: 'Registro posterior al corte del informe',
  CONFLICTING_DUPLICATE_EVENT: 'Registros diferentes para el mismo partido; requiere revisión',
  IDENTICAL_DUPLICATE_IGNORED: 'Copia idéntica descartada para contar el partido una sola vez',
  INVALID_ORIGINAL_DRATINGS_IDENTITY_TIME_OR_PROBABILITY: 'Pronóstico original con identidad, fecha o probabilidad inválida',
  INVALID_FINAL_IDENTITY_TIME_OR_SCORE: 'Resultado con identidad, fecha o marcador inválido',
  FINAL_EVIDENCE_INVALID: 'La evidencia del resultado no pasó la validación',
  FINAL_NOT_AVAILABLE_AT_CUTOFF: 'Sin resultado válido disponible al corte',
  FINAL_EVENT_TEAM_OR_START_MISMATCH: 'El resultado no coincide en equipos u hora de inicio',
  INVALID_EARLY_FREEZE_TIME: 'Congelación temprana fuera de sus límites temporales',
  INVALID_EARLY_FROZEN_CONTRACT: 'El pronóstico Poisson temprano no pasó su validación',
  INVALID_FROZEN_ASOF_CONTRACT: 'La decisión V6 o sus fuentes no cumplen el corte previo al juego',
  INVALID_CALIBRATION_STATUS: 'Estado de calibración incompatible con investigación',
  INVALID_CIRCA_ASOF_SOURCE: 'Cuota Circa sin identidad o fecha previa verificable',
  CANDIDATE_WITHOUT_VALID_ASOF_PRIOR: 'Candidato sin historial previo elegible',
  INVALID_CANDIDATE_GATE: 'Candidato fuera de sus criterios de elegibilidad',
  OUTCOME_DUPLICATE_CONFLICT: 'Resultados duplicados en conflicto',
  FINAL_IDENTITY_OR_TIME: 'El resultado no cumple identidad o temporalidad',
  LATE_RECORD_NOT_PERSISTED_PREGAME: 'La decisión tardía no consta almacenada antes del juego',
  ORIGINAL_DRATINGS_PROVENANCE_NOT_VERIFIED: 'No se pudo verificar el pronóstico original que copió V6',
  FROZEN_CIRCA_PRICE_PAIR_INCONSISTENT: 'Precios Circa y probabilidades sin margen inconsistentes',
  FOUR_MODEL_PROBABILITIES_NOT_AVAILABLE: 'Falta una probabilidad válida entre las cuatro referencias',
  FOUR_WAY_EVIDENCE_REJECTED: 'Evidencia insuficiente para la comparación de cuatro referencias',
  NO_VALID_V6_FREEZE_AT_CUTOFF: 'Sin decisión V6 válida congelada al corte',
};
const time = value => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const probability = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1;
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const score = value => Number.isSafeInteger(value) && value >= 0;
const round = value => Number(value.toFixed(6));
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const losses = (p, y) => ({brier: (p - y) ** 2, logLoss: -(y * Math.log(p) + (1 - y) * Math.log(1 - p)), accuracy: Number((p >= 0.5) === Boolean(y))});
const sportsDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit'});
const canonical = value => JSON.stringify(value, function (_key, item) {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
  }
  return item;
});

function wilson(hits, games) {
  if (!games) return null;
  const z = 1.959963984540054, z2 = z * z, p = hits / games, denominator = 1 + z2 / games;
  const center = (p + z2 / (2 * games)) / denominator;
  const half = z * Math.sqrt(p * (1 - p) / games + z2 / (4 * games * games)) / denominator;
  return {low: round(Math.max(0, center - half)), high: round(Math.min(1, center + half))};
}

function metrics(rows, model, label) {
  const values = rows.map(row => losses(row.probabilities[model], row.homeWon));
  const hits = values.reduce((sum, value) => sum + value.accuracy, 0);
  return {
    model, label, games: rows.length, hits,
    accuracy: rows.length ? round(hits / rows.length) : null,
    accuracyInterval95: wilson(hits, rows.length),
    brier: values.length ? round(average(values.map(value => value.brier))) : null,
    logLoss: values.length ? round(average(values.map(value => value.logLoss))) : null,
    meanProbability: rows.length ? round(average(rows.map(row => row.probabilities[model]))) : null,
    observedHomeWinRate: rows.length ? round(average(rows.map(row => row.homeWon))) : null,
    thresholdTies: rows.filter(row => row.probabilities[model] === 0.5).length,
  };
}

function calibration(rows, model, label) {
  return {model, label, probabilityTarget: 'HOME_WIN', bins: BINS.slice(0, -1).map((lower, index) => {
    const upper = BINS[index + 1];
    const selected = rows.filter(row => row.probabilities[model] >= lower &&
      (row.probabilities[model] < upper || upper === 1));
    const wins = selected.reduce((sum, row) => sum + row.homeWon, 0);
    return {
      label: `${lower * 100}–${upper * 100}%`, lower, upper, games: selected.length,
      meanProbability: selected.length ? round(average(selected.map(row => row.probabilities[model]))) : null,
      observedHomeWinRate: selected.length ? round(wins / selected.length) : null,
      interval95: wilson(wins, selected.length),
    };
  })};
}

function quantile(ordered, q) {
  const position = (ordered.length - 1) * q, lower = Math.floor(position), fraction = position - lower;
  return ordered[lower] + (ordered[Math.min(lower + 1, ordered.length - 1)] - ordered[lower]) * fraction;
}

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pairedDifference(rows, baseline, seed) {
  const differences = rows.map(row => {
    const candidate = losses(row.probabilities.calibrated, row.homeWon);
    const reference = losses(row.probabilities[baseline], row.homeWon);
    return {date: row.date, brier: candidate.brier - reference.brier,
      logLoss: candidate.logLoss - reference.logLoss, accuracy: candidate.accuracy - reference.accuracy};
  });
  const keys = ['brier', 'logLoss', 'accuracy'];
  const point = key => differences.length ? round(average(differences.map(row => row[key]))) : null;
  const bootstrap = groups => {
    const draws = Object.fromEntries(keys.map(key => [key, []]));
    if (groups.length >= 2) {
      const random = randomGenerator(seed);
      for (let iteration = 0; iteration < BOOTSTRAP_ITERATIONS; iteration++) {
        const sum = {brier: 0, logLoss: 0, accuracy: 0};
        let games = 0;
        for (let draw = 0; draw < groups.length; draw++) {
          const group = groups[Math.floor(random() * groups.length)];
          games += group.length;
          for (const row of group) for (const key of keys) sum[key] += row[key];
        }
        for (const key of keys) draws[key].push(sum[key] / games);
      }
    }
    return Object.fromEntries(keys.map(key => {
      const ordered = draws[key].sort((a, b) => a - b);
      return [key, {estimate: point(key), interval95: ordered.length ?
        {low: round(quantile(ordered, 0.025)), high: round(quantile(ordered, 0.975))} : null}];
    }));
  };
  const days = new Map();
  for (const row of differences) days.set(row.date, [...(days.get(row.date) ?? []), row]);
  return {
    candidate: 'calibrated', baseline, games: rows.length,
    ...bootstrap(differences.map(row => [row])),
    method: 'PAIRED_GAME_PERCENTILE_BOOTSTRAP', iterations: BOOTSTRAP_ITERATIONS, seed,
    dayBlockSensitivity: {method: 'PAIRED_DATE_BLOCK_PERCENTILE_BOOTSTRAP', blocks: days.size,
      ...bootstrap([...days.values()])},
    validatedImprovement: false,
  };
}

function timing(rows, model, label) {
  const values = rows.flatMap(row => {
    const captured = time(row.times[model]);
    return captured === null ? [] : [(time(row.scheduledAt) - captured) / MINUTE];
  }).sort((a, b) => a - b);
  return {model, label, games: values.length, missing: rows.length - values.length,
    minMinutes: values.length ? round(values[0]) : null,
    medianMinutes: values.length ? round(quantile(values, 0.5)) : null,
    maxMinutes: values.length ? round(values.at(-1)) : null};
}

function cohort(rows, model, label) {
  return {games: rows.length, eventIds: rows.map(row => row.eventId),
    dateRange: rows.length ? {from: rows[0].date, to: rows.at(-1).date} : null,
    ...(model ? {metrics: metrics(rows, model, label)} : {})};
}

/**
 * Scores archived NHL probabilities as delivered. All arrays must be complete at
 * cutoff (the service verifies pagination); this pure evaluator cannot establish
 * database completeness. Late rows reuse the existing V6 as-of validator.
 * @param {{predictions:any[], outcomes:any[], early:any[], late:any[], cutoff:string}} input
 */
export function buildNhlMoneylineResearch({predictions, outcomes, early, late, cutoff}) {
  const cutoffMs = time(cutoff);
  const sources = {predictions, outcomes, early, late};
  const unavailable = cutoffMs === null || Object.values(sources).some(rows => !Array.isArray(rows));
  const exclusions = [];
  const exclude = (source, eventId, reason, rows = 1) => exclusions.push({source, eventId: eventId ?? null,
    reason, reasonLabel: REASONS[reason] ?? reason, rows});
  const coverage = Object.fromEntries(Object.entries(sources).map(([source, rows]) => {
    const values = Array.isArray(rows) ? rows : [];
    const ids = values.map(row => row?.event_id).filter(id => typeof id === 'string');
    return [source, {rows: values.length, distinctGames: new Set(ids).size,
      duplicateRows: ids.length - new Set(ids).size, available: Array.isArray(rows)}];
  }));

  // Never let a later receipt change a historical report's outcome or identity.
  // Identical repeated input rows are ignored; differing same-event records are
  // quarantined rather than choosing the one with a better retrospective score.
  const unique = (input, source, timeKey) => {
    const grouped = new Map();
    for (const row of !unavailable && Array.isArray(input) ? input : []) {
      const id = row?.event_id, observed = time(row?.[timeKey]);
      if (typeof id !== 'string' || !/^nhl:\d{10}$/.test(id)) {
        exclude(source, id, 'INVALID_EVENT_ID'); continue;
      }
      if (observed === null) { exclude(source, id, 'INVALID_CAPTURE_TIMESTAMP'); continue; }
      if (row.created_at && time(row.created_at) === null) {
        exclude(source, id, 'INVALID_PERSISTENCE_TIMESTAMP'); continue;
      }
      if (observed > cutoffMs || (row.created_at && time(row.created_at) > cutoffMs)) {
        exclude(source, id, 'AFTER_REPORT_CUTOFF'); continue;
      }
      grouped.set(id, [...(grouped.get(id) ?? []), row]);
    }
    const accepted = new Map();
    for (const [id, values] of grouped) {
      if (new Set(values.map(canonical)).size > 1) {
        exclude(source, id, 'CONFLICTING_DUPLICATE_EVENT', values.length); continue;
      }
      accepted.set(id, values[0]);
      if (values.length > 1) exclude(source, id, 'IDENTICAL_DUPLICATE_IGNORED', values.length - 1);
    }
    return accepted;
  };
  const originals = unique(predictions, 'predictions', 'created_at');
  const finals = unique(outcomes, 'outcomes', 'observed_at');
  const earlyRows = unique(early, 'early', 'frozen_at');
  const lateRows = unique(late, 'late', 'frozen_at');

  const validOriginals = new Map();
  for (const [id, row] of originals) {
    const body = row.body ?? {}, capture = time(body.capturedAt), start = time(body.scheduledAt);
    if (body.eventId !== id || body.model !== 'DRATINGS_PUBLIC_V1' || start === null ||
      time(row.scheduled_at) !== start || capture === null || capture !== time(row.created_at) ||
      capture >= start || capture > cutoffMs || !positiveInteger(body.homeId) ||
      !positiveInteger(body.awayId) || body.homeId === body.awayId ||
      !probability(body.homeProbability) || !probability(body.awayProbability) ||
      Math.abs(body.homeProbability + body.awayProbability - 1) > 0.002) {
      exclude('predictions', id, 'INVALID_ORIGINAL_DRATINGS_IDENTITY_TIME_OR_PROBABILITY'); continue;
    }
    validOriginals.set(id, row);
  }

  const validFinals = new Map();
  for (const [id, row] of finals) {
    const body = row.body ?? {}, start = time(body.scheduledAt), observed = time(row.observed_at);
    if (body.eventId !== id || start === null || observed === null || observed <= start ||
      time(body.capturedAt) !== observed || !positiveInteger(body.homeId) || !positiveInteger(body.awayId) ||
      body.homeId === body.awayId || !score(body.homeScore) || !score(body.awayScore) ||
      body.homeScore === body.awayScore) {
      exclude('outcomes', id, 'INVALID_FINAL_IDENTITY_TIME_OR_SCORE'); continue;
    }
    validFinals.set(id, row);
  }

  const finalFor = (id, scheduledAt, homeId, awayId, source) => {
    const row = validFinals.get(id);
    if (!row) { exclude(source, id, finals.has(id) ? 'FINAL_EVIDENCE_INVALID' : 'FINAL_NOT_AVAILABLE_AT_CUTOFF'); return null; }
    const body = row.body;
    if (time(body.scheduledAt) !== time(scheduledAt) || body.homeId !== Number(homeId) || body.awayId !== Number(awayId)) {
      exclude(source, id, 'FINAL_EVENT_TEAM_OR_START_MISMATCH'); return null;
    }
    return row;
  };
  const makeRow = (eventId, scheduledAt, final, probabilities, times) => ({eventId,
    scheduledAt: new Date(time(scheduledAt)).toISOString(),
    date: sportsDate.format(new Date(time(scheduledAt))),
    homeWon: Number(final.body.homeScore > final.body.awayScore), probabilities, times});

  const originalScored = [];
  for (const [id, row] of validOriginals) {
    const b = row.body, final = finalFor(id, b.scheduledAt, b.homeId, b.awayId, 'dratingsOriginal');
    if (final) originalScored.push(makeRow(id, b.scheduledAt, final, {dratings: b.homeProbability}, {dratings: b.capturedAt}));
  }

  const earlyScored = [];
  for (const [id, row] of earlyRows) {
    const freeze = time(row.frozen_at), start = time(row.scheduled_at), source = time(row.source_completed_at);
    if (start === null || source === null || source > freeze || freeze - source > 90 * MINUTE ||
      start - freeze < 60 * MINUTE || (row.created_at && time(row.created_at) >= start)) {
      exclude('early', id, 'INVALID_EARLY_FREEZE_TIME'); continue;
    }
    const final = finalFor(id, row.scheduled_at, row.home_team_id, row.away_team_id, 'earlyPoisson');
    if (!final) continue;
    // Normalize timestamp formatting only; preserve the stored forecast values.
    const isoStart = new Date(start).toISOString(), b = final.body;
    const checked = gradeNhlFrozenSnapshots({frozenRows: [{...row, scheduled_at: isoStart}],
      finalScores: [{eventId: id, scheduledAt: isoStart, capturedAt: final.observed_at,
        homeId: b.homeId, awayId: b.awayId, homeGoals: b.homeScore, awayGoals: b.awayScore}]});
    if (checked.invalid || checked.settled !== 1 || !probability(row.market_proxies?.homeMoneylineProxy)) {
      exclude('early', id, 'INVALID_EARLY_FROZEN_CONTRACT'); continue;
    }
    earlyScored.push(makeRow(id, row.scheduled_at, final, {poissonEarly: row.market_proxies.homeMoneylineProxy}, {poissonEarly: row.frozen_at}));
  }

  const matched = [], acceptedLate = [];
  for (const [id, row] of lateRows) {
    const final = finalFor(id, row.scheduled_at, row.home_team_id, row.away_team_id, 'fourWay');
    const existing = evaluateNhlV6Paired({frozenRows: [row], finalRows: final ? [final] : []});
    if (existing.invalid) {
      for (const reason of Object.keys(existing.invalidReasons ?? {})) exclude('fourWay', id, reason);
      continue;
    }
    if (!final) continue;
    if (row.created_at && (time(row.created_at) === null || time(row.created_at) >= time(row.scheduled_at))) {
      exclude('fourWay', id, 'LATE_RECORD_NOT_PERSISTED_PREGAME'); continue;
    }
    const original = validOriginals.get(id), b = original?.body;
    const cal = row.calibration, observed = time(cal?.dratingsOriginalObservedAt);
    if (!b || observed === null || observed !== time(original.created_at) || observed > time(row.frozen_at) ||
      time(b.scheduledAt) !== time(row.scheduled_at) || b.homeId !== Number(row.home_team_id) ||
      b.awayId !== Number(row.away_team_id) || Math.abs(b.homeProbability - cal.originalDratingsHome) > 0.0000001) {
      exclude('fourWay', id, 'ORIGINAL_DRATINGS_PROVENANCE_NOT_VERIFIED'); continue;
    }
    const quote = cal.circaPrice;
    if (quote) {
      // Reuse the production arithmetic/price guard on the frozen price fields.
      // This verifies the archived price pair, not independent provider receipt
      // provenance or the bookmaker's original publication time/contract.
      const price = selectNhlV6CircaAsOf({game: {eventId: id, scheduledAt: row.scheduled_at,
        homeId: Number(row.home_team_id), awayId: Number(row.away_team_id)}, decisionAt: row.frozen_at,
        quotes: [{id: quote.observationId, captured_at: quote.capturedAt, body: {
          eventId: quote.eventId, scheduledAt: row.scheduled_at, homeId: Number(row.home_team_id),
          awayId: Number(row.away_team_id), sportsbook: quote.bookmaker, capturedAt: quote.capturedAt,
          homeOdds: quote.homeOdds, awayOdds: quote.awayOdds}}]});
      if (price.status !== 'CIRCA_PREGAME_RESEARCH_ONLY' ||
        Math.abs(price.homeNoVig - quote.homeNoVig) > 0.00001 ||
        !probability(quote.awayNoVig) || Math.abs(quote.homeNoVig + quote.awayNoVig - 1) > 0.00002) {
        exclude('fourWay', id, 'FROZEN_CIRCA_PRICE_PAIR_INCONSISTENT'); continue;
      }
    }
    if (existing.uniquePairedGames !== 1) {
      exclude('fourWay', id, 'FOUR_MODEL_PROBABILITIES_NOT_AVAILABLE'); continue;
    }
    acceptedLate.push(row);
    matched.push(makeRow(id, row.scheduled_at, final, {dratings: b.homeProbability,
      circaNoVig: quote.homeNoVig, poisson: row.market_proxies.homeMoneylineProxy, calibrated: cal.candidateHome},
      {dratings: b.capturedAt, circaNoVig: quote.capturedAt, poisson: row.frozen_at, calibrated: row.frozen_at}));
  }
  const included = new Set(matched.map(row => row.eventId));
  const universe = new Set([...(!unavailable && Array.isArray(predictions) ? predictions : []),
    ...(!unavailable && Array.isArray(late) ? late : [])].map(row => row?.event_id).filter(id => typeof id === 'string'));
  for (const id of [...universe].sort()) {
    if (included.has(id) || exclusions.some(row => row.source === 'fourWay' && row.eventId === id)) continue;
    exclude('fourWay', id, lateRows.has(id) ? 'FOUR_WAY_EVIDENCE_REJECTED' : 'NO_VALID_V6_FREEZE_AT_CUTOFF');
  }
  const order = (a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.eventId.localeCompare(b.eventId);
  for (const rows of [matched, originalScored, earlyScored]) rows.sort(order);
  const comparisons = MODELS.map(([model, label]) => metrics(matched, model, label));
  const subgroups = [];
  for (const [group, select] of [['home', p => p > 0.5], ['away', p => p < 0.5], ['pickem', p => p === 0.5]]) {
    const rows = matched.filter(row => select(row.probabilities.circaNoVig));
    subgroups.push({dimension: 'CIRCA_FAVORITE_VENUE', group, comparisons: MODELS.map(([model, label]) => metrics(rows, model, label))});
  }
  for (const [model, label] of MODELS) {
    for (const group of ['home', 'away']) {
      const rows = matched.filter(row => (row.probabilities[model] >= 0.5 ? 'home' : 'away') === group);
      subgroups.push({dimension: 'MODEL_SELECTED_VENUE', model, group, comparisons: [metrics(rows, model, label)]});
    }
    for (const group of ['favorite', 'underdog', 'pickem']) {
      const rows = matched.filter(row => {
        const market = row.probabilities.circaNoVig;
        const kind = market === 0.5 ? 'pickem' : (row.probabilities[model] >= 0.5) === (market > 0.5) ? 'favorite' : 'underdog';
        return kind === group;
      });
      subgroups.push({dimension: 'MODEL_SELECTION_VS_CIRCA', model, group, comparisons: [metrics(rows, model, label)]});
    }
  }
  const summary = new Map();
  for (const entry of exclusions) {
    const key = `${entry.source}:${entry.reason}`, bucket = summary.get(key) ?? {source: entry.source,
      reason: entry.reason, reasonLabel: entry.reasonLabel, rows: 0, ids: new Set()};
    bucket.rows += entry.rows;
    if (entry.eventId) bucket.ids.add(entry.eventId);
    summary.set(key, bucket);
  }
  const validation = evaluateNhlV6Paired({frozenRows: acceptedLate, finalRows: [...validFinals.values()]});
  return {
    schema: NHL_MONEYLINE_RESEARCH_VERSION,
    status: unavailable ? 'UNAVAILABLE' : matched.length ? 'EXPLORATORY_MATCHED_COHORT' : 'NO_MATCHED_GAMES',
    cutoff: cutoffMs === null ? null : new Date(cutoffMs).toISOString(), timezone: 'America/Puerto_Rico',
    researchOnly: true, modelPromotionAllowed: false, independentHoldoutPassed: false,
    sameInformationSet: false, quoteReceiptIndependentlyVerified: false,
    thresholdTieRule: 'HOME_AT_0_5_FOR_COMPATIBILITY',
    coverage, comparisons,
    cohorts: {fourWay: {...cohort(matched), universeGames: universe.size, excludedGames: universe.size - matched.length},
      dratingsOriginal: cohort(originalScored, 'dratings', 'DRatings original'),
      earlyPoisson: cohort(earlyScored, 'poissonEarly', 'Poisson temprano')},
    calibration: MODELS.map(([model, label]) => calibration(matched, model, label)),
    timing: MODELS.map(([model, label]) => timing(matched, model, label)),
    pairedDifferences: ['circaNoVig', 'dratings', 'poisson'].map((baseline, index) => pairedDifference(matched, baseline, BOOTSTRAP_SEED + index)),
    subgroups, exclusions: exclusions.sort((a, b) => a.source.localeCompare(b.source) || String(a.eventId).localeCompare(String(b.eventId)) || a.reason.localeCompare(b.reason)),
    exclusionSummary: [...summary.values()].map(({ids, ...value}) => ({...value, distinctGames: ids.size}))
      .sort((a, b) => a.source.localeCompare(b.source) || a.reason.localeCompare(b.reason)),
    validation, validationScope: 'ACCEPTED_FOUR_WAY_ROWS_ONLY',
    warnings: [
      ...(unavailable ? ['Faltan archivos completos o un corte temporal válido; la evaluación no está disponible.'] : []),
      'Comparación sobre los mismos partidos, con información emitida en horarios distintos: DRatings original temprano, mercado y Poisson/V6 tardíos.',
      'La evaluación es exploratoria. El periodo ya inspeccionado no es un holdout independiente para escoger fórmulas nuevas.',
      'Los intervalos de bootstrap son aproximados; hay dependencia entre equipos y fechas. La sensibilidad por fecha puede tener muy pocos bloques.',
      'Los subgrupos y los intervalos de calibración tienen muestras pequeñas; no establecen superioridad ni causalidad.',
      'Circa publicada en DRatings. Horario de publicación original, reglas del contrato, ROI ejecutable y mercados FanDuel no verificados.',
      'La integridad de paginación corresponde al lector. Las exclusiones pueden tener varios motivos por partido y no deben sumarse como partidos independientes.',
      'Treinta partidos es una revisión inicial; cien tampoco garantiza mejora. No se activa ningún modelo ni recomendación oficial.',
    ],
  };
}
