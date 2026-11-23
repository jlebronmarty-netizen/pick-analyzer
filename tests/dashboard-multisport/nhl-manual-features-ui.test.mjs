import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import NhlManualFeaturesPanel,{NhlManualFeaturesContent} from '../../src/components/dashboard/NhlManualFeaturesPanel.tsx';
import {buildNhlManualFeaturesReport,unavailableNhlManualFeaturesReport} from '../../src/lib/nhl-manual-features.mjs';
import {manualRow} from '../fixtures/nhl-manual-features.mjs';

test('shared NHL panel starts on demand and clearly leaves probabilities unchanged',()=>{
  const html=renderToStaticMarkup(React.createElement(NhlManualFeaturesPanel));
  assert.ok(html.includes('Consultar datos compartidos'));assert.ok(html.includes('Todavía no ajustan las probabilidades'));
  assert.ok(!html.includes('Portero de prueba'));
});
test('stored fixtures render both clocks, partial cutoffs and probable status',()=>{
  const report=buildNhlManualFeaturesReport({rows:[manualRow()],date:'2026-11-23',cutoff:'2026-11-23T18:00:00Z',evidence:{complete:true}});
  const html=renderToStaticMarkup(React.createElement(NhlManualFeaturesContent,{report}));
  for(const value of ['MIN en VGK','Disponible en Pick:','Generado por la fuente:','Probable','PP/PK tiene otro corte','Últimos diez completos','Portero de prueba'])assert.ok(html.includes(value),value);
  assert.ok(!html.includes('CONFIRMADO'));
});
test('missing percentages and goalie status remain readable without fake numbers',()=>{
  const row=manualRow();row.feature_payload.teams.away.special_teams.pp_pct=null;row.feature_payload.teams.away.reported_goalie.status='NO_CONFIRMADO';
  const report=buildNhlManualFeaturesReport({rows:[row],date:'2026-11-23',cutoff:'2026-11-23T18:00:00Z',evidence:{complete:true}});
  const html=renderToStaticMarkup(React.createElement(NhlManualFeaturesContent,{report}));
  assert.ok(html.includes('Sin confirmar'));assert.ok(html.includes('PP: Sin dato'));assert.ok(!html.includes('Sin dato%'));assert.ok(!html.includes('NO_CONFIRMADO'));
});
test('table not installed remains an informative state with no fake fixtures',()=>{
  const report=unavailableNhlManualFeaturesReport('NOT_INSTALLED',{date:'2026-11-23',cutoff:'2026-11-23T18:00:00Z'});
  const html=renderToStaticMarkup(React.createElement(NhlManualFeaturesContent,{report}));
  assert.ok(html.includes('aún no está instalado'));assert.ok(!html.includes('partidos guardados'));
});
