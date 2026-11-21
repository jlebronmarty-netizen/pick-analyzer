/** Read-only interpretation of receipts already saved by the ordinary NCAAB cron.
 * A provider field named `close` is not proof of a closing or executable price.
 * This module never supplies odds to a model, an EV calculation or a pick writer.
 */
import {ncaabEvidenceTime} from './ncaab-calibration-evidence.mjs';

export const NCAAB_ARCHIVE_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard';
export const NCAAB_ARCHIVE_MAX_EVENTS = 999;
export type ArchiveForecast = {
  event_id: string; home_id: string; away_id: string; scheduled_at: string;
  created_at: string | null; state: string; review_required?: boolean;
};
export type NcaabArchiveReceipt = { id: string; captured_at: string; source_url: string; body: unknown };
export type NcaabArchivedQuote = {
  market: 'MONEYLINE' | 'SPREAD' | 'TOTAL'; sportsbook: string;
  first: { side: 'HOME' | 'OVER'; line: number | null; americanOdds: number };
  second: { side: 'AWAY' | 'UNDER'; line: number | null; americanOdds: number };
  providerField: string; period: 'FULL_GAME'; overtime: 'UNVERIFIED';
};
export type NcaabEventArchiveEvidence = {
  eventId: string; status: 'REFERENCE_ONLY' | 'BLOCKED' | 'MISSING';
  sourceId: string | null; capturedAt: string | null; sourceUrl: string | null;
  knownAtOriginalEmission: boolean | null; ageMinutes: number | null;
  operatorTimestamp: null; neutralSite: boolean | null; quotes: NcaabArchivedQuote[];
  reasons: string[]; currentExecutable: false; contractVerified: false;
  validatedProbability: null; expectedValue: null; eligible: false;
};
export type NcaabArchivedEvidence = {
  status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE'; asOf: string; dates: string[];
  sourceCount: number; matchedEvents: number; quotedEvents: number;
  sourceErrors: string[]; events: Record<string, NcaabEventArchiveEvidence>;
  providerCalls: 0; databaseWrites: 0;
};
type Obj = Record<string, unknown>;
const object = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const nested = (v: unknown, ...keys: string[]): unknown => keys.reduce<unknown>((a, k) => object(a)[k], v);
const timestamp = (v: unknown): number => ncaabEvidenceTime(v) ?? NaN;
const id = (v: unknown) => typeof v === 'string' && /^\d+$/.test(v) ? v : null;
const day = (v: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(v));
export const ncaabArchiveUrl = (date: string) => NCAAB_ARCHIVE_BASE + '?dates=' + date.replaceAll('-', '') + '&groups=50&limit=1000';
export function ncaabArchiveDates(asOf: string): string[] {
  const at = timestamp(asOf);
  if (!Number.isFinite(at)) throw Error('NCAAB_ARCHIVE_INVALID_AS_OF');
  return [-1, 0, 1].map(offset => day(new Date(at + offset * 86400000).toISOString()));
}
export function parseArchivedAmericanOdds(v: unknown): number | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const text = String(v);
  if (!/^[+-]?\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && Math.abs(n) >= 100 ? n : null;
}
function line(v: unknown, prefix = ''): number | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  let text = String(v);
  if (prefix && text.startsWith(prefix)) text = text.slice(1);
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
function quotePairs(menu: unknown, forecast: ArchiveForecast): { quotes: NcaabArchivedQuote[]; reasons: string[] } {
  if (!Array.isArray(menu)) return { quotes: [], reasons: ['NO_ODDS_IN_LATEST_RECEIPT'] };
  const candidates = new Map<string, NcaabArchivedQuote[]>();
  const reasons = new Set<string>();
  const invalid = new Set<string>();
  for (const raw of menu) {
    const q = object(raw), rawBook = nested(q, 'provider', 'name');
    if (typeof rawBook !== 'string' || !rawBook.trim()) { reasons.add('MISSING_OPERATOR'); continue; }
    const sportsbook = /^draft\s*kings$/i.test(rawBook.trim()) ? 'DraftKings' : rawBook.trim();
    if (nested(q, 'homeTeamOdds', 'team', 'id') !== forecast.home_id ||
        nested(q, 'awayTeamOdds', 'team', 'id') !== forecast.away_id) {
      reasons.add('QUOTE_TEAM_IDENTITY_MISMATCH');
      for (const market of ['MONEYLINE', 'SPREAD', 'TOTAL']) invalid.add(sportsbook + ':' + market);
      continue;
    }
    for (const [market, field, firstSide, secondSide] of [
      ['MONEYLINE', 'moneyline', 'home', 'away'],
      ['SPREAD', 'pointSpread', 'home', 'away'],
      ['TOTAL', 'total', 'over', 'under'],
    ] as const) {
      if (q[field] === undefined) continue;
      const key = sportsbook + ':' + market;
      const a = object(nested(q, field, firstSide, 'close')), b = object(nested(q, field, secondSide, 'close'));
      const firstOdds = parseArchivedAmericanOdds(a.odds), secondOdds = parseArchivedAmericanOdds(b.odds);
      const firstLine = market === 'MONEYLINE' ? null : line(a.line, market === 'TOTAL' ? 'o' : '');
      const secondLine = market === 'MONEYLINE' ? null : line(b.line, market === 'TOTAL' ? 'u' : '');
      if (firstOdds === null || secondOdds === null || (market !== 'MONEYLINE' &&
          (firstLine === null || secondLine === null || (market === 'SPREAD' ? firstLine + secondLine !== 0 : firstLine !== secondLine || firstLine <= 0)))) {
        reasons.add('INVALID_OR_INCOMPLETE_' + market + '_PAIR'); invalid.add(key); continue;
      }
      const value: NcaabArchivedQuote = {
        market, sportsbook, first: { side: market === 'TOTAL' ? 'OVER' : 'HOME', line: firstLine, americanOdds: firstOdds },
        second: { side: market === 'TOTAL' ? 'UNDER' : 'AWAY', line: secondLine, americanOdds: secondOdds },
        providerField: field + '.' + firstSide + '/' + secondSide + '.close', period: 'FULL_GAME', overtime: 'UNVERIFIED',
      };
      candidates.set(key, [...(candidates.get(key) ?? []), value]);
    }
  }
  const quotes: NcaabArchivedQuote[] = [];
  for (const [key, values] of candidates) {
    if (invalid.has(key)) continue;
    if (new Set(values.map(v => JSON.stringify(v))).size !== 1) { reasons.add('CONFLICTING_QUOTE_PAIRS'); continue; }
    quotes.push(values[0]);
  }
  if (!quotes.length && !reasons.size) reasons.add('NO_ODDS_IN_LATEST_RECEIPT');
  return { quotes: quotes.sort((a, b) => a.sportsbook.localeCompare(b.sportsbook) || a.market.localeCompare(b.market)), reasons: [...reasons] };
}
function empty(eventId: string): NcaabEventArchiveEvidence {
  return { eventId, status: 'MISSING', sourceId: null, capturedAt: null, sourceUrl: null,
    knownAtOriginalEmission: null, ageMinutes: null, operatorTimestamp: null, neutralSite: null,
    quotes: [], reasons: [], currentExecutable: false, contractVerified: false,
    validatedProbability: null, expectedValue: null, eligible: false };
}
export function buildNcaabArchivedEvidence(input: {
  forecasts: ArchiveForecast[]; receipts: NcaabArchiveReceipt[]; asOf: string; dates?: string[]; sourceErrors?: string[];
}): NcaabArchivedEvidence {
  const at = timestamp(input.asOf);
  if (!Number.isFinite(at)) throw Error('NCAAB_ARCHIVE_INVALID_AS_OF');
  const dates = input.dates ?? ncaabArchiveDates(input.asOf);
  const sources = new Map<string, NcaabArchiveReceipt[]>();
  const invalidDates = new Set<string>();
  const errors = new Set(input.sourceErrors ?? []);
  for (const date of dates) {
    const url = ncaabArchiveUrl(date);
    const dated = input.receipts.filter(r => r.source_url === url);
    // An unorderable receipt could be newer than every valid one. Do not let
    // filtering out its timestamp revive an earlier price from the same date.
    if (dated.some(r => !Number.isFinite(timestamp(r.captured_at)) || typeof r.id !== 'string' || !r.id)) {
      invalidDates.add(date); errors.add('INVALID_RECEIPT_ORDER:' + date); continue;
    }
    const matches = dated.filter(r => timestamp(r.captured_at) <= at)
      .sort((a, b) => timestamp(b.captured_at) - timestamp(a.captured_at) || a.id.localeCompare(b.id));
    if (!matches.length) { errors.add('NO_RECEIPT:' + date); continue; }
    const latest = matches.filter(r => timestamp(r.captured_at) === timestamp(matches[0].captured_at));
    sources.set(date, latest);
  }
  const events: Record<string, NcaabEventArchiveEvidence> = Object.create(null);
  const matchedEvents = new Set<string>();
  const counts = new Map<string, number>();
  for (const f of input.forecasts) counts.set(f.event_id, (counts.get(f.event_id) ?? 0) + 1);
  for (const f of input.forecasts) {
    if (f.state !== 'FORECAST' || !/^espn:\d+$/.test(f.event_id) || !Number.isFinite(timestamp(f.scheduled_at))) continue;
    const date = day(f.scheduled_at);
    if (!dates.includes(date)) continue; // Scope is explicit; no claim about the entire archive.
    const evidence = empty(f.event_id); events[f.event_id] = evidence;
    if (counts.get(f.event_id) !== 1 || f.review_required || !id(f.home_id) || !id(f.away_id) || f.home_id === f.away_id ||
        !Number.isFinite(timestamp(f.created_at)) || timestamp(f.created_at) >= timestamp(f.scheduled_at) || timestamp(f.created_at) > at) {
      evidence.status = 'BLOCKED'; evidence.reasons = ['FORECAST_REQUIRES_REVIEW']; continue;
    }
    if (invalidDates.has(date)) {
      evidence.status = 'BLOCKED'; evidence.reasons = ['INVALID_RECEIPT_ORDER']; continue;
    }
    const receipts = sources.get(date);
    if (!receipts?.length) { evidence.reasons = ['NO_RECEIPT_IN_WINDOW']; continue; }
    if (new Set(receipts.map(r => r.id)).size !== 1 || new Set(receipts.map(r => JSON.stringify(r.body))).size !== 1) {
      evidence.status = 'BLOCKED'; evidence.reasons = ['CONFLICTING_LATEST_RECEIPTS']; continue;
    }
    const receipt = receipts[0], raw = object(receipt.body), all = raw.events;
    evidence.sourceId = receipt.id; evidence.sourceUrl = receipt.source_url; evidence.capturedAt = receipt.captured_at;
    evidence.ageMinutes = (at - timestamp(receipt.captured_at)) / 60000;
    evidence.knownAtOriginalEmission = timestamp(receipt.captured_at) <= timestamp(f.created_at);
    if (!Array.isArray(all) || all.length > NCAAB_ARCHIVE_MAX_EVENTS) {
      evidence.status = 'BLOCKED'; evidence.reasons = ['INVALID_OR_TRUNCATED_RECEIPT']; errors.add('INVALID_RECEIPT:' + date); continue;
    }
    const found = all.map(object).filter(e => 'espn:' + id(e.id) === f.event_id);
    if (!found.length) { evidence.reasons = ['EVENT_ABSENT_FROM_LATEST_RECEIPT']; continue; }
    if (found.length !== 1 || !Array.isArray(found[0].competitions) || found[0].competitions.length !== 1) {
      evidence.status = 'BLOCKED'; evidence.reasons = ['AMBIGUOUS_EVENT']; continue;
    }
    const e = found[0], c = object((e.competitions as unknown[])[0]);
    const teams = Array.isArray(c.competitors) ? c.competitors.map(object) : [];
    const home = teams.filter(t => t.homeAway === 'home'), away = teams.filter(t => t.homeAway === 'away');
    if (teams.length !== 2 || home.length !== 1 || away.length !== 1 || home[0].id !== f.home_id || away[0].id !== f.away_id ||
        nested(home[0], 'team', 'id') !== f.home_id || nested(away[0], 'team', 'id') !== f.away_id || (c.id !== undefined && c.id !== e.id)) {
      evidence.status = 'BLOCKED'; evidence.reasons = ['EVENT_TEAM_IDENTITY_MISMATCH']; continue;
    }
    if (c.timeValid !== true || timestamp(c.date ?? e.date) !== timestamp(f.scheduled_at) ||
        [c.date, e.date].filter(v => v !== undefined).some(v => timestamp(v) !== timestamp(f.scheduled_at))) {
      evidence.status = 'BLOCKED'; evidence.reasons = ['UNVERIFIED_OR_CHANGED_SCHEDULE']; continue;
    }
    matchedEvents.add(f.event_id);
    evidence.neutralSite = typeof c.neutralSite === 'boolean' ? c.neutralSite : null;
    const states = [c.status, e.status].filter(v => v !== undefined).map(v => object(nested(v, 'type')));
    if (!states.length || states.some(state => state.state !== 'pre' || state.name !== 'STATUS_SCHEDULED' || state.completed !== false) ||
        timestamp(receipt.captured_at) >= timestamp(f.scheduled_at)) {
      evidence.status = 'BLOCKED'; evidence.reasons = ['NOT_A_PREGAME_RECEIPT']; continue;
    }
    const pairs = quotePairs(c.odds, f);
    evidence.quotes = pairs.quotes; evidence.reasons = pairs.reasons;
    if (!evidence.knownAtOriginalEmission) evidence.reasons.push('PRICE_CAPTURED_AFTER_FORECAST');
    evidence.reasons.push('EXECUTION_FRESHNESS_UNVERIFIED', 'OVERTIME_RULES_UNVERIFIED', 'MODEL_NOT_VALIDATED');
    evidence.status = pairs.quotes.length ? 'REFERENCE_ONLY' : 'BLOCKED';
  }
  const values = Object.values(events);
  return { status: sources.size === 0 ? 'UNAVAILABLE' : errors.size || values.some(e => e.status !== 'REFERENCE_ONLY') ? 'PARTIAL' : 'AVAILABLE',
    asOf: input.asOf, dates, sourceCount: sources.size, matchedEvents: matchedEvents.size,
    quotedEvents: values.filter(e => e.quotes.length > 0).length, sourceErrors: [...errors], events,
    providerCalls: 0, databaseWrites: 0 };
}
