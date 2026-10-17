// Offline replay of the captured integration audit. Never used by the live service.
// Run from repo root with the dashboard TSX loader. Frozen readAt is intentional.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseTtReport} from '../../../src/lib/table-tennis-report.ts';
const bytes=fs.readFileSync(new URL('./table-tennis-source-20261017.json.gz',import.meta.url));
if(createHash('sha256').update(bytes).digest('hex')!=='55d807f55d0efd7d401c1ed0117fbdf9a70d972b701015198bc40e7ee292e65e')throw Error('ARCHIVE_HASH_MISMATCH');
const raw=JSON.parse(gunzipSync(bytes).toString('utf8'));
const report=parseTtReport(raw,Date.parse(raw.readAt));
console.log(JSON.stringify({status:report.status,readAt:report.readAt,historyFinals:report.historyFinals,metrics:report.metrics,providerCalls:0,databaseWrites:0},null,2));
