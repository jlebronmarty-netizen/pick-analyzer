import 'server-only';
import {createHash} from 'node:crypto';
import {supabaseAdmin} from '@/lib/supabase-admin';
import {captureRankings} from '@/lib/nba/cheat-ranking.mjs';

export async function captureNbaCheatSheets(day:string,cards:unknown[]){
  const payload=captureRankings(cards,Date.now());
  if(!payload.cards.length)return 'EMPTY';
  const id=createHash('sha256').update(JSON.stringify([day,payload])).digest('hex');
  const expires=Math.min(...payload.cards.map((c:{expiresAt:string})=>Date.parse(c.expiresAt)));
  const {error}=await supabaseAdmin.from('nba_cheat_snapshots_v1').upsert({
    snapshot_id:id,day_local:day,expires_at:new Date(expires).toISOString(),payload
  },{onConflict:'snapshot_id',ignoreDuplicates:true});
  if(error)throw Error('CHEAT_CAPTURE_FAILED');
  return 'SAVED';
}
