import {readFileSync,writeFileSync} from 'node:fs';
import {previewProbabilityBoard} from '../../../src/lib/nba/decision-shadow-v2.mjs';
const [boardFile,batchFile,out]=process.argv.slice(2);
if(!out)throw Error('Usage: node preview.mjs archived-board.json forward.json new-preview.json');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
writeFileSync(out,JSON.stringify(previewProbabilityBoard(read(boardFile),read(batchFile))),{flag:'wx'});
