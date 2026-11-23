import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NhlResearchAuditPanel, { NhlResearchAuditContent } from '../../src/components/dashboard/NhlResearchAuditPanel.tsx';

const report = () => ({
  status: 'READ_ONLY_NHL_RESEARCH_AUDIT',
  auditedAt: '2026-11-23T16:00:00Z',
  readOnly: true, providerCalls: 0, databaseWrites: 0,
  modelInputs: [{ model: 'Poisson propio', used: ['Goles previos y promedio según localía'], evidenceOnly: ['Porteros probables sin ajuste validado'] }],
  inventory: { entries: [{ key: 'context', label: 'Boxscores de prueba', records: 142,
    distinctGames: 142, from: '2026-11-03', to: '2026-11-22', latestCapturedAt: '2026-11-23T15:00:00Z',
    note: 'Fixture de presentación.' }], quality: [] },
  moneyline: {
    status: 'EXPLORATORY', sameInformationSet: false,
    cohorts: { fourWay: { games: 24, eventIds: [], dateRange: { from: '2026-11-19', to: '2026-11-22' } } },
    comparisons: [{ model: 'dratings', label: 'DRatings original', games: 24, hits: 13,
      accuracy: 13 / 24, brier: 0.25950, logLoss: 0.725, accuracyInterval95: { low: 0.35, high: 0.72 } }],
    pairedDifferences: [{ candidate: 'calibrated', baseline: 'dratings', games: 24,
      brier: { estimate: -0.01154, interval95: { low: -0.03, high: 0.02 } },
      logLoss: { estimate: -0.02, interval95: { low: -0.07, high: 0.04 } },
      accuracy: { estimate: 1 / 24, interval95: { low: -0.10, high: 0.20 } } }],
    calibration: [{ model: 'dratings', label: 'DRatings original', bins: [
      { label: '60–70%', lower: 0.60, upper: 0.70, games: 0, meanProbability: null,
        observedHomeWinRate: null, interval95: null },
      { label: '50–60%', lower: 0.50, upper: 0.60, games: 6, meanProbability: 0.55,
        observedHomeWinRate: 0.5, interval95: { low: 0.18, high: 0.82 } },
    ] }],
    timing: [{ model: 'dratings', label: 'DRatings original', games: 24, missing: 0,
      minMinutes: 90, medianMinutes: 360, maxMinutes: 900 }],
    exclusions: [{ eventId: 'nhl:fixture', source: 'fourWay', reason: 'NO_FINAL_AS_OF_CUTOFF' }],
  },
  features: {
    status: 'EXPLORATORY',
    variables: [{ id: 'goalie', label: 'Forma del portero probable', availableGames: 18,
      usedByOriginal: false, limitation: 'ESPN probable; identidad histórica de NHL verificada por separado.' }],
    cohort: { decisions: 24, settled: 24, training: 14, selection: 4, later: 6,
      splitPolicy: 'Corte cronológico exploratorio.' },
    ablations: [{ id: 'shots', label: 'Volumen de tiros', status: 'TESTED',
      trainingGames: 14, selectionGames: 4, laterGames: 6,
      baseline: { totalMAE: 2.5, marginMAE: 2.1 }, candidate: { totalMAE: 2.4, marginMAE: 2.2 },
      difference: { totalMAE: -0.1, marginMAE: 0.1 }, reason: 'Muestra insuficiente para concluir mejora.' },
    { id: 'rest', label: 'Descanso', status: 'UNAVAILABLE',
      trainingGames: 0, selectionGames: 0, laterGames: 0,
      baseline: { totalMAE: null, marginMAE: null }, candidate: { totalMAE: null, marginMAE: null },
      difference: { totalMAE: null, marginMAE: null }, reason: 'Calendario incompleto.' }],
    windowCoverage: { observed5: 12, observed10: 0, certified5: 0, certified10: 0, restCertified: 0 },
    exclusions: [], propsReadiness: { skaterStatRows: 5112, goalieStatRows: 300,
      status: 'INCOMPLETE', missing: ['Faltan líneas, precios y reglas de props.'] },
  },
  warnings: ['La muestra es exploratoria.'],
  nextSteps: ['Conservar un periodo futuro sin seleccionar fórmulas.'],
});

const html = value => renderToStaticMarkup(React.createElement(NhlResearchAuditContent, { report: value }));

test('NHL audit renders supplied denominators, losses, intervals and timestamps without relabeling research', () => {
  const result = html(report());
  for (const value of ['142', '13 / 24', '54.2%', '0.25950', '24 partidos independientes',
    '2026-11-03 a 2026-11-22', '360.0 min', '2.500 → 2.400', '− DRatings original',
    'NO_FINAL_AS_OF_CUTOFF', 'No utilizada', 'no son confirmaciones oficiales',
    'Qué utiliza cada modelo', 'Goles previos y promedio según localía', 'Porteros probables sin ajuste validado',
    'requieren partidos futuros', 'Faltan líneas, precios y reglas de props.']) {
    assert.ok(result.includes(value), value);
  }
  assert.ok(result.includes('momentos distintos'));
  assert.ok(!result.includes('JUGADA'));
});

test('missing common cohort and zero-bin metrics stay unavailable instead of becoming 0% accuracy', () => {
  const value = report();
  value.moneyline.cohorts.fourWay.games = 0;
  value.moneyline.comparisons = [];
  value.moneyline.calibration[0].bins = [value.moneyline.calibration[0].bins[0]];
  value.moneyline.pairedDifferences = [];
  const result = html(value);
  assert.ok(result.includes('Todavía no hay partidos válidos comunes'));
  assert.ok(result.includes('Sin evaluación'));
  assert.ok(!result.includes('0.0%'));
  assert.ok(!result.includes('NaN'));
  assert.ok(!result.includes('undefined'));
});

test('empty, failed and capped reads suppress previously supplied metrics', () => {
  for (const status of ['EMPTY_ARCHIVE', 'READ_UNAVAILABLE', 'SOURCE_SCAN_CAPPED']) {
    const result = html({ ...report(), status });
    assert.ok(result.includes('role="status"'));
    assert.ok(!result.includes('0.25950'));
    assert.ok(!result.includes('13 / 24'));
    assert.ok(!result.includes('Corte verificado'));
  }
});

test('initial NHL audit is collapsed and event-driven without fabricated archive counts', () => {
  const result = renderToStaticMarkup(React.createElement(NhlResearchAuditPanel));
  assert.ok(result.includes('<details>'));
  assert.ok(!result.includes('<details open'));
  assert.ok(result.includes('Consultar auditoría NHL'));
  assert.ok(result.includes('Cuotas Circa publicadas por DRatings'));
  assert.ok(!result.includes('0 partidos'));
  assert.ok(!result.includes('0.00000'));
});
