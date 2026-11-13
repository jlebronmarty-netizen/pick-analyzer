import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('GOAT shadow persists real pregame feature quality instead of hard-coded zero',()=>{
 const s=read('src/services/nba-current-era-shadow-canary.service.ts');
 assert.match(s,/featureQualityScore: modelPrediction\.featureQualityScore/);
 assert.match(s,/dataSufficiencyScore: modelPrediction\.dataSufficiencyScore/);
 assert.match(s,/pregameFeatureScoresCaptured: true/);
});

test('NBA causal diagnostics are market-aware',()=>{
 const s=read('src/services/nba-causal-learning.service.ts');
 assert.match(s,/market==='moneyline'/);
 assert.match(s,/market==='spread'/);
 assert.match(s,/market==='total'/);
 assert.match(s,/TOTAL_PROJECTION_ERROR_15_PLUS/);
 assert.match(s,/SPREAD_MISS_10_PLUS/);
 assert.match(s,/PREGAME_QUALITY_SCORE_UNAVAILABLE/);
 assert.match(s,/teamMarket\?getNbaCausalV2Evidence/);
});

test('GOAT direct result fallback is bounded and delayed',()=>{
 const s=read('src/services/nba-goat-results.service.ts');
 assert.match(s,/DIRECT_FALLBACK_AGE_MS=6\*3600000/);
 assert.match(s,/\.slice\(0,1\)/);
 assert.match(s,/balldontlie_direct_game_fallback/);
 assert.match(s,/providerCalls/);
});

test('GOAT pregame context capture is bounded and audit-only',()=>{
 const s=read('src/services/nba-goat-pregame-context.service.ts');
 assert.match(s,/FRESH_MS=90\*60000/);
 assert.match(s,/WINDOW_MS=18\*3600000/);
 assert.match(s,/projected_lineups/);
 assert.match(s,/player_injuries/);
 assert.match(s,/usedAsScoringInput:false/);
 assert.ok(!/saveModelVersion|runAutoModelTuning|model_weights/.test(s));
});

test('GOAT runtime attaches pregame context as provenance only',()=>{
 const s=read('src/services/nba-goat-runtime.service.ts');
 assert.match(s,/pregameContextSnapshotId/);
 assert.match(s,/pregameContextUsedAsScoringInput:false/);
});

test('settlement backlog distinguishes current GOAT from legacy',()=>{
 const s=read('src/services/nba-prediction-settlement.service.ts');
 assert.match(s,/goatCurrentEra/);
 assert.match(s,/legacyAndOther/);
});

test('NBA audit keeps model and official picks immutable',()=>{
 const s=read('src/services/nba-goat-audit.service.ts');
 assert.match(s,/officialPicksModified:false/);
 assert.match(s,/productionModelFormulaChanged:false/);
 assert.match(s,/autoApply:false/);
 assert.match(s,/autoPromotion:false/);
});
