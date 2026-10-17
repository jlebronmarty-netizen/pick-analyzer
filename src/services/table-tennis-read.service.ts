import 'server-only';
import { cache } from 'react';
import { parseTtReport, unavailableTt, type TtReport } from '@/lib/table-tennis-report';
export const TT_READ_BRIDGE_URL = 'https://sports-edge-hub.vercel.app/api/table-tennis/read-bridge';
export const getTableTennisReport = cache(async (): Promise<TtReport> => {
  try {
    const r = await fetch(TT_READ_BRIDGE_URL, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(25000), headers: { Accept: 'application/json' } });
    if (!r.ok) return unavailableTt();
    return parseTtReport(await r.json());
  } catch { return unavailableTt(); }
});
