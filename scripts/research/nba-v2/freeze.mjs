import {readFileSync,writeFileSync,mkdtempSync,linkSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {planProbabilityFreeze} from '../../../src/lib/nba/decision-shadow-v2.mjs';
const [boardFile,modelFile,ledgerFile]=process.argv.slice(2);
if(!ledgerFile)throw Error('Usage: node freeze.mjs board.json model.json new-ledger.json');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const ledger=planProbabilityFreeze(read(boardFile),read(modelFile),new Date().toISOString());
if(!ledger.rows.length)throw Error('NO_ELIGIBLE_PROSPECTIVE_FORECASTS');
const tmp=mkdtempSync(join(dirname(ledgerFile),'.v2-freeze-'));
try {
  const file=join(tmp,'ledger');
  writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
  linkSync(file,ledgerFile); // Atomic create-only publication, even on simultaneous retries.
} finally {rmSync(tmp,{recursive:true,force:true});}
console.log(JSON.stringify({forecasts:ledger.rows.length,games:new Set(ledger.rows.map(r=>r.gameId)).size,frozenAt:ledger.frozenAt}));
