import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import NcaabDashboard from '../../src/components/dashboard/NcaabDashboard.tsx';
import {buildNcaabArchivedEvidence} from '../../src/lib/ncaab-archived-evidence.ts';
import {archiveForecast,archiveReceipt,archiveAsOf,archiveDate} from './ncaab-archived-evidence.mjs';

// Run through the same React JSX loader as the dashboard integration suite,
// outside Playwright's component-test transform. No live services are needed.
globalThis.fetch=()=>{throw new Error('NETWORK_FORBIDDEN_IN_OFFLINE_FIXTURE');};
function compiledStyles(directory) {
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const file=join(directory,entry.name);
    return entry.isDirectory()?compiledStyles(file):entry.name.endsWith('.css')?[file]:[];
  });
}
const data=JSON.parse(readFileSync('src/data/ncaab-checkpoint.json','utf8'));
const forecast=archiveForecast(),receipt=archiveReceipt();
receipt.captured_at='2026-11-21T19:00:00Z';
data.observations=[forecast];data.generatedAt=archiveAsOf;
data.models=data.models.map(m=>({...m,forecasts:m.id==='NCAAB_PRESEASON_V1'?1:0,
  abstentions:0,settled:0,wins:0,losses:0,winnerDenominator:0,accuracy:null}));
data.archivedEvidence=buildNcaabArchivedEvidence({forecasts:[forecast],receipts:[receipt],asOf:archiveAsOf,dates:[archiveDate]});
const styles=compiledStyles('.next/static').map(file=>readFileSync(file,'utf8')).join('\n');
assert.ok(styles.length>100,'Run npm run build before the browser fixture');
const html=renderToStaticMarkup(React.createElement(NcaabDashboard,{report:{status:'AVAILABLE',data}}));
process.stdout.write(`<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body class="bg-slate-950 text-white"><main>${html}</main></body></html>`);
