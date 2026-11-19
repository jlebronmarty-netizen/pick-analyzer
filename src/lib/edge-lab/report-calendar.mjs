// Reuse one ICU formatter and group each row once. Report generation must not
// allocate a formatter for every row on every day of the historical ledger.
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function reportDatePR(value) {
  return formatter.format(new Date(value));
}

export function groupReportRowsByDate(rows) {
  const days = new Map();
  for (const row of rows) {
    const date = reportDatePR(row.emitted_at);
    const group = days.get(date);
    if (group) group.push(row);
    else days.set(date, [row]);
  }
  return days;
}
