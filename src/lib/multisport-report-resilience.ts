import {unavailableQualifiedReport, type QualifiedReport} from './qualified-plays';
import {unavailableNhlReport, type NhlReport} from './nhl-external-report';
import {unavailableSoccer, type SoccerReport} from './soccer-shadow-report';
import {unavailableTt, type TtReport} from './table-tennis-report';
import type {NcaabReport} from './ncaab-checkpoint';
import {emptyUfc, type UfcReport} from './ufc/free-v2';
import {LEAGUES, metrics, type LeagueReport} from './free-sports/model';
import {buildEdgeLabOverviewCard} from './edge-lab/overview-cards.mjs';
import type {SportModelCard} from './sport-model-overview';
import type {getMlbOfficialPerformance} from '../services/pick2-mlb-performance-read.service';

// Leave time for the existing 25-second table-tennis read to settle normally.
export const MULTISPORT_READ_TIMEOUT_MS = 28_000;

export type MultisportInputs = {
  research: QualifiedReport;
  official: Awaited<ReturnType<typeof getMlbOfficialPerformance>> | null;
  nhl: NhlReport;
  soccer: SoccerReport;
  tableTennis: TtReport;
  ncaab: NcaabReport;
  ufc: UfcReport;
  edgeLabCards: SportModelCard[];
  nbaCard: SportModelCard;
  freeSports: LeagueReport[];
};
export type MultisportSource = keyof MultisportInputs;
export type MultisportReaders = {[K in MultisportSource]: () => Promise<MultisportInputs[K]>};
export type MultisportReadFailure = {source: MultisportSource; code: 'TIMEOUT' | 'FAILED'};
type ReadOptions = {timeoutMs?: number; onFailure?: (failure: MultisportReadFailure) => void};

const sourceLabels: Record<MultisportSource, string> = {
  research: 'MLB · fórmulas', official: 'MLB · rendimiento oficial', nhl: 'NHL',
  soccer: 'Fútbol · calendario', tableTennis: 'Tenis de mesa · calendario',
  ncaab: 'NCAAB', ufc: 'UFC', edgeLabCards: 'Edge Lab · resultados',
  nbaCard: 'NBA', freeSports: 'NFL, tenis y BSN',
};

const unavailable: {[K in MultisportSource]: () => MultisportInputs[K]} = {
  research: unavailableQualifiedReport,
  official: () => null,
  nhl: unavailableNhlReport,
  soccer: unavailableSoccer,
  tableTennis: unavailableTt,
  ncaab: () => ({status: 'UNAVAILABLE', warning: 'NCAAB: no se pudieron cargar los datos; calendario y resultados no disponibles.'}),
  ufc: () => ({...emptyUfc(), issues: ['UFC: no se pudieron cargar los datos.']}),
  edgeLabCards: () => {
    const checkedAt = new Date().toISOString();
    return ['SOCCER', 'TT', 'NCAAF'].map(sport => buildEdgeLabOverviewCard(sport, null, checkedAt));
  },
  nbaCard: () => ({
    key: 'nba', label: 'NBA', href: '/nba-market-data', classification: 'SHADOW / MODEL_ONLY · GOAT', metricLabel: 'Moneyline',
    cohorts: [{key: 'NBA_GOAT', label: 'NBA GOAT · cohort prospectivo', available: false,
      wins: null, losses: null, pending: null, pushes: null, voids: null, models: null, accuracy: null,
      note: 'Reporte GOAT no disponible; no se sustituye por cero.'}],
  }),
  // Keep the existing league contract. UNAVAILABLE makes public counts/accuracy
  // null; these empty containers are never evidence of zero events or results.
  freeSports: () => LEAGUES.map(league => ({league, status: 'UNAVAILABLE', sourceAt: null,
    history: 0, upcoming: [], rows: [], metrics: metrics([])})),
};

function reportFailure(failure: MultisportReadFailure) {
  // Only our fixed source key and code are logged, never provider error text.
  console.warn('[multisport-report]', failure.source, failure.code);
}

function readBounded<K extends MultisportSource>(
  source: K,
  read: MultisportReaders[K],
  timeoutMs: number,
  onFailure: (failure: MultisportReadFailure) => void,
): Promise<MultisportInputs[K]> {
  return new Promise(resolve => {
    let settled = false;
    const fail = (code: MultisportReadFailure['code']) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      onFailure({source, code});
      resolve(unavailable[source]());
    };
    const timer = setTimeout(() => fail('TIMEOUT'), timeoutMs);
    // This bounds presentation, not the underlying I/O. Source services retain
    // their own abort policies. Keep both handlers attached after the deadline
    // so a late rejection is consumed and cannot change the rendered fallback.
    Promise.resolve().then(read).then(value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, () => fail('FAILED'));
  });
}

export async function readMultisportInputs(readers: MultisportReaders, options: ReadOptions = {}) {
  const failures: MultisportReadFailure[] = [];
  const onFailure = (failure: MultisportReadFailure) => {
    failures.push(failure);
    (options.onFailure ?? reportFailure)(failure);
  };
  const load = <K extends MultisportSource>(source: K) =>
    readBounded(source, readers[source], options.timeoutMs ?? MULTISPORT_READ_TIMEOUT_MS, onFailure);
  const [research, official, nhl, soccer, tableTennis, ncaab, ufc, edgeLabCards, nbaCard, freeSports] = await Promise.all([
    load('research'), load('official'), load('nhl'), load('soccer'), load('tableTennis'),
    load('ncaab'), load('ufc'), load('edgeLabCards'), load('nbaCard'), load('freeSports'),
  ]);
  const readWarnings = failures.map(({source, code}) => `${sourceLabels[source]}: ${code === 'TIMEOUT'
    ? 'la lectura tardó demasiado' : 'no se pudieron cargar los datos'}. Datos no disponibles en esta carga; puedes volver a intentarlo.`);
  return {research, official, nhl, soccer, tableTennis, ncaab, ufc, edgeLabCards, nbaCard, freeSports, readWarnings};
}
