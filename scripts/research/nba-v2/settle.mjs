import {readFileSync,writeFileSync} from 'node:fs';
import {grade} from './daily/settlement.mjs';
const [batchFile,receiptsFile,out]=process.argv.slice(2);
if(!out)throw Error('Usage: node settle.mjs forward.json receipts.json new-outcomes.json');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const batch=read(batchFile),inputs=read(receiptsFile),checkedAt=new Date().toISOString();
const records=batch.rows.map(f=>grade(f,inputs[f.gameId],checkedAt));
writeFileSync(out,JSON.stringify({checkedAt,modelHash:batch.modelHash,outcomes:records.filter(r=>r.result),
  pending:records.filter(r=>r.reason)},null,2)+'\n',{flag:'wx'});
