import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {buildNcaabArchivedEvidence, ncaabArchiveDates, ncaabArchiveUrl,
  type ArchiveForecast, type NcaabArchivedEvidence, type NcaabArchiveReceipt} from '@/lib/ncaab-archived-evidence';

// Three dates, two latest receipts per date (to detect timestamp ties), SELECT only.
// The existing cron's archived URLs are database filters; they are never fetched.
export async function readNcaabArchivedEvidence(forecasts: ArchiveForecast[], asOf: string,
  client: SupabaseClient): Promise<NcaabArchivedEvidence> {
  const dates = ncaabArchiveDates(asOf), receipts: NcaabArchiveReceipt[] = [], sourceErrors: string[] = [];
  const reads = await Promise.allSettled(dates.map(date => client.from('ncaab_daily_source_v1')
    .select('id,captured_at,source_url,body').eq('source_url', ncaabArchiveUrl(date)).lte('captured_at', asOf)
    .order('captured_at', {ascending: false}).order('id').limit(2).abortSignal(AbortSignal.timeout(5000))));
  for (const [index, result] of reads.entries()) {
    if (result.status === 'rejected' || result.value.error || !Array.isArray(result.value.data)) {
      sourceErrors.push('ARCHIVE_READ_FAILED:' + dates[index]); continue;
    }
    for (const raw of result.value.data) {
      if (typeof raw.id !== 'string' || !raw.id || typeof raw.captured_at !== 'string' ||
          typeof raw.source_url !== 'string' || Buffer.byteLength(JSON.stringify(raw.body) ?? '') > 15000000) {
        // Do not fall back to an older receipt after a malformed newest receipt.
        sourceErrors.push('ARCHIVE_RECEIPT_INVALID:' + dates[index]);
        receipts.push({id: String(raw.id ?? 'INVALID'), captured_at: String(raw.captured_at ?? asOf),
          source_url: ncaabArchiveUrl(dates[index]), body: null});
        continue;
      }
      receipts.push(raw as NcaabArchiveReceipt);
    }
  }
  return buildNcaabArchivedEvidence({forecasts, receipts, asOf, dates, sourceErrors});
}
