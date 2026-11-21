// Events are supplied by an independent schedule. Each adapter must explain every
// earlier event until the requested number of eligible appearances is reached.
export function auditWindow(events, inspect, cutoff, required = 10) {
  const included = [], excluded = [], issues = [];
  const seen = new Set();
  const counts = new Map();
  for (const event of events) counts.set(event.id,(counts.get(event.id)??0)+1);
  let evaluated = 0, unresolved = 0;
  for (const event of events) {
    if (included.length + unresolved >= required) break;
    const id = event.id;
    evaluated++;
    if (seen.has(id)) continue;
    seen.add(id);
    if (counts.get(id)>1) {
      issues.push({id, status:'DUPLICATE_DATA',reason:'DUPLICATE_EVENT'});unresolved++;
      continue;
    }
    const result = inspect(event);
    if (result.issue) issues.push({id, ...result.issue});
    if (result.exclude) excluded.push({id, reason: result.exclude});
    if (result.include) included.push({id, date: event.datetime, ...result.include});
    // Missing observations consume a seat. Older games cannot replace them.
    if (result.issue && !result.include) unresolved++;
  }
  const status = issues[0]?.status ?? (included.length < required ? 'INSUFFICIENT_SAMPLE' : 'VALIDATED');
  return {status, cutoff, required, evaluated, included, excluded, issues, lastGame: included[0] ?? null};
}

export function hasValidatedInputs(row) {
  return row?.dataQuality?.status === 'VALIDATED' && row.dataQuality.issues?.length === 0;
}
