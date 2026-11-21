import {readFileSync,writeFileSync} from 'node:fs';
import {pairFromBoard} from './benchmarks.mjs';
const [boardFile,batchFile,out]=process.argv.slice(2);
if(!out)throw Error('Usage: receipt-context.mjs archived-board.json frozen-batch.json new-context.json');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const board=read(boardFile),batch=read(batchFile),rows=new Map(Object.values(board.rows).flat().map(r=>[r.id,r]));
const context=batch.rows.map(f=>{
  const r=rows.get(f.rowId);
  if(!r||r.quoteId!==f.quoteId||r.odds!==f.americanOdds||r.projection!==f.projection||r.line!==f.line||
    Date.parse(board.asOf)!==Date.parse(f.featuresAsOf))throw Error('UNMATCHED_FROZEN_RECEIPT');
  return {forecastId:f.forecastId,l5:r.l5,l10:r.l10};
});
writeFileSync(out,JSON.stringify({asOf:board.asOf,modelHash:batch.modelHash,
  games:Object.fromEntries(board.games.map(g=>[g.id,g])),benchmarks:batch.rows.map(f=>pairFromBoard(f,board)).filter(Boolean),
  context},null,2)+'\n',{flag:'wx'});
