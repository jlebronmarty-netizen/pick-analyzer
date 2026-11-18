import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const board=readFileSync('src/app/nba-market-data/board.jsx','utf8');
test('NBA prop quote groups visible without pretending they are picks',()=>{
 assert.match(board,/Acceso rápido a mercados NBA/);
 for(const market of ['points','rebounds','assists','threes'])assert.match(board,new RegExp(market));
 assert.match(board,/cotizaciones del proveedor/);
 assert.match(board,/SHADOW \/ INVESTIGACIÓN/);
 assert.match(board,/no recomendaciones/i);
});
test('existing quote fetching, selected date, and safety notices remain',()=>{
 assert.match(board,/setMarket\(type\)/);
 assert.match(board,/prop_type/);
 assert.match(board,/action:'quote'/);
 assert.match(board,/Fecha de Puerto Rico/);
 assert.match(board,/Un prop publicado no confirma participación/);
});
