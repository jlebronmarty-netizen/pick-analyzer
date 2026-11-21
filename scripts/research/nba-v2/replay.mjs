import {challengeReplay} from './challenge-replay.mjs';
import {study} from './study.mjs';
import {MODELV} from '../../../src/lib/nba/decision-residual-v2.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildSamples} from './archive.mjs';

const [prefix,output]=process.argv.slice(2);
if(!prefix||!output) throw Error('Usage: node replay.mjs /tmp/pick-v2- docs/research/nba-v2');
const names=['games','players','prices','pairs'];
const data=names.map(k=>JSON.parse(readFileSync(prefix+k+'.json','utf8')));
const hashes=Object.fromEntries(data.map((rows,i)=>[names[i],createHash('sha256').update(JSON.stringify(rows)).digest('hex')]));
const {samples,coverage}=buildSamples(...data);
const selected={},results={};
for(const scope of new Set(samples.map(x=>x.scope))) {
  const {artifact,report}=study(samples.filter(r=>r.scope===scope),scope);
  selected[scope]=artifact;
  results[scope]=report;
}
const replacer=(_k,v)=>typeof v==='number'?Number(v.toFixed(8)):v;
function save(name,obj){writeFileSync(output+'/'+name,JSON.stringify(obj,replacer,2)+'\n');}
save('replay.json',{version:MODELV,holdout:'2024-25_RETROSPECTIVE',sourceHashes:hashes,coverage,results,challenge:challengeReplay(samples,selected)});
save('model.json',{version:MODELV,trainingEnd:'2023-07-01T00:00:00Z',selectionEnd:'2024-07-01T00:00:00Z',
  strategy:'historically fitted; pregame SHADOW only',scopes:selected});
