// Manual, read-only reproduction. No cron or provider calls.
import {writeFile} from 'node:fs/promises';
const [cutoff,output]=process.argv.slice(2);
if(!output||!cutoff||!/(Z|[+-]\d\d:\d\d)$/.test(cutoff)||!Number.isFinite(Date.parse(cutoff)))
  throw Error('Expected an ISO cutoff with an explicit timezone and a new output filename.');
process.env.NBA_DECISION_ARCHIVE_READ_BYTES='0';
const {readNbaDecisionBoard}=await import('../src/services/nba-decision-board.service.ts');
const board=await readNbaDecisionBoard({now:new Date(cutoff)});
await writeFile(output,JSON.stringify(board),{flag:'wx',mode:0o600});
console.log(JSON.stringify({asOf:board.asOf,summary:board.summary,readIssues:board.evidence.readIssues,marketCaptureIssues:board.evidence.marketCaptureIssues}));
