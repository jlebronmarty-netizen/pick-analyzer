import { z } from 'zod';
import type { ModelCohort } from './sport-model-overview';

const time = z.string().datetime({ offset: true });
const n = z.number().finite();
const row = z.object({ id: z.string().min(1), source: z.string(), source_match_id: z.string().min(1), scheduled_at: time, captured_at: time, competition: z.literal('TT Elite Series'), player_a: z.string().min(1), player_b: z.string().min(1), player_a_key: z.string().min(1), player_b_key: z.string().min(1) });
const forecast = row.extend({ model: z.enum(['TT_ML_V1', 'TT_TOTAL_V1']), status: z.enum(['FORECAST', 'ABSTAIN']), reason: z.string(), history_a: n.int().nonnegative(), history_b: n.int().nonnegative(), probability_a: n.min(0).max(1).nullable(), probability_b: n.min(0).max(1).nullable(), projected_total: n.positive().nullable(), home_decimal_odds: n.gt(1).nullable(), away_decimal_odds: n.gt(1).nullable(), market_no_vig_a: n.min(0).max(1).nullable(), market_no_vig_b: n.min(0).max(1).nullable(), model_edge_pp_a: n.nullable(), model_edge_pp_b: n.nullable() });
const final = row.extend({ sets_a: n.int().min(0).max(3), sets_b: n.int().min(0).max(3), set_points_a: z.array(n.int().nonnegative()), set_points_b: z.array(n.int().nonnegative()), total_points_final: n.int().positive(), winner_final: z.enum(['A', 'B']), settlement_source: z.string().nullable(), settlement_scraped_at: time.nullable() });
const schema = z.object({ schema: z.literal('TT_READ_BRIDGE_V1'), status: z.literal('AVAILABLE'), mode: z.literal('RESEARCH_SHADOW_ONLY'), complete: z.literal(true), readAt: time, providerCalls: z.literal(0), databaseWrites: z.literal(0), counts: z.object({ forecasts: n.int().nonnegative(), results: n.int().nonnegative() }), forecasts: z.array(forecast), results: z.array(final) });
export type TtForecast = z.infer<typeof forecast>;
export type TtFinal = z.infer<typeof final>;
export type TtObservation = TtForecast & { outcome: 'ABSTAIN' | 'PENDING' | 'AMBIGUOUS' | 'WIN' | 'LOSS' | 'SCORED'; final: TtFinal | null; error: number | null };
type Metrics = { model: 'TT_ML_V1' | 'TT_TOTAL_V1'; forecasts: number; abstentions: number; pending: number; ambiguous: number; settled: number; wins: number; losses: number; accuracy: number | null; brier: number | null; logLoss: number | null; mae: number | null; meanError: number | null };
export type TtReport = { status: 'AVAILABLE'; readAt: string; observations: TtObservation[]; metrics: Metrics[]; historyFinals: number; latestCapture: string | null; excludedModelObservations: number } | { status: 'UNAVAILABLE'; warning: string };
export const unavailableTt = (): TtReport => ({ status: 'UNAVAILABLE', warning: 'Tenis de mesa: lectura almacenada no disponible o incompleta. No se reemplaza con ceros.' });
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-7;
const pair = (r: { player_a_key: string; player_b_key: string }) => [r.player_a_key, r.player_b_key].sort().join('||');

// Accounting of immutable forecasts, not a new prediction or settlement writer.
// Source uses the same player pair +/-10 min. Ambiguous links remain unscored.
export function parseTtReport(input: unknown, now = Date.now()): TtReport {
  // A source addition must not disable already integrated models or silently
  // enter their accounting. Validate original counts before projecting scope.
  const envelope = schema.extend({ forecasts: z.array(z.object({ model: z.string().min(1) }).passthrough()) }).parse(input);
  if (envelope.counts.forecasts !== envelope.forecasts.length || envelope.counts.results !== envelope.results.length) throw Error('INCOMPLETE_SOURCE');
  const excludedModelObservations = envelope.forecasts.filter(f => f.model === 'TT_SETS_OE_V1').length;
  const scoped = envelope.forecasts.filter(f => f.model !== 'TT_SETS_OE_V1');
  const data = schema.parse({ ...envelope, forecasts: scoped, counts: { ...envelope.counts, forecasts: scoped.length } }), read = Date.parse(envelope.readAt);
  if (read > now + 5000 || now - read > 5 * 60000 || data.counts.forecasts !== data.forecasts.length || data.counts.results !== data.results.length) throw Error('INCOMPLETE_OR_STALE');
  const ids = new Set<string>(), economic = new Set<string>();
  for (const f of data.forecasts) {
    const key = f.model + ':' + f.source_match_id;
    if (ids.has(f.id) || economic.has(key) || Date.parse(f.captured_at) >= Date.parse(f.scheduled_at) || Date.parse(f.captured_at) > read || f.player_a_key === f.player_b_key) throw Error('INVALID_FORECAST');
    ids.add(f.id); economic.add(key);
    if (f.source !== 'pulsescore:netbet-prematch' || f.status === 'FORECAST' && Math.min(f.history_a, f.history_b) < 3) throw Error('INVALID_MODEL_GATE');
    if (f.status === 'ABSTAIN') {
      if (f.probability_a !== null || f.probability_b !== null || f.projected_total !== null) throw Error('INVALID_ABSTENTION');
    } else if (f.model === 'TT_ML_V1') {
      if (f.probability_a === null || f.probability_b === null || !close(f.probability_a + f.probability_b, 1) || f.projected_total !== null) throw Error('INVALID_PROBABILITY');
    } else if (f.projected_total === null || f.probability_a !== null || f.probability_b !== null) throw Error('INVALID_TOTAL');
    const prices = [f.home_decimal_odds, f.away_decimal_odds, f.market_no_vig_a, f.market_no_vig_b, f.model_edge_pp_a, f.model_edge_pp_b];
    if (prices.some(x => x !== null)) {
      const [a, b, pa, pb, ea, eb] = prices;
      if (prices.some(x => x === null) || f.probability_a === null || f.probability_b === null || !close(pa!, (1 / a!) / (1 / a! + 1 / b!)) || !close(pa! + pb!, 1) || !close(ea!, (f.probability_a - pa!) * 100) || !close(eb!, (f.probability_b - pb!) * 100)) throw Error('INVALID_PRICE_PAIR');
    }
  }
  ids.clear(); economic.clear();
  for (const r of data.results) {
    const key = r.source + ':' + r.source_match_id;
    if (Date.parse(r.scheduled_at) > read || Date.parse(r.captured_at) < Date.parse(r.scheduled_at)) throw Error('PREMATURE_FINAL');
    let a = 0, b = 0;
    if (ids.has(r.id) || economic.has(key) || r.source !== 'pulsescore:tipsport' || Date.parse(r.captured_at) > read || r.player_a_key === r.player_b_key || r.set_points_a.length !== r.set_points_b.length || r.set_points_a.length !== r.sets_a + r.sets_b) throw Error('INVALID_FINAL');
    r.set_points_a.forEach((p, i) => { const q = r.set_points_b[i]; if (p === q || Math.max(p, q) < 11 || Math.abs(p - q) < 2) throw Error('INVALID_SET'); if (p > q) a++; else b++; });
    if (a !== r.sets_a || b !== r.sets_b || Math.max(a, b) !== 3 || Math.min(a, b) > 2 || r.winner_final !== (a > b ? 'A' : 'B') || r.total_points_final !== [...r.set_points_a, ...r.set_points_b].reduce((s, x) => s + x, 0)) throw Error('INCONSISTENT_FINAL');
    ids.add(r.id); economic.add(key);
  }
  const byPair = new Map<string, TtFinal[]>();
  for (const r of data.results) byPair.set(pair(r), [...(byPair.get(pair(r)) ?? []), r]);
  const links = new Map<string, TtFinal[]>(), use = new Map<string, number>();
  for (const f of data.forecasts.filter(f => f.status === 'FORECAST')) {
    const candidates = (byPair.get(pair(f)) ?? []).filter(r => Math.abs(Date.parse(r.scheduled_at) - Date.parse(f.scheduled_at)) <= 10 * 60000 && Date.parse(f.captured_at) < Date.parse(r.scheduled_at));
    links.set(f.id, candidates);
    for (const r of candidates) { const k = f.model + ':' + r.id; use.set(k, (use.get(k) ?? 0) + 1); }
  }
  const observations: TtObservation[] = data.forecasts.map(f => {
    const candidates = links.get(f.id) ?? [];
    const ambiguous = candidates.length > 1 || candidates.some(r => use.get(f.model + ':' + r.id) !== 1);
    const r = !ambiguous && candidates.length === 1 ? candidates[0] : null;
    let outcome: TtObservation['outcome'] = f.status === 'ABSTAIN' ? 'ABSTAIN' : ambiguous ? 'AMBIGUOUS' : 'PENDING';
    let error = null;
    if (r && f.status === 'FORECAST') {
      if (f.model === 'TT_ML_V1') { const wonA = (r.winner_final === 'A' ? r.player_a_key : r.player_b_key) === f.player_a_key; outcome = (f.probability_a! >= .5) === wonA ? 'WIN' : 'LOSS'; }
      else { outcome = 'SCORED'; error = f.projected_total! - r.total_points_final; }
    }
    return { ...f, outcome, final: r, error };
  });
  const metrics: Metrics[] = (['TT_ML_V1', 'TT_TOTAL_V1'] as const).map(model => {
    const rows = observations.filter(f => f.model === model), scored = rows.filter(r => r.final !== null), wins = rows.filter(r => r.outcome === 'WIN').length, losses = rows.filter(r => r.outcome === 'LOSS').length;
    const avg = (fn: (r: TtObservation) => number) => scored.length ? scored.reduce((s, r) => s + fn(r), 0) / scored.length : null;
    const y = (r: TtObservation) => (r.final!.winner_final === 'A' ? r.final!.player_a_key : r.final!.player_b_key) === r.player_a_key ? 1 : 0;
    return { model, forecasts: rows.filter(r => r.status === 'FORECAST').length, abstentions: rows.filter(r => r.status === 'ABSTAIN').length, pending: rows.filter(r => r.outcome === 'PENDING').length, ambiguous: rows.filter(r => r.outcome === 'AMBIGUOUS').length, settled: scored.length, wins, losses, accuracy: wins + losses ? wins / (wins + losses) : null, brier: model === 'TT_ML_V1' ? avg(r => (r.probability_a! - y(r)) ** 2) : null, logLoss: model === 'TT_ML_V1' ? avg(r => { const p = Math.max(1e-12, Math.min(1 - 1e-12, r.probability_a!)); return -(y(r) * Math.log(p) + (1 - y(r)) * Math.log(1 - p)); }) : null, mae: model === 'TT_TOTAL_V1' ? avg(r => Math.abs(r.error!)) : null, meanError: model === 'TT_TOTAL_V1' ? avg(r => r.error!) : null };
  });
  return { status: 'AVAILABLE', readAt: data.readAt, observations, metrics, historyFinals: data.results.length, latestCapture: data.forecasts.map(f => f.captured_at).sort().at(-1) ?? null, excludedModelObservations };
}

export function ttModelCohort(r: TtReport): ModelCohort {
  if (r.status === 'UNAVAILABLE') return { key: 'SHADOW', label: 'TT · SHADOW', available: false, wins: null, losses: null, pending: null, pushes: null, voids: null, models: null, accuracy: null, note: r.warning };
  const ml = r.metrics.find(m => m.model === 'TT_ML_V1')!;
  return { key: 'SHADOW', label: 'TT_ML_V1 + TT_TOTAL_V1 · SHADOW', available: true, wins: ml.wins, losses: ml.losses, pending: ml.pending, pushes: 0, voids: 0, models: 2, accuracy: ml.accuracy, note: 'Accuracy del deporte: decisiones ML verificables. Totals se evalúa por MAE, sin línea O/U ni W/L. Enlaces por jugadores ±10 min; evidencia exploratoria.' };
}
