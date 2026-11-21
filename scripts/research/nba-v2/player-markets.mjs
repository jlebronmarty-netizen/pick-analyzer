import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildSamples} from './archive.mjs';
import {study} from './study.mjs';
const [gamesFile,playerFile,out]=process.argv.slice(2);
if(!out)throw Error('Usage: node player-markets.mjs games.json player-markets.ndjson output.json');
const games=JSON.parse(readFileSync(gamesFile,'utf8'));
const source=readFileSync(playerFile,'utf8').trim().split('\n').map(l=>JSON.parse(l));
// Fixed research outcomes. No bookmaker lines or executable quotes are assumed.
const specs={points:[19.5,5],rebounds:[4.5,6],threes:[1.5,7],points_assists:[24.5,5,4],
  points_rebounds:[24.5,5,6],rebounds_assists:[9.5,6,4],points_rebounds_assists:[29.5,5,6,4]};
const results={};
for(const [statistic,[threshold,...fields]] of Object.entries(specs)) {
  const box=source.map(r=>[...r.slice(0,4),fields.every(i=>Number.isSafeInteger(r[i])&&r[i]>=0)?
    fields.reduce((sum,i)=>sum+r[i],0):null]);
  const {samples}=buildSamples(games,box,[],[],{statistic,threshold,weight:fields.length===1?.65:.4,playersOnly:true});
  const {report}=study(samples,'props_'+statistic);
  results[statistic]={threshold,...report};
}
writeFileSync(out,JSON.stringify({regime:'RETROSPECTIVE_REFERENCE_ONLY',sourceRows:source.length,
  sourceHash:createHash('sha256').update(JSON.stringify(source)).digest('hex'),results},
  (_k,v)=>typeof v==='number'?Number(v.toFixed(8)):v,2)+'\n');
