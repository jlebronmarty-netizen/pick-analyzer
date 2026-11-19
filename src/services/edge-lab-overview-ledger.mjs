// Homepage-only read projection. Full protected reports keep their original
// fields; the overview needs identity/contract evidence and result accounting.
const FORECAST_COLUMNS = 'id,sport,cohort,model_version,event_id,market,status,emitted_at,scheduled_at';
const SOURCES = {
  SOCCER: { forecasts: 'edge_lab_forecasts_v1', outcomes: 'edge_lab_outcomes_v1', maxRows: 10000, outcomeColumns: 'id,forecast_id,status', cohort: 'EDGE_LAB_RESTART_20261104' },
  MULTI: { forecasts: 'edge_lab_multi_forecasts_v1', outcomes: 'edge_lab_multi_outcomes_v1', maxRows: 20000, outcomeColumns: 'id,forecast_id,status,absolute_error' },
};

async function readPages(db, table, columns, maxRows, signal) {
  const rows = [];
  for (let offset = 0; offset < maxRows; offset += 500) {
    const result = await db.from(table).select(columns).order('id')
      .range(offset, offset + 499).abortSignal(signal);
    if (result.error || !Array.isArray(result.data)) throw Error('OVERVIEW_LEDGER_UNAVAILABLE');
    rows.push(...result.data);
    if (result.data.length < 500) return rows;
  }
  throw Error('OVERVIEW_LEDGER_READ_LIMIT');
}

export async function readEdgeLabOverviewLedger(db, source) {
  const config = SOURCES[source];
  if (!config) throw Error('OVERVIEW_SOURCE_INVALID');
  // One budget covers both ledgers and every page; failed/aborted reads are
  // handled as unavailable by the card adapter, never as zero outcomes.
  const signal = AbortSignal.timeout(15000);
  const [forecasts, outcomes] = await Promise.all([
    readPages(db, config.forecasts, FORECAST_COLUMNS, config.maxRows, signal),
    readPages(db, config.outcomes, config.outcomeColumns, config.maxRows, signal),
  ]);
  const byId = new Map(outcomes.map(row => [row.forecast_id, row]));
  const eligible = config.cohort ? forecasts.filter(row => row.cohort === config.cohort) : forecasts;
  return { rows: eligible.map(row => ({ ...row, outcome: byId.get(row.id) ?? null })) };
}
