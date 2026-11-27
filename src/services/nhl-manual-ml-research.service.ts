import 'server-only';
import {supabaseAdmin} from '@/lib/supabase-admin';
import {readNhlManualMlArchive, buildNhlManualMlResearch} from '@/lib/nhl-manual-ml-archive.mjs';

const CACHE_MS=3*60*1000;
let cached: {until:number; report:unknown}|undefined;
let inFlight: Promise<unknown>|undefined;

export async function getNhlManualMlResearch(): Promise<unknown> {
  if(cached && cached.until>Date.now()) return cached.report;
  if(inFlight) return inFlight;
  inFlight=(async()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),40000);
    const cutoff=new Date().toISOString();
    try {
      const archive=await readNhlManualMlArchive(supabaseAdmin,{cutoff,signal:controller.signal});
      const report=buildNhlManualMlResearch(archive,{cutoff});
      cached={until:Date.now()+CACHE_MS,report};
      return report;
    } finally {clearTimeout(timer);}
  })();
  try {return await inFlight;} finally {inFlight=undefined;}
}
