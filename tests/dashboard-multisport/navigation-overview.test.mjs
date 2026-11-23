import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import SportModelOverview from '../../src/components/dashboard/SportModelOverview.tsx';
const cohort=(version,wins,losses,games)=>({key:version,label:'NBA GOAT '+version,modelVersion:version,available:true,wins,losses,pending:0,pushes:0,voids:0,models:1,accuracy:wins/(wins+losses),settledUniqueGames:games,note:'Versión separada'});
test('sport entry shows one NBA cohort while prior versions remain outside the navigation link',()=>{
 const html=renderToStaticMarkup(React.createElement(SportModelOverview,{cards:[{key:'nba',label:'NBA',href:'/nba-decision-board',classification:'SHADOW',metricLabel:'Moneyline',models:2,cohorts:[cohort('nba_prediction_engine_v1_1_inputs_shadow',0,1,1),cohort('nba_prediction_engine_v1',33,16,49)]}]}));
 const entry=html.slice(0,html.indexOf('</a>'));
 assert.match(entry,/href="\/nba-decision-board"/);
 assert.match(entry,/0\.00%/);
 assert.match(entry,/1 contratos evaluados/);
 assert.match(entry,/1 juegos únicos liquidados/);
 assert.doesNotMatch(entry,/67\.35%/);
 assert.match(html.slice(html.indexOf('</a>')),/67\.35%/);
 assert.match(html,/<\/a><details/);
 assert.doesNotMatch(html,/Accuracy combinada/);
});
test('unavailable accuracy and unknown independent sample are never rendered as zero',()=>{
 const html=renderToStaticMarkup(React.createElement(SportModelOverview,{cards:[{key:'nhl',label:'NHL',href:'/nhl',classification:'MODEL_ONLY',cohorts:[{key:'HISTORY',label:'NHL registrado',available:true,wins:3,losses:1,pending:2,pushes:0,voids:0,models:1,accuracy:0.75,note:'Muestra por contratos'}]},{key:'ncaab',label:'NCAAB',href:'/ncaab',classification:'SHADOW',cohorts:[{key:'UNKNOWN',label:'Datos no verificados',available:false,wins:null,losses:null,pending:null,pushes:null,voids:null,models:null,accuracy:null,note:'Lectura fallida'}]}]}));
 assert.match(html,/75\.00%/);
 assert.match(html,/4 contratos evaluados/);
 assert.match(html,/Resultados no conectados o no disponibles/);
 assert.doesNotMatch(html,/>0\.00%/);
 assert.doesNotMatch(html,/0 juegos únicos/);
 assert.doesNotMatch(html,/4 juegos únicos/);
});
