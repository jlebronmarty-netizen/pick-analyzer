/** Load finals for the displayed V6 cohort. Other events cannot displace a match. */
export async function readNhlV6CohortFinals(db, eventIds) {
  const finals = [];
  // Keep PostgREST URLs short. Include every receipt so duplicate finals are visible.
  for (let start = 0; start < eventIds.length; start += 50) {
    const ids = eventIds.slice(start, start + 50);
    const { data, count, error } = await db.from('nhl_free_outcomes_v1')
      .select('event_id,body,observed_at', { count: 'exact' }).in('event_id', ids);
    if (error || !Array.isArray(data) || data.length !== count) {
      throw new Error('NHL_LATE_V6_READ_NOT_VERIFIED');
    }
    finals.push(...data);
  }
  return finals;
}
