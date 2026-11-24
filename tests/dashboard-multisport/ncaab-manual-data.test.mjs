import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import NcaabDashboard from '../../src/components/dashboard/NcaabDashboard.tsx';
import {NcaabManualDataContent} from '../../src/components/dashboard/NcaabManualDataPanel.tsx';
import {unavailableNcaabManualDataReport} from '../../src/lib/ncaab-manual-data.ts';

test('shared analysis remains available when the original forecast overview is unavailable',()=>{
 const html=renderToStaticMarkup(React.createElement(NcaabDashboard,{report:{status:'UNAVAILABLE',warning:'Historial no disponible.'}}));
 assert.match(html,/Datos compartidos para el análisis/);
 assert.match(html,/Consultar datos compartidos/);
 assert.match(html,/Fecha en Puerto Rico/);
 assert.doesNotMatch(html,/Accuracy.*0\.00/);
});
test('an unavailable shared read exposes no performance counters or invented teams',()=>{
 const report=unavailableNcaabManualDataReport({date:'2026-11-24',readAt:'2026-11-24T12:00:00Z',reason:'SOURCE_METADATA_UNAVAILABLE'});
 const html=renderToStaticMarkup(React.createElement(NcaabManualDataContent,{report}));
 assert.match(html,/role="alert"/);
 assert.match(html,/No se muestran estadísticas parciales/);
 assert.doesNotMatch(html,/Finales observados|Partidos de la fecha|Por comenzar/);
});
test('verified empty report keeps source/read clocks and separates observed archive from Division I coverage',()=>{
 const report=unavailableNcaabManualDataReport({date:'2026-11-24',readAt:'2026-11-24T12:00:00Z',reason:'EMPTY'});
 report.status='EMPTY';report.coverage.readComplete=true;report.warnings=['Sin partidos capturados.'];
 const html=renderToStaticMarkup(React.createElement(NcaabManualDataContent,{report}));
 assert.match(html,/role="tablist"/);
 assert.equal((html.match(/role="tab"/g)??[]).length,5);
 assert.match(html,/Récords|récords/);
 assert.match(html,/no es un listado completo de División I/);
 assert.match(html,/Fecha PR: 2026-11-24/);
 assert.match(html,/no recalcula pronósticos/);
});
