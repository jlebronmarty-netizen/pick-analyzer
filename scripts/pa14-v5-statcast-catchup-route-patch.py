from pathlib import Path

p = Path('src/services/mlb-statcast-daily-refresh.service.ts')
s = p.read_text()

old = "export async function refreshMlbStatcastDaily(input: { date?: string | null } = {}) {"
new = "export async function refreshMlbStatcastDaily(input: { date?: string | null; refreshAnalytics?: boolean } = {}) {"
assert s.count(old) == 1, f'signature count={s.count(old)}'
s = s.replace(old, new)

old = "  await refreshAnalytics()\n  const finalCoverage = await coverage()"
new = "  const shouldRefreshAnalytics = input.refreshAnalytics !== false\n  if (shouldRefreshAnalytics) await refreshAnalytics()\n  const finalCoverage = await coverage()"
assert s.count(old) == 1, f'analytics call count={s.count(old)}'
s = s.replace(old, new)

old = "    analyticsRefreshed: true,"
new = "    analyticsRefreshed: shouldRefreshAnalytics,"
assert s.count(old) == 1, f'analytics flag count={s.count(old)}'
s = s.replace(old, new)

p.write_text(s)
