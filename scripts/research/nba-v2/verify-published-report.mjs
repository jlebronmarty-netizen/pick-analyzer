// Offline verification of SELECT exports. Never connects to a database or provider.
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {evaluateForward} from './forward-metrics.mjs';
import {holdoutFrom} from './daily/runner.mjs';

const [modelPath, forecastsPath, judgmentsPath, reportPath] = process.argv.slice(2);
if (!reportPath) throw Error('Usage: verify-published-report.mjs model.json forecasts.json judgments.json report.json');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const forecasts = read(forecastsPath);
const judgments = read(judgmentsPath);
const report = read(reportPath);
const model = read(modelPath);
if (report.modelHash !== createHash('sha256').update(JSON.stringify(model)).digest('hex')) {
  throw Error('PUBLISHED_V2_MODEL_DIFFERS');
}
const batches = forecasts.map(({record}) => ({modelHash:record.modelHash,frozenAt:record.frozenAt,rows:[record]}));
const settlements = judgments.map(observation => ({
  modelHash:observation.model_hash,
  checkedAt:new Date(observation.captured_at).toISOString(),
  outcomes:observation.record.result ? [observation.record] : [],
  pending:observation.record.reason ? [observation.record] : []
}));
const scopes = evaluateForward(model,batches,settlements,{
  asOf:report.asOf,holdoutFrom,includeEmpty:true,includeCombined:true,
  benchmarks:forecasts.map(forecast=>forecast.benchmark)
});
if (!isDeepStrictEqual(scopes,report.scopes)) throw Error('PUBLISHED_V2_METRICS_DIFFER');
console.log(JSON.stringify({asOf:report.asOf,modelHash:report.modelHash,metricsIdentical:true,scopes},null,2));
