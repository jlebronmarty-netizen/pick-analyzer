// Pure, read-only research over prospectively stored manual inputs. The fitted
// probabilities below are as-of replays, never previously issued forecasts.
import {nhlManualFeatureDate, NHL_MANUAL_FEATURE_TIMEZONE, validNhlManualFeatureRow} from './nhl-manual-features.mjs';

export const NHL_MANUAL_ML_EVALUATION_VERSION = 'NHL_MANUAL_ML_ASOF_REPLAY_V1';
export const NHL_MANUAL_ML_REGISTERED_AT = '2026-11-24T00:13:59.000Z';
export const NHL_MANUAL_ML_RESEARCH_POLICY = Object.freeze({
  referenceModel: 'DRATINGS_PUBLIC_V1', ridgePenalty: 10, minimumTrainingGames: 40,
  minimumTrainingClasses: 2, interceptPenalized: false,
  bootstrapIterations: 2000, bootstrapSeed: 20261124,
  probabilityFloor: 1e-12, target: 'FULL_GAME_HOME_WIN_INCLUDING_OT_SO',
  classification: 'ASOF_REPLAY', modelPromoted: false,
});

const POLICY = NHL_MANUAL_ML_RESEARCH_POLICY;
const SIDES = ['away', 'home'];
const BINS = [0, 0.4, 0.5, 0.6, 0.7, 1];
const ANCHORS = ['STRICT_ORIGINAL', 'LATE_RESEARCH_ANCHOR'];
const VARIANTS = [
  {id: 'goals_season_l10', label: 'H1 · Goles de temporada y cambio L10',
    definition: 'x1=(GF/GP−GA/GP)home,season−(GF/GP−GA/GP)away,season; x2=[(GF/GP−GA/GP)home,L10−(GF/GP−GA/GP)away,L10]−x1.',
    featureNames: ['seasonGoalDifferential', 'last10GoalDifferentialChange'], units: ['goles oficiales por partido', 'goles oficiales por partido'],
    gates: ['Captura primaria de clasificación acreditada; ninguna semilla preservada', 'Temporada vigente con GP entero positivo', 'L10 de diez eventos únicos y secuencia/calendario verificados'],
    note: 'Usa goles del marcador oficial tanto en temporada como en L10, incluido el punto decisivo de shootout. No son goles de rendimiento ni una tasa de conversión de tiros.'},
  {id: 'shots_l10', label: 'H2 · Diferencial de tiros L10',
    definition: 'x1=(SOG_for/GP−SOG_against/GP)home,L10−(SOG_for/GP−SOG_against/GP)away,L10.',
    featureNames: ['last10ShotDifferential'], units: ['tiros a puerta por partido'],
    gates: ['L10 de diez eventos únicos y secuencia/calendario verificados', 'Cobertura de tiros 10/10 en cada período reglamentario', 'Captura del historial anterior a la generación del snapshot'],
    note: 'SOG son tiros a puerta, no intentos de tiro ni goles esperados. La ventana no se acorta cuando falta evidencia.'},
  {id: 'special_teams', label: 'H3 · Emparejamiento PP/PK',
    definition: 'x1=[PP_home+(1−PK_away)]/2−[PP_away+(1−PK_home)]/2.',
    featureNames: ['specialTeamsMatchup'], units: ['diferencia de proporciones (0–1)'],
    gates: ['PP y PK numéricos entre 0 y 1', 'Captura explícita anterior a la generación del snapshot', 'GP positivo y coincidencia de GP declarada'],
    note: 'Los porcentajes no se convierten silenciosamente desde 0–100. GP no es el número de oportunidades PP/PK; ese denominador no está disponible.'},
  {id: 'rest', label: 'H4 · Diferencia de descanso',
    definition: 'x1=days_off_home−days_off_away.',
    featureNames: ['daysOffDifference'], units: ['días naturales completos sin jugar'],
    gates: ['Descanso y calendario verificados', 'Último partido anterior al día del evento', 'Días libres y back-to-back consistentes con las fechas'],
    note: 'No incorpora viaje, distancia ni husos horarios. Un cero observado se conserva; un dato ausente no se convierte en cero.'},
];

const REASONS = {
  INVALID_INPUT: 'Falta un array completo de entrada o un corte temporal válido',
  INVALID_POLICY: 'La política solicitada cambia el baseline o los parámetros registrados',
  INVALID_EVENT_ID: 'Identidad del partido inválida',
  INVALID_TIMESTAMP: 'Fecha ausente, inválida o sin zona horaria explícita',
  AFTER_REPORT_CUTOFF: 'Registro posterior al corte del informe',
  IDENTICAL_DUPLICATE_IGNORED: 'Copia idéntica descartada; el partido se cuenta una sola vez',
  CONFLICTING_DUPLICATE_DECISION: 'Decisiones distintas para el mismo evento; se excluye el evento',
  CONFLICTING_DUPLICATE_SNAPSHOT: 'Snapshots o claves de idempotencia en conflicto al corte de la decisión',
  CONFLICTING_DUPLICATE_OUTCOME: 'Resultados finales en conflicto disponibles al corte',
  INVALID_DRATINGS_DECISION: 'Identidad, probabilidad, modelo o cronología de DRatings inválidos',
  EVENT_TEAM_IDENTITY_UNVERIFIED: 'No se acreditó la correspondencia previa NHL ID–abreviatura',
  INVALID_RESEARCH_ANCHOR: 'El anclaje no acredita que DRatings ya estaba disponible antes de congelar',
  NO_MANUAL_SNAPSHOT_ASOF: 'No había snapshot manual persistido al corte de esta decisión',
  INVALID_MANUAL_CONTRACT: 'El snapshot no cumple identidad, persistencia o contrato canónico',
  MANUAL_DECISION_IDENTITY_MISMATCH: 'Snapshot y decisión difieren en equipos u hora de inicio',
  FUTURE_OR_INVALID_SOURCE_TIMESTAMP: 'Una captura del payload es inválida o posterior a su generación',
  SLATE_PROVENANCE_UNVERIFIED: 'Falta evidencia de captura y verificación de la jornada',
  INVALID_HISTORY_WINDOW: 'Ventana histórica inconsistente, duplicada, futura o con el evento objetivo',
  INVALID_COVERAGE_FLAGS: 'Los indicadores de cobertura contradicen los datos de los equipos',
  SEASON_PRIMARY_CAPTURE_UNVERIFIED: 'Temporada preservada de una semilla o sin captura primaria acreditada',
  INVALID_SEASON_SAMPLE: 'GP, goles, tasas o fecha de temporada ausentes o inconsistentes',
  LAST10_NOT_COMPLETE_OR_VERIFIED: 'No hay diez partidos consecutivos acreditados al corte',
  LAST10_SOURCE_CAPTURE_UNVERIFIED: 'Falta captura temporal verificable del historial L10',
  INVALID_GOAL_RATES: 'Goles por partido ausentes, inválidos o incompatibles con los totales',
  INVALID_SHOT_RATES_OR_COVERAGE: 'Tiros a puerta ausentes, inválidos o con cobertura incompleta',
  INVALID_SPECIAL_TEAMS_UNITS: 'PP/PK no son proporciones numéricas entre cero y uno',
  SPECIAL_TEAMS_SAMPLE_UNVERIFIED: 'Falta captura, GP o coincidencia de muestra de PP/PK',
  REST_CALENDAR_UNVERIFIED: 'El calendario no acredita los días de descanso declarados',
  INVALID_REST_DAYS: 'Días libres, fecha del último partido o back-to-back inconsistentes',
  INVALID_FINAL: 'Resultado final con identidad, fecha, marcador o estado inválidos',
  FINAL_IDENTITY_MISMATCH: 'El resultado no coincide con los equipos o inicio de la decisión',
  NO_FINAL_AT_CUTOFF: 'Sin resultado final válido disponible al corte del informe',
  INVALID_COMPARATOR: 'Comparador sin identidad, probabilidad o captura compatible con el corte',
  INSUFFICIENT_PRIOR_SETTLED_GAMES: 'Menos de 40 partidos anteriores elegibles para esta variante',
  SINGLE_CLASS_TRAINING: 'El historial anterior no contiene victorias locales y visitantes',
  NO_TRAINING_FEATURE_VARIATION: 'La señal no varía en el entrenamiento anterior',
  NUMERICAL_FIT_FAILED: 'El ajuste no convergió con la política numérica fija',
};

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const eventId = x => typeof x === 'string' && /^nhl:\d{10}$/.test(x);
const abbrev = x => typeof x === 'string' && /^[A-Z]{2,3}$/.test(x);
const nonempty = x => typeof x === 'string' && x.trim().length > 0 && x.length <= 512;
const finite = x => typeof x === 'number' && Number.isFinite(x);
const nonnegative = x => finite(x) && x >= 0;
const integer = x => Number.isSafeInteger(x) && x >= 0;
const positiveInteger = x => integer(x) && x > 0;
const probability = x => finite(x) && x > 0 && x < 1;
const validPair = (h, a) => probability(h) && probability(a) && Math.abs(h + a - 1) <= 0.000002;
const round = x => finite(x) ? Number(x.toFixed(8)) : null;
const average = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const canonical = x => JSON.stringify(x, (_key, value) => object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(`${x}T00:00:00Z`)) && new Date(`${x}T00:00:00Z`).toISOString().slice(0, 10) === x;
const priorDate = x => new Date(Date.parse(`${x}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

// Preserve PostgreSQL microseconds at inclusive/exclusive boundaries. Date.parse
// alone truncates them and could admit a snapshot a few microseconds too late.
export function nhlManualMlTime(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/.exec(value);
  if (!m || !date(m[1]) || Number(m[2]) > 23 || Number(m[3]) > 59 || Number(m[4]) > 59) return null;
  const base = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}${m[6]}`);
  const valueUs = base * 1000 + Number((m[5] ?? '').padEnd(6, '0'));
  return Number.isSafeInteger(valueUs) ? valueUs : null;
}
const time = nhlManualMlTime;
const sportsDate = timestamp => nhlManualFeatureDate(timestamp);
const timestampAtOrBefore = (value, limit) => time(value) !== null && time(value) <= limit;
const latestTimestamp = rows => rows.length ? rows.reduce((a, b) => time(a) > time(b) ? a : b) : null;

function reasonCounts(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.reason, (counts.get(row.reason) ?? 0) + (row.rows ?? 1));
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([reason, count]) => ({reason, reasonLabel: REASONS[reason] ?? reason, count}));
}

function manualReason(row, cutoffUs) {
  const f = row?.feature_payload, at = time(row?.available_as_of), inserted = time(row?.inserted_at), source = time(f?.available_as_of), start = time(row?.scheduled_at);
  if (at === null || inserted !== at || source === null || start === null || source > at || at >= start || at > cutoffUs || time(f?.scheduled_at) !== start ||
    !validNhlManualFeatureRow(row, {date: sportsDate(row.scheduled_at), cutoff: row.available_as_of})) return 'INVALID_MANUAL_CONTRACT';
  for (const key of ['standings_captured_at', 'goalies_as_of', 'markets_captured_at', 'special_teams_captured_at', 'archived_boxscores_last_capture', 'slate_captured_at', 'publication_at']) {
    if (f.provenance[key] != null && !timestampAtOrBefore(f.provenance[key], source)) return 'FUTURE_OR_INVALID_SOURCE_TIMESTAMP';
  }
  if (f.provenance.slate_verified !== true || !timestampAtOrBefore(f.provenance.slate_captured_at, source)) return 'SLATE_PROVENANCE_UNVERIFIED';
  for (const side of SIDES) {
    const t = f.teams[side], l = t.last10;
    if (!['CONFIRMADO', 'PROBABLE', 'NO_CONFIRMADO'].includes(t.reported_goalie.status)) return 'INVALID_MANUAL_CONTRACT';
    if (!integer(l.gp) || l.gp !== t.recent_event_ids.length || t.recent_event_ids.includes(row.event_id) ||
      (l.expected_event_ids != null && canonical(l.expected_event_ids) !== canonical(t.recent_event_ids))) return 'INVALID_HISTORY_WINDOW';
    for (const d of [t.season.through_date, l.newest_date, l.oldest_date, l.calendar_verified_through]) {
      if (d != null && (!date(d) || d >= f.local_date || d > sportsDate(f.available_as_of))) return 'INVALID_HISTORY_WINDOW';
    }
    for (const captured of [t.special_teams.captured_at, t.reported_goalie.checked_at, t.reported_goalie.source_time]) {
      if (captured != null && !timestampAtOrBefore(captured, source)) return 'FUTURE_OR_INVALID_SOURCE_TIMESTAMP';
    }
    if (l.complete === true && (l.gp !== 10 || l.sequence_verified !== true)) return 'INVALID_HISTORY_WINDOW';
  }
  for (const key of ['history_through', 'standings_through']) {
    const d = f.provenance[key];
    if (d != null && (!date(d) || d >= f.local_date || d > sportsDate(f.available_as_of))) return 'INVALID_HISTORY_WINDOW';
  }
  if (f.coverage.both_last10_complete !== SIDES.every(s => f.teams[s].last10.complete === true) ||
    f.coverage.both_goalies_confirmed !== SIDES.every(s => f.teams[s].reported_goalie.status === 'CONFIRMADO')) return 'INVALID_COVERAGE_FLAGS';
  return null;
}

function l10Reason(f) {
  if (!timestampAtOrBefore(f.provenance.archived_boxscores_last_capture, time(f.available_as_of))) return 'LAST10_SOURCE_CAPTURE_UNVERIFIED';
  for (const side of SIDES) {
    const t = f.teams[side], l = t.last10;
    if (l.gp !== 10 || l.complete !== true || l.sequence_verified !== true || t.recent_event_ids.length !== 10 ||
      !Array.isArray(l.expected_event_ids) || canonical(l.expected_event_ids) !== canonical(t.recent_event_ids) ||
      !date(l.oldest_date) || !date(l.newest_date) || l.oldest_date > l.newest_date ||
      l.calendar_verified_through !== priorDate(f.local_date) || l.newest_date > l.calendar_verified_through) return 'LAST10_NOT_COMPLETE_OR_VERIFIED';
  }
  return null;
}

function validRate(value, total, games) {
  return nonnegative(value) && (total === undefined || total === null || (integer(total) && Math.abs(value - total / games) <= 0.000002));
}

function feature(variant, f) {
  const a = f.teams.away, h = f.teams.home, p = f.provenance;
  const fail = reason => ({available: false, values: null, reason, reasonLabel: REASONS[reason]});
  if (variant.id === 'goals_season_l10') {
    // Exact canonical normalizer method; a timestamp plus an arbitrary label is
    // not evidence of a primary standings capture. Seed-derived methods stay out.
    if (p.standings_method !== 'OFFICIAL_STANDINGS' || !timestampAtOrBefore(p.standings_captured_at, time(f.available_as_of))) return fail('SEASON_PRIMARY_CAPTURE_UNVERIFIED');
    if (f.coverage.standings_current !== true || !SIDES.every(s => {
      const t = f.teams[s].season;
      return positiveInteger(t.gp) && t.through_date === priorDate(f.local_date) &&
        validRate(t.gf_pg, t.gf, t.gp) && validRate(t.ga_pg, t.ga, t.gp);
    })) return fail('INVALID_SEASON_SAMPLE');
    const reason = l10Reason(f); if (reason) return fail(reason);
    if (!SIDES.every(s => validRate(f.teams[s].last10.gf_pg, f.teams[s].last10.gf, 10) && validRate(f.teams[s].last10.ga_pg, f.teams[s].last10.ga, 10))) return fail('INVALID_GOAL_RATES');
    const season = (h.season.gf_pg - h.season.ga_pg) - (a.season.gf_pg - a.season.ga_pg);
    return {available: true, values: [season, (h.last10.gf_pg - h.last10.ga_pg) - (a.last10.gf_pg - a.last10.ga_pg) - season], reason: null};
  }
  if (variant.id === 'shots_l10') {
    const reason = l10Reason(f); if (reason) return fail(reason);
    if (!SIDES.every(s => {
      const l = f.teams[s].last10;
      return nonnegative(l.shots_for_pg) && nonnegative(l.shots_against_pg) && Array.isArray(l.periods) &&
        [1, 2, 3].every(period => l.periods.filter(v => v?.period === period).length === 1 &&
          l.periods.some(v => v?.period === period && v.gp === 10 && v.shots_coverage === 10 && nonnegative(v.shots_for_pg) && nonnegative(v.shots_against_pg)));
    })) return fail('INVALID_SHOT_RATES_OR_COVERAGE');
    return {available: true, values: [(h.last10.shots_for_pg - h.last10.shots_against_pg) - (a.last10.shots_for_pg - a.last10.shots_against_pg)], reason: null};
  }
  if (variant.id === 'special_teams') {
    if (!SIDES.every(s => ['pp_pct', 'pk_pct'].every(key => finite(f.teams[s].special_teams[key]) && f.teams[s].special_teams[key] >= 0 && f.teams[s].special_teams[key] <= 1))) return fail('INVALID_SPECIAL_TEAMS_UNITS');
    if (!timestampAtOrBefore(p.special_teams_captured_at, time(f.available_as_of)) || !SIDES.every(s => {
      const t = f.teams[s], st = t.special_teams;
      return st.is_current_gp_match === true && positiveInteger(st.games_played) && st.games_played === t.season.gp &&
        timestampAtOrBefore(st.captured_at, time(f.available_as_of)) &&
        (st.through_date == null || (date(st.through_date) && st.through_date < f.local_date));
    })) return fail('SPECIAL_TEAMS_SAMPLE_UNVERIFIED');
    return {available: true, values: [(h.special_teams.pp_pct + 1 - a.special_teams.pk_pct) / 2 - (a.special_teams.pp_pct + 1 - h.special_teams.pk_pct) / 2], reason: null};
  }
  if (!SIDES.every(s => f.teams[s].rest.verified === true && f.teams[s].last10.sequence_verified === true &&
    f.teams[s].last10.calendar_verified_through === priorDate(f.local_date))) return fail('REST_CALENDAR_UNVERIFIED');
  if (!SIDES.every(s => {
    const t = f.teams[s], r = t.rest;
    return integer(r.days_off) && r.as_of_date === f.local_date && date(r.last_game_date) && r.last_game_date < f.local_date &&
      r.last_game_date === t.last10.newest_date && (Date.parse(`${f.local_date}T00:00:00Z`) - Date.parse(`${r.last_game_date}T00:00:00Z`)) / 86400000 - 1 === r.days_off &&
      typeof r.back_to_back === 'boolean' && r.back_to_back === (r.days_off === 0);
  })) return fail('INVALID_REST_DAYS');
  return {available: true, values: [h.rest.days_off - a.rest.days_off], reason: null};
}

const sigmoid = z => z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
const logit = p => Math.log(p) - Math.log1p(-p);
const softplus = z => Math.max(0, z) + Math.log1p(Math.exp(-Math.abs(z)));
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

function solve(matrix, rhs) {
  const a = matrix.map((row, i) => [...row, rhs[i]]), n = rhs.length;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    if (!finite(a[pivot][i]) || Math.abs(a[pivot][i]) < 1e-12) return null;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    const divisor = a[i][i];
    for (let k = i; k <= n; k++) a[i][k] /= divisor;
    for (let j = 0; j < n; j++) if (j !== i) {
      const factor = a[j][i];
      for (let k = i; k <= n; k++) a[j][k] -= factor * a[i][k];
    }
  }
  return a.map(row => row[n]);
}

// Sum of Bernoulli negative log likelihood + (10/2)*sum(beta_feature^2).
// The DRatings offset coefficient is fixed at one. Intercept is unpenalized in
// both fits. No outcome enters standardization or feature selection.
function fitOffset(rows, dimensions) {
  const mean = Array.from({length: dimensions}, (_, i) => average(rows.map(r => r.x[i])));
  const scale = mean.map((m, i) => Math.sqrt(average(rows.map(r => (r.x[i] - m) ** 2))));
  const active = scale.map((s, i) => s > 1e-12 ? i : null).filter(i => i !== null);
  if (dimensions && !active.length) return {reason: 'NO_TRAINING_FEATURE_VARIATION'};
  const design = rows.map(row => [1, ...active.map(i => (row.x[i] - mean[i]) / scale[i])]);
  const offsets = rows.map(row => logit(row.p));
  let beta = Array(active.length + 1).fill(0);
  const objective = b => rows.reduce((sum, row, i) => {
    const z = offsets[i] + dot(design[i], b);
    return sum + softplus(z) - row.y * z;
  }, POLICY.ridgePenalty / 2 * b.slice(1).reduce((sum, value) => sum + value * value, 0));
  for (let iteration = 0; iteration < 80; iteration++) {
    const gradient = Array(beta.length).fill(0), hessian = beta.map(() => Array(beta.length).fill(0));
    rows.forEach((row, index) => {
      const x = design[index], p = sigmoid(offsets[index] + dot(x, beta)), weight = p * (1 - p);
      x.forEach((value, j) => {
        gradient[j] += value * (p - row.y);
        x.forEach((other, k) => { hessian[j][k] += value * other * weight; });
      });
    });
    for (let i = 1; i < beta.length; i++) { gradient[i] += POLICY.ridgePenalty * beta[i]; hessian[i][i] += POLICY.ridgePenalty; }
    if (Math.max(...gradient.map(Math.abs)) < 1e-8) return {beta, mean, scale, active, iterations: iteration, reason: null};
    const step = solve(hessian, gradient); if (!step) return {reason: 'NUMERICAL_FIT_FAILED'};
    let fraction = 1, next, improved = false;
    const current = objective(beta);
    for (let search = 0; search < 24; search++) {
      next = beta.map((b, i) => b - fraction * step[i]);
      if (finite(objective(next)) && objective(next) <= current + 1e-10) { improved = true; break; }
      fraction /= 2;
    }
    if (!improved) return {reason: 'NUMERICAL_FIT_FAILED'};
    beta = next;
    if (Math.max(...step.map(s => Math.abs(s * fraction))) < 1e-9) return {beta, mean, scale, active, iterations: iteration + 1, reason: null};
  }
  return {reason: 'NUMERICAL_FIT_FAILED'};
}

function predict(fit, p, x) {
  return Math.min(1 - POLICY.probabilityFloor, Math.max(POLICY.probabilityFloor,
    sigmoid(logit(p) + dot([1, ...fit.active.map(i => (x[i] - fit.mean[i]) / fit.scale[i])], fit.beta))));
}

const losses = (p, y) => ({brier: (p - y) ** 2,
  logLoss: -(y * Math.log(Math.max(POLICY.probabilityFloor, p)) + (1 - y) * Math.log(Math.max(POLICY.probabilityFloor, 1 - p))),
  accuracy: Number(Number(p >= 0.5) === y)});
function wilson(hits, games) {
  if (!games) return null;
  const z = 1.959963984540054, z2 = z * z, p = hits / games, denominator = 1 + z2 / games;
  const center = (p + z2 / (2 * games)) / denominator, half = z * Math.sqrt(p * (1 - p) / games + z2 / (4 * games * games)) / denominator;
  return {low: round(Math.max(0, center - half)), high: round(Math.min(1, center + half))};
}
function metrics(rows, key, label) {
  const values = rows.map(r => losses(r[key], r.y)), hits = values.reduce((sum, value) => sum + value.accuracy, 0);
  return {label, games: rows.length, hits, accuracy: rows.length ? round(hits / rows.length) : null, accuracyInterval95: wilson(hits, rows.length),
    brier: round(average(values.map(v => v.brier))), logLoss: round(average(values.map(v => v.logLoss))),
    meanProbability: round(average(rows.map(r => r[key]))), observedHomeWinRate: round(average(rows.map(r => r.y))),
    thresholdTies: rows.filter(r => r[key] === 0.5).length};
}
function calibration(rows, key) {
  return BINS.slice(0, -1).map((lower, i) => {
    const upper = BINS[i + 1], selected = rows.filter(r => r[key] >= lower && (r[key] < upper || upper === 1));
    const wins = selected.reduce((sum, r) => sum + r.y, 0);
    return {lower, upper, games: selected.length, meanProbability: round(average(selected.map(r => r[key]))),
      observedHomeWinRate: selected.length ? round(wins / selected.length) : null, interval95: wilson(wins, selected.length)};
  });
}
function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let v = state; v = Math.imul(v ^ (v >>> 15), v | 1); v ^= v + Math.imul(v ^ (v >>> 7), v | 61); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; };
}
function quantile(sorted, q) {
  const at = (sorted.length - 1) * q, low = Math.floor(at), fraction = at - low;
  return sorted[low] + fraction * (sorted[Math.min(low + 1, sorted.length - 1)] - sorted[low]);
}
function paired(rows, candidate, baseline, seed) {
  const keys = ['brier', 'logLoss', 'accuracy'], differences = rows.map(row => {
    const c = losses(row[candidate], row.y), b = losses(row[baseline], row.y);
    return {date: row.date, ...Object.fromEntries(keys.map(key => [key, c[key] - b[key]]))};
  });
  const bootstrap = groups => {
    const values = Object.fromEntries(keys.map(key => [key, []]));
    if (groups.length >= 2) {
      const random = randomGenerator(seed);
      for (let iteration = 0; iteration < POLICY.bootstrapIterations; iteration++) {
        const sum = Object.fromEntries(keys.map(key => [key, 0])); let games = 0;
        for (let draw = 0; draw < groups.length; draw++) {
          const group = groups[Math.floor(random() * groups.length)]; games += group.length;
          for (const row of group) for (const key of keys) sum[key] += row[key];
        }
        for (const key of keys) values[key].push(sum[key] / games);
      }
    }
    return Object.fromEntries(keys.map(key => {
      const sorted = values[key].sort((a, b) => a - b);
      return [key, {estimate: round(average(differences.map(r => r[key]))), interval95: sorted.length ? {low: round(quantile(sorted, 0.025)), high: round(quantile(sorted, 0.975))} : null}];
    }));
  };
  const byDate = new Map(); for (const row of differences) byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]);
  return {candidate, baseline, games: rows.length, ...bootstrap(differences.map(r => [r])),
    method: 'PAIRED_EVENT_PERCENTILE_BOOTSTRAP', iterations: POLICY.bootstrapIterations, seed,
    dayBlockSensitivity: {method: 'PAIRED_PR_DATE_BLOCK_PERCENTILE_BOOTSTRAP', blocks: byDate.size, ...bootstrap([...byDate.values()])},
    validatedImprovement: false, selectionEligible: false};
}

/**
 * Arrays must come from complete, read-only archive reads. A normalized decision
 * contains one DRatings reference and one fixed anchor, never a mixture selected
 * by subsequent performance. Call separately for STRICT_ORIGINAL and
 * LATE_RESEARCH_ANCHOR. Outcome observedAt is the archive availability timestamp.
 * Identity evidence must be from a pregame NHL ID/abbreviation crosswalk verified
 * by the adapter; a postgame boxscore cannot certify a prospective join.
 * @param {{snapshots:any[],decisions:any[],outcomes:any[],cutoff:string,policy?:any}} input
 */
export function buildNhlManualMlEvaluation({snapshots, decisions, outcomes, cutoff, policy = {}} = {}) {
  const validPolicyObject = object(policy); policy = validPolicyObject ? policy : {};
  const cutoffUs = time(cutoff), exclusions = [];
  const exclude = (scope, id, reason, rows = 1) => exclusions.push({scope, eventId: id ?? null, reason, reasonLabel: REASONS[reason] ?? reason, rows});
  const anchorType = policy.anchorType ?? decisions?.[0]?.anchorType ?? 'STRICT_ORIGINAL';
  const baselineLabel = anchorType === 'STRICT_ORIGINAL' ? 'DRatings original al corte original' : 'DRatings original trasladado al anclaje V6';
  const invalidPolicy = !validPolicyObject || !ANCHORS.includes(anchorType) || (policy.referenceModel != null && policy.referenceModel !== POLICY.referenceModel) ||
    Object.entries(POLICY).some(([key, value]) => policy[key] != null && policy[key] !== value) ||
    (policy.registeredAt != null && time(policy.registeredAt) !== time(NHL_MANUAL_ML_REGISTERED_AT));
  const invalidInput = cutoffUs === null || ![snapshots, decisions, outcomes].every(Array.isArray);
  const unavailable = invalidInput || invalidPolicy;
  if (unavailable) exclude('input', null, invalidInput ? 'INVALID_INPUT' : 'INVALID_POLICY');
  const snapshotByEvent = new Map(), decisionGroups = new Map(), finalByEvent = new Map();
  let validSnapshotRows = 0;
  for (const row of unavailable ? [] : snapshots) {
    if (!eventId(row?.event_id)) { exclude('snapshots', row?.event_id, 'INVALID_EVENT_ID'); continue; }
    const available = time(row.available_as_of), inserted = time(row.inserted_at);
    if (available === null || inserted === null) { exclude('snapshots', row.event_id, 'INVALID_TIMESTAMP'); continue; }
    if (available > cutoffUs || inserted > cutoffUs) { exclude('snapshots', row.event_id, 'AFTER_REPORT_CUTOFF'); continue; }
    snapshotByEvent.set(row.event_id, [...(snapshotByEvent.get(row.event_id) ?? []), row]);
    if (!manualReason(row, cutoffUs)) validSnapshotRows++;
  }
  for (const d of unavailable ? [] : decisions) {
    if (!eventId(d?.eventId)) { exclude('decisions', d?.eventId, 'INVALID_EVENT_ID'); continue; }
    const forecast = time(d.forecastAt), persisted = time(d.persistedAt);
    if (forecast === null || persisted === null) { exclude('decisions', d.eventId, 'INVALID_TIMESTAMP'); continue; }
    if (forecast > cutoffUs || persisted > cutoffUs) { exclude('decisions', d.eventId, 'AFTER_REPORT_CUTOFF'); continue; }
    decisionGroups.set(d.eventId, [...(decisionGroups.get(d.eventId) ?? []), d]);
  }
  for (const o of unavailable ? [] : outcomes) {
    if (!eventId(o?.eventId)) { exclude('outcomes', o?.eventId, 'INVALID_EVENT_ID'); continue; }
    const observed = time(o.observedAt), persisted = o.persistedAt == null ? observed : time(o.persistedAt), start = time(o.scheduledAt);
    if (observed === null || persisted === null) { exclude('outcomes', o.eventId, 'INVALID_TIMESTAMP'); continue; }
    if (observed > cutoffUs || persisted > cutoffUs) { exclude('outcomes', o.eventId, 'AFTER_REPORT_CUTOFF'); continue; }
    if (o.final !== true || start === null || observed <= start || persisted < observed ||
      (o.capturedAt != null && time(o.capturedAt) !== observed) || !positiveInteger(o.homeTeamId) || !positiveInteger(o.awayTeamId) || o.homeTeamId === o.awayTeamId ||
      !integer(o.homeScore) || !integer(o.awayScore) || o.homeScore === o.awayScore) { exclude('outcomes', o.eventId, 'INVALID_FINAL'); continue; }
    finalByEvent.set(o.eventId, [...(finalByEvent.get(o.eventId) ?? []), {...o, availabilityUs: Math.max(observed, persisted)}]);
  }
  const outcomeAt = (d, at, strict = false) => {
    // Resolve conflicting results separately at each historical training cut.
    // A correction published later cannot change an earlier replay fit.
    const candidates = (finalByEvent.get(d.eventId) ?? []).filter(o => strict ? o.availabilityUs < at : o.availabilityUs <= at);
    if (!candidates.length) return {outcome: null, reason: 'NO_FINAL_AT_CUTOFF'};
    const signatures = new Set(candidates.map(o => canonical({scheduledAt: time(o.scheduledAt), homeTeamId: o.homeTeamId, awayTeamId: o.awayTeamId, homeScore: o.homeScore, awayScore: o.awayScore})));
    if (signatures.size > 1) return {outcome: null, reason: 'CONFLICTING_DUPLICATE_OUTCOME'};
    const o = candidates.sort((a, b) => a.availabilityUs - b.availabilityUs)[0];
    if (time(o.scheduledAt) !== time(d.scheduledAt) || o.homeTeamId !== d.homeTeamId || o.awayTeamId !== d.awayTeamId ||
      (o.homeAbbrev != null && o.homeAbbrev !== d.homeAbbrev) || (o.awayAbbrev != null && o.awayAbbrev !== d.awayAbbrev)) return {outcome: null, reason: 'FINAL_IDENTITY_MISMATCH'};
    return {outcome: o, reason: null};
  };
  const events = [], selected = [];
  let validDecisions = 0, noSnapshotAsOf = 0;
  for (const [id, group] of decisionGroups) {
    if (new Set(group.map(canonical)).size > 1) { exclude('decisions', id, 'CONFLICTING_DUPLICATE_DECISION', group.length); continue; }
    if (group.length > 1) exclude('decisions', id, 'IDENTICAL_DUPLICATE_IGNORED', group.length - 1);
    const d = group[0], start = time(d.scheduledAt), forecast = time(d.forecastAt), persisted = time(d.persistedAt), original = time(d.originalForecastAt),
      originalPersisted = d.originalPersistedAt == null ? original : time(d.originalPersistedAt);
    if (d.modelVersion !== POLICY.referenceModel || !probability(d.homeProbability) || !probability(d.awayProbability) ||
      Math.abs(d.homeProbability + d.awayProbability - 1) > 0.002 || !nonempty(d.decisionId) || !nonempty(d.referenceSourceId) ||
      start === null || original === null || originalPersisted === null || originalPersisted < original || originalPersisted > forecast || forecast >= start || persisted < forecast || persisted >= start ||
      !positiveInteger(d.homeTeamId) || !positiveInteger(d.awayTeamId) || d.homeTeamId === d.awayTeamId || !abbrev(d.homeAbbrev) || !abbrev(d.awayAbbrev) || d.homeAbbrev === d.awayAbbrev) {
      exclude('decisions', id, 'INVALID_DRATINGS_DECISION'); continue;
    }
    if ((d.anchorType ?? anchorType) !== anchorType || (anchorType === 'STRICT_ORIGINAL' && original !== forecast) || (anchorType === 'LATE_RESEARCH_ANCHOR' && original > forecast)) {
      exclude('decisions', id, 'INVALID_RESEARCH_ANCHOR'); continue;
    }
    if (d.identityVerified !== true || !nonempty(d.identitySourceId) || !timestampAtOrBefore(d.identityCapturedAt, forecast)) {
      exclude('decisions', id, 'EVENT_TEAM_IDENTITY_UNVERIFIED'); continue;
    }
    validDecisions++;
    const available = (snapshotByEvent.get(id) ?? []).filter(r => time(r.available_as_of) <= forecast && time(r.inserted_at) <= forecast).sort((a, b) => time(b.available_as_of) - time(a.available_as_of));
    if (!available.length) { noSnapshotAsOf++; exclude('manualAsOf', id, 'NO_MANUAL_SNAPSHOT_ASOF'); continue; }
    const r = available[0], sameTime = available.filter(x => time(x.available_as_of) === time(r.available_as_of)), sameRun = available.filter(x => x.source_run_id === r.source_run_id);
    if (new Set(sameTime.map(canonical)).size > 1 || new Set(sameRun.map(canonical)).size > 1) {
      exclude('manualAsOf', id, 'CONFLICTING_DUPLICATE_SNAPSHOT'); continue;
    }
    if (sameTime.length > 1) exclude('snapshots', id, 'IDENTICAL_DUPLICATE_IGNORED', sameTime.length - 1);
    const invalid = manualReason(r, cutoffUs);
    if (invalid) { exclude('manualAsOf', id, invalid); continue; }
    const f = r.feature_payload;
    if (time(r.scheduled_at) !== start || f.teams.home.abbrev !== d.homeAbbrev || f.teams.away.abbrev !== d.awayAbbrev) {
      exclude('manualAsOf', id, 'MANUAL_DECISION_IDENTITY_MISMATCH'); continue;
    }
    const final = outcomeAt(d, cutoffUs);
    if (!final.outcome) exclude('settlement', id, final.reason);
    const features = Object.fromEntries(VARIANTS.map(v => [v.id, feature(v, f)]));
    for (const [variant, value] of Object.entries(features)) if (!value.available) exclude(variant, id, value.reason);
    const comparators = {};
    for (const c of Array.isArray(d.comparators) ? d.comparators : []) {
      if (!nonempty(c?.id) || !nonempty(c.label) || !nonempty(c.sourceId) || !validPair(c.homeProbability, c.awayProbability) ||
        !timestampAtOrBefore(c.availableAt, forecast) || (c.persistedAt != null && (!timestampAtOrBefore(c.persistedAt, cutoffUs) || time(c.persistedAt) >= start)) || comparators[c.id]) {
        exclude('comparators', id, 'INVALID_COMPARATOR'); continue;
      }
      comparators[c.id] = {...c};
    }
    const row = {eventId: id, decisionId: d.decisionId, scheduledAt: d.scheduledAt, date: sportsDate(d.scheduledAt), forecastAt: d.forecastAt,
      homeAbbrev: d.homeAbbrev, awayAbbrev: d.awayAbbrev, homeTeamId: d.homeTeamId, awayTeamId: d.awayTeamId,
      originalForecastAt: d.originalForecastAt, originalPersistedAt: d.originalPersistedAt ?? d.originalForecastAt,
      baselineHomeProbability: d.homeProbability, baselineLabel, referenceSourceId: d.referenceSourceId,
      manualKey: `${id}@${r.available_as_of}`, manualAvailableAsOf: r.available_as_of, sourceGeneratedAt: f.available_as_of,
      sourceRunId: r.source_run_id, sourceSnapshotSha256: r.source_snapshot_sha256,
      settled: Boolean(final.outcome), outcomeObservedAt: final.outcome?.observedAt ?? null,
      features: VARIANTS.map(v => ({id: v.id, ...features[v.id]})),
      goalies: SIDES.map(side => { const g = f.teams[side].reported_goalie; return {side, status: g.status ?? null,
        recentSampleGames: integer(g.recent_sample?.gp) ? g.recent_sample.gp : null, numericSamplePresent: positiveInteger(g.recent_sample?.gp) && nonnegative(g.recent_sample?.sa) && nonnegative(g.recent_sample?.ga),
        crosswalkCertified: false, modeled: false}; }),
    };
    events.push(row); selected.push({d, row, features, comparators, final: final.outcome});
  }
  selected.sort((a, b) => time(a.d.forecastAt) - time(b.d.forecastAt) || a.d.eventId.localeCompare(b.d.eventId));
  events.sort((a, b) => time(a.scheduledAt) - time(b.scheduledAt) || a.eventId.localeCompare(b.eventId));
  const forecastRows = [];
  const variants = VARIANTS.map((variant, variantIndex) => {
    const eligible = selected.filter(r => r.features[variant.id].available), scored = [], fits = new Map(), attempts = [];
    for (const target of eligible) {
      const at = time(target.d.forecastAt), day = sportsDate(target.d.forecastAt), priorByDay = new Map();
      for (const previous of eligible) {
        if (previous.d.eventId === target.d.eventId || previous.row.date >= day || time(previous.d.forecastAt) >= at) continue;
        priorByDay.set(previous.row.date, [...(priorByDay.get(previous.row.date) ?? []), previous]);
      }
      const training = [], excludedTrainingDates = [];
      for (const [date, previous] of priorByDay) {
        const resolved = previous.map(r => ({r, ...outcomeAt(r.d, at, true)}));
        // Complete previous PR dates within this variant's archived cohort. This
        // is not a claim that the archive covers the entire league schedule.
        if (resolved.some(r => !r.outcome)) { excludedTrainingDates.push(date); continue; }
        training.push(...resolved.map(({r, outcome}) => ({eventId: r.d.eventId, date, x: r.features[variant.id].values,
          p: r.d.homeProbability, y: Number(outcome.homeScore > outcome.awayScore), outcomeObservedAt: outcome.observedAt,
          outcomeAvailabilityUs: outcome.availabilityUs, outcomePersistedAt: outcome.persistedAt ?? outcome.observedAt})));
      }
      training.sort((a, b) => a.date.localeCompare(b.date) || a.eventId.localeCompare(b.eventId));
      const base = {variantId: variant.id, eventId: target.d.eventId, decisionId: target.d.decisionId, manualKey: target.row.manualKey,
        forecastAt: target.d.forecastAt, originalForecastAt: target.d.originalForecastAt, sourceRunId: target.row.sourceRunId,
        classification: 'ASOF_REPLAY', issuedAt: null, prospectiveForecastIssued: false, settled: Boolean(target.final),
        featureValues: [...target.features[variant.id].values], baselineHomeProbability: target.d.homeProbability,
        trainingGames: training.length, trainingEventIds: training.map(r => r.eventId), trainingDates: [...new Set(training.map(r => r.date))],
        trainingHomeWins: training.filter(r => r.y).length, trainingAwayWins: training.filter(r => !r.y).length,
        trainingMaxObservedAt: latestTimestamp(training.map(r => r.outcomeObservedAt)), trainingMaxAvailableAt: latestTimestamp(training.map(r => r.outcomePersistedAt)),
        excludedIncompleteTrainingDates: excludedTrainingDates.sort(), controlHomeProbability: null, candidateHomeProbability: null,
        coefficient: null, trainingStandardization: null, reason: null, reasonLabel: null};
      let reason = training.length < POLICY.minimumTrainingGames ? 'INSUFFICIENT_PRIOR_SETTLED_GAMES' :
        new Set(training.map(r => r.y)).size < POLICY.minimumTrainingClasses ? 'SINGLE_CLASS_TRAINING' : null;
      if (!reason) {
        const fitKey = canonical(training.map(r => [r.eventId, r.y, r.p, r.x]));
        if (!fits.has(fitKey)) fits.set(fitKey, {candidate: fitOffset(training, variant.featureNames.length), control: fitOffset(training, 0)});
        const fit = fits.get(fitKey); reason = fit.candidate.reason ?? fit.control.reason;
        if (!reason) {
          base.controlHomeProbability = predict(fit.control, target.d.homeProbability, []);
          base.candidateHomeProbability = predict(fit.candidate, target.d.homeProbability, base.featureValues);
          base.coefficient = {intercept: fit.candidate.beta[0], features: variant.featureNames.map((name, i) => ({name,
            coefficient: fit.candidate.active.includes(i) ? fit.candidate.beta[fit.candidate.active.indexOf(i) + 1] : 0})), controlIntercept: fit.control.beta[0]};
          base.trainingStandardization = variant.featureNames.map((name, i) => ({name, mean: fit.candidate.mean[i], populationStdDev: fit.candidate.scale[i], active: fit.candidate.active.includes(i)}));
          if (target.final) scored.push({eventId: target.d.eventId, date: target.row.date, y: Number(target.final.homeScore > target.final.awayScore),
            baseline: base.baselineHomeProbability, control: base.controlHomeProbability, candidate: base.candidateHomeProbability, comparators: target.comparators});
        }
      }
      base.reason = reason; base.reasonLabel = reason ? REASONS[reason] : null;
      if (reason) exclude(`training:${variant.id}`, target.d.eventId, reason);
      attempts.push(base); forecastRows.push(base);
    }
    const relevant = exclusions.filter(r => r.scope === variant.id || r.scope === `training:${variant.id}`), counts = attempts.map(r => r.trainingGames);
    const status = !eligible.length ? 'FEATURE_UNAVAILABLE' : !eligible.some(r => r.final) ? 'INSUFFICIENT_SETTLED_HISTORY' :
      scored.length ? 'DESCRIPTIVE_REPLAY_AVAILABLE' : 'INSUFFICIENT_TRAINING_HISTORY';
    return {...variant, status, statusLabel: statusLabel(status), eligibleGames: eligible.length, eligibleSettledGames: eligible.filter(r => r.final).length,
      eligiblePendingGames: eligible.filter(r => !r.final).length, replayForecasts: attempts.filter(r => r.candidateHomeProbability !== null).length,
      scoredGames: scored.length, scoredEventIds: scored.map(r => r.eventId), minimumTrainingGames: POLICY.minimumTrainingGames, ridgePenalty: POLICY.ridgePenalty,
      observedFeatureRanges: variant.featureNames.map((name, i) => {
        const values = eligible.map(r => r.features[variant.id].values[i]), mean = average(values);
        return {name, games: values.length, distinctValues: new Set(values).size, hasVariation: new Set(values).size > 1,
          min: values.length ? round(Math.min(...values)) : null, max: values.length ? round(Math.max(...values)) : null,
          mean: round(mean), populationStdDev: values.length ? round(Math.sqrt(average(values.map(v => (v - mean) ** 2)))) : null};
      }),
      trainingRange: counts.length ? {min: Math.min(...counts), max: Math.max(...counts)} : null,
      baselineMetrics: metrics(scored, 'baseline', baselineLabel), controlMetrics: metrics(scored, 'control', 'Control de intercepto, mismos partidos'),
      candidateMetrics: metrics(scored, 'candidate', variant.label),
      pairedDifference: {vsBaseline: paired(scored, 'candidate', 'baseline', POLICY.bootstrapSeed + variantIndex),
        vsInterceptOnly: paired(scored, 'candidate', 'control', POLICY.bootstrapSeed + variantIndex)},
      comparators: [...new Set(scored.flatMap(r => Object.keys(r.comparators)))].sort().map((id, index) => {
        const matched = scored.filter(r => r.comparators[id]), label = matched[0].comparators[id].label;
        const rows = matched.map(r => ({...r, comparator: r.comparators[id].homeProbability}));
        return {id, label, games: rows.length, eventIds: rows.map(r => r.eventId),
          fullGameContractVerifiedGames: matched.filter(r => r.comparators[id].fullGameContractVerified === true).length,
          baselineMetrics: metrics(rows, 'baseline', baselineLabel), controlMetrics: metrics(rows, 'control', 'Control de intercepto, mismos partidos'),
          candidateMetrics: metrics(rows, 'candidate', variant.label), comparatorMetrics: metrics(rows, 'comparator', label),
          pairedDifference: paired(rows, 'candidate', 'comparator', POLICY.bootstrapSeed + 100 + variantIndex * 10 + index)};
      }),
      calibration: {baseline: calibration(scored, 'baseline'), control: calibration(scored, 'control'), candidate: calibration(scored, 'candidate')},
      exclusions: reasonCounts(relevant), validatedImprovement: false, modelPromoted: false};
  });
  const baselineRows = selected.filter(r => r.final).map(r => ({eventId: r.d.eventId, date: r.row.date, y: Number(r.final.homeScore > r.final.awayScore), baseline: r.d.homeProbability}));
  const comparatorIds = [...new Set(selected.flatMap(r => Object.keys(r.comparators)))].sort();
  const comparators = comparatorIds.map((id, index) => {
    const usable = selected.filter(r => r.comparators[id]), settled = usable.filter(r => r.final);
    const rows = settled.map(r => ({eventId: r.d.eventId, date: r.row.date, y: Number(r.final.homeScore > r.final.awayScore), baseline: r.d.homeProbability, comparator: r.comparators[id].homeProbability}));
    return {id, label: usable[0].comparators[id].label, availableGames: usable.length, games: rows.length, eventIds: rows.map(r => r.eventId),
      fullGameContractVerifiedGames: usable.filter(r => r.comparators[id].fullGameContractVerified === true).length,
      baselineMetrics: metrics(rows, 'baseline', baselineLabel), comparatorMetrics: metrics(rows, 'comparator', usable[0].comparators[id].label),
      pairedDifference: paired(rows, 'comparator', 'baseline', POLICY.bootstrapSeed + 10 + index)};
  });
  const goalies = events.flatMap(r => r.goalies), settled = selected.filter(r => r.final).length;
  const status = unavailable ? 'INPUT_UNAVAILABLE' : !validDecisions ? 'EMPTY' : !settled ? 'INSUFFICIENT_SETTLED_HISTORY' :
    variants.some(v => v.scoredGames) ? 'DESCRIPTIVE_REPLAY_AVAILABLE' : 'INSUFFICIENT_TRAINING_HISTORY';
  return {version: NHL_MANUAL_ML_EVALUATION_VERSION, status, statusLabel: statusLabel(status), cutoff,
    policy: {...POLICY, anchorType, baselineLabel, registeredAt: NHL_MANUAL_ML_REGISTERED_AT, registeredAtIsForecastIssuance: false,
      timezone: NHL_MANUAL_FEATURE_TIMEZONE, hypotheses: VARIANTS.map(v => v.id), candidateCombinations: false, parameterSearch: false,
      trainingRule: 'Only earlier Puerto Rico dates; all eligible archived events on a training date must have a valid final available strictly before the anchor.',
      standardization: 'Training-only population mean and standard deviation; zero-variance columns inactive.',
      loss: 'Sum Bernoulli negative log likelihood + 10/2 * sum(feature coefficients squared); unpenalized intercept; fixed DRatings logit offset.',
      selectionRule: 'No winner, promotion, feature selection or probability publication.', prospectiveForecastsIssued: 0},
    coverage: {snapshotRows: Array.isArray(snapshots) ? snapshots.length : 0, snapshotEvents: snapshotByEvent.size, validSnapshotRows,
      decisionRows: Array.isArray(decisions) ? decisions.length : 0, decisionEvents: decisionGroups.size, validDecisions,
      matchedAsOf: selected.length, settled, pending: selected.length - settled, noSnapshotAsOf,
      missingFeaturesByVariant: variants.map(v => ({id: v.id, availableGames: v.eligibleGames, missingGames: selected.length - v.eligibleGames,
        reasons: reasonCounts(exclusions.filter(r => r.scope === v.id))})),
      goalies: {teamRows: goalies.length, numericRecentSamples: goalies.filter(g => g.numericSamplePresent).length,
        confirmed: goalies.filter(g => g.status === 'CONFIRMADO').length, probable: goalies.filter(g => g.status === 'PROBABLE').length,
        unconfirmed: goalies.filter(g => g.status === 'NO_CONFIRMADO').length, crosswalkCertified: 0, modeled: false}},
    variants, comparison: {baseline: metrics(baselineRows, 'baseline', baselineLabel), comparators}, events, forecastRows,
    exclusions, exclusionSummary: reasonCounts(exclusions),
    limitations: [
      'Los snapshots manuales son inputs guardados antes del partido. Las probabilidades de candidatos calculadas aquí son reconstrucciones ASOF_REPLAY; no son pronósticos emitidos antes del resultado.',
      anchorType === 'STRICT_ORIGINAL' ? 'Solo se aceptan inputs persistidos antes o exactamente al corte original de DRatings.' :
        'Se conserva DRatings original y se traslada su referencia a la congelación V6. La información manual disponible después del corte original no se atribuye al pronóstico original.',
      'Cuarenta resultados anteriores y ambas clases son un mínimo técnico por variante; no constituyen validación predictiva. Las cuatro hipótesis permanecen separadas y sin elegir ganadora.',
      'Cada candidato se compara con DRatings y con un intercepto ajustado sobre exactamente los mismos eventos anteriores. Las métricas se emparejan sobre los mismos eventos evaluables.',
      'Los intervalos remuestrean eventos emparejados y jornadas Puerto Rico como sensibilidad. Son descriptivos; la dependencia por equipos y las comparaciones múltiples limitan su interpretación.',
      'La completitud de jornadas se verifica dentro de la cohorte archivada de cada variante; no certifica cobertura del calendario completo de la NHL. La integridad de la lectura corresponde al adaptador.',
      'Las secuencias L10 y el calendario se verifican internamente contra el contrato y los indicadores de la fuente. Este evaluador no recertifica el calendario bruto de forma independiente.',
      'Las métricas usan ganador del partido completo, con prórroga y shootout. Los comparadores Poisson o cuotas con contrato de mercado sin acreditar conservan esa limitación.',
      'Porteros y sus muestras numéricas se incluyen en el inventario, pero no entran al ajuste sin titularidad y correspondencia de identidad acreditadas. Los períodos permanecen descriptivos.',
      'Sin partidos finales evaluables, métricas e intervalos son nulos; no se imputan resultados, ceros ni probabilidades de candidatos.',
    ], readOnly: true, providerCalls: 0, databaseWrites: 0, predictionAdjustment: false, officialPick: false, modelPromoted: false};
}

function statusLabel(status) {
  return {INPUT_UNAVAILABLE: 'Entrada no verificable', EMPTY: 'Sin decisiones elegibles', FEATURE_UNAVAILABLE: 'Variable no acreditada',
    INSUFFICIENT_SETTLED_HISTORY: 'Sin historial final suficiente', INSUFFICIENT_TRAINING_HISTORY: 'Sin entrenamiento anterior suficiente',
    DESCRIPTIVE_REPLAY_AVAILABLE: 'Comparación retrospectiva descriptiva disponible'}[status] ?? status;
}
