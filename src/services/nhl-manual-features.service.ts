import 'server-only';
import {supabaseAdmin} from '@/lib/supabase-admin';
import {buildNhlManualFeaturesReport,nhlManualFeatureDate,readNhlManualFeaturePages,unavailableNhlManualFeaturesReport} from '@/lib/nhl-manual-features.mjs';

export async function getNhlManualFeatures(date?:string) {
  const cutoff=new Date().toISOString();
  const requestedDate=date??nhlManualFeatureDate(cutoff);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try {
    return buildNhlManualFeaturesReport(await readNhlManualFeaturePages(supabaseAdmin,{date:requestedDate,cutoff,signal:controller.signal}));
  } catch(error) {
    const code=error instanceof Error?error.message:'READ_UNAVAILABLE';
    if(code==='INVALID_DATE')throw error;
    return unavailableNhlManualFeaturesReport(code,{date:requestedDate,cutoff});
  } finally {clearTimeout(timer);}
}
