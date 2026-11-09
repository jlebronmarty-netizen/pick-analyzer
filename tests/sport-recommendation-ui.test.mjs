import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const files={
 nba:'src/app/nba-market-data/model-report.jsx',
 edge:'src/app/edge-lab/board.jsx',
 ncaaf:'src/app/edge-lab/ncaaf-panel.jsx',
 card:'src/components/dashboard/SportRecommendationCard.jsx'
};
test('Shared recommendation card matches NHL information hierarchy',()=>{const s=fs.readFileSync(files.card,'utf8');for(const x of ['eyebrow','title','matchup','lines','priceLine','timeLine','warning','result'])assert.match(s,new RegExp(x));});
test('NBA is card-first and keeps history technical',()=>{const s=fs.readFileSync(files.nba,'utf8');assert.match(s,/SportRecommendationCard/);assert.match(s,/Snapshot prepartido/);assert.match(s,/Ver historial técnico/);assert.ok(s.indexOf('SportRecommendationCard')<s.indexOf('Ver historial técnico'));});
test('Soccer and TT use the shared recommendation card',()=>{const s=fs.readFileSync(files.edge,'utf8');assert.match(s,/SportRecommendationCard/);assert.match(s,/Snapshot prepartido/);assert.match(s,/Ver historial técnico/);assert.match(s,/ledgerView.rows.filter/);});
test('NCAAF PPG uses the shared recommendation card and keeps accuracy visible',()=>{const s=fs.readFileSync(files.ncaaf,'utf8');assert.match(s,/SportRecommendationCard/);assert.match(s,/Accuracy y error numérico/);assert.match(s,/Ver historial técnico/);assert.ok(s.indexOf('Accuracy y error numérico')<s.indexOf('Selecciones PPG'));});
test('Existing NHL remains reference and unchanged',()=>{const d=execFileSync('git',['diff','--name-only','0629d6471dc353cf92d70a8b48ab89e74becca45','HEAD','--','src/components/dashboard/NhlDashboard.tsx'],{encoding:'utf8'});assert.equal(d,'');});
test('No service API model cron provider or settlement changes',()=>{const d=execFileSync('git',['diff','--name-only','0629d6471dc353cf92d70a8b48ab89e74becca45','HEAD','--','src/services','src/lib/edge-lab','src/lib/nba','src/app/api','vercel.json'],{encoding:'utf8'});assert.equal(d,'');});
test('NCAAB and UFC stay card-first',()=>{const n=fs.readFileSync('src/components/dashboard/NcaabDashboard.tsx','utf8'),u=fs.readFileSync('src/components/dashboard/UfcDashboard.tsx','utf8');assert.match(n,/grid gap-4 lg:grid-cols-2/);assert.match(n,/NcaabForecastSummary/);assert.match(u,/grid gap-4 lg:grid-cols-2/);assert.match(u,/Selección del modelo/);});
