import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import SportDecisionBoard from '../../src/components/dashboard/SportDecisionBoard.tsx';
const row={id:'ok',market:'ml',matchup:'Local vs Visitante',selection:'Verificada',status:'SHADOW',
  eligible:true,startsAt:'invalid-archive-time',dataQuality:{status:'VALIDATED',issues:[]}};
const render=(sport,rows)=>renderToStaticMarkup(React.createElement(SportDecisionBoard,{sport,rows}));
test('shared Top preserves the verified model signal, exposes pending evidence separately and tolerates missing dates',()=>{
 for(const sport of ['NHL','NCAAB','NCAAF','Soccer','Table Tennis']){
  const html=render(sport,[row,{...row,id:'pending',selection:'En revisión',dataQuality:{status:'PARTIAL',issues:[{reason:'ARCHIVE_PENDING'}]}}]);
  assert.equal((html.match(/<article/g)??[]).length,1);
  assert.match(html,/SEÑAL FAVORABLE/);assert.match(html,/Sin fecha/);assert.match(html,/pendientes de cotejo/);
  assert.ok(html.indexOf('En revisión')>html.indexOf('</article>'));
 }
});
test('more than 100 unpublished model signals remain reachable in their market',()=>{
 const rows=Array.from({length:117},(_,i)=>({...row,id:String(i),eligible:false,dataQuality:undefined}));
 const html=render('NHL',rows);
 assert.equal((html.match(/<article/g)??[]).length,100);
 assert.match(html,/Ver más resultados/);assert.doesNotMatch(html,/SEÑAL FAVORABLE/);
});
