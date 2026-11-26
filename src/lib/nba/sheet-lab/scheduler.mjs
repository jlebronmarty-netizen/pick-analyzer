import {latestArchivedFinal} from '../decision-learning-core.mjs';
import {frontSnapshots,prepareSnapshots,gradeSnapshot} from './tracker.mjs';
import {readSheetOriginals} from './shadow.mjs';

function data(result){
 if(result.error)throw Error('SHEET_ARCHIVE_OR_LEDGER_UNAVAILABLE');
 return result.data??[];
}
export async function captureFromBoard(db,board){
 const lab=board.lab;
 const ids=[...new Set([...lab.rows.map(r=>r.gameId),...board.cheatSheets.map(c=>c.gameId),...board.rows.props.map(c=>c.gameId)])];
 const originals=await readSheetOriginals(db,{at:lab.at,rows:ids.map(gameId=>({gameId}))});
 const snapshots=[...prepareSnapshots(lab,originals),...frontSnapshots(board,originals)];
 const live=snapshots.filter(s=>Date.parse(s.expires_at)>Date.now());
 if(live.length)data(await db.from('nba_cheat_snapshots_v1').upsert(live,{onConflict:'snapshot_id',ignoreDuplicates:true}));
 return {attempted:live.length,expired:snapshots.length-live.length};
}
async function gameEvidence(db,game,day,at){
 const [schedule,box,pbp]=await Promise.all([
  db.from('nba_market_schedules_v1').select('snapshot_id,source_received_at,payload').eq('date_local',day).lte('recorded_at',at).lte('source_received_at',at).order('source_received_at',{ascending:false}).order('snapshot_id').limit(2),
  db.from('nba_game_context_v2').select('provider_game_id,player_stats,player_stats_captured_at').eq('provider_game_id',game).lte('player_stats_captured_at',at).limit(2),
  db.from('nba_pbp_snapshots_v1').select('provider_game_id,captured_at,payload').eq('provider_game_id',game).lte('captured_at',at).limit(2)
 ]);
 const final=latestArchivedFinal(data(schedule),Number(game),day,at)?.game,boxes=data(box),events=data(pbp);
 return {final,context:boxes.length===1?boxes[0]:null,pbp:events.length===1?events[0]:null};
}
export async function settlePending(db,now=new Date(),loadEvidence=gameEvidence){
 const at=now.toISOString(),games=[];
 for(let offset=0;;offset+=500){
  const page=data(await db.from('nba_sheet_pending_games_v1').select('game_id,day_local').order('game_id').range(offset,offset+499));
  games.push(...page);if(page.length<500)break;
 }
 let attempted=0;
 // Rotate across games including permanently unverifiable contracts; no outcome determines priority.
 const slot=Math.floor(now.getTime()/1800000);
 for(let i=0;i<Math.min(4,games.length);i++){
  const {game_id,day_local}=games[(slot*4+i)%games.length];
  const evidence=await loadEvidence(db,game_id,day_local,at);
  if(!evidence.final)continue;
  const pending=[];
  for(let start=0;;start+=500){
   const page=data(await db.from('nba_sheet_pending_v1').select('snapshot_id,quote_id,recorded_at,card').eq('game_id',game_id)
    .order('snapshot_id').order('quote_id').range(start,start+499));
   pending.push(...page);if(page.length<500)break;
  }
  const grades=[],memo=new Map();
  for(const e of pending){
   // Multiple strategy memberships often reference exactly the same frozen card.
   const key=JSON.stringify([e.card,e.recorded_at]);let grade=memo.get(key);
   if(!grade){
    [grade]=gradeSnapshot({snapshot_id:e.snapshot_id,captured_at:e.recorded_at,payload:{cards:[e.card]}},new Map([[e.card.gameId,evidence]]),now.getTime());
    memo.set(key,grade);
   }
   if(grade.result!=='pending'&&grade.pick_result!=='pending')grades.push({...grade,snapshot_id:e.snapshot_id,quote_id:e.quote_id});
  }
  for(let start=0;start<grades.length;start+=200){
   const batch=grades.slice(start,start+200);data(await db.from('nba_sheet_grades_v1').upsert(batch,{onConflict:'snapshot_id,quote_id',ignoreDuplicates:true}));attempted+=batch.length;
  }
 }
 return {pendingGames:games.length,attempted};
}
export async function runSheetTick({db,readBoard}){
 const [freeze,settle]=await Promise.allSettled([
  readBoard({forDisplay:true,withSheetLab:true,withCheatSheets:true}).then(board=>captureFromBoard(db,board)),
  settlePending(db)
 ]);
 const status=freeze.status==='fulfilled'&&settle.status==='fulfilled'?'OK':'PARTIAL_FAILURE';
 const receipt={status,freeze:freeze.status==='fulfilled'?freeze.value:'FAILED',settle:settle.status==='fulfilled'?settle.value:'FAILED',providerCalls:0};
 if(status==='OK')console.info('NBA_SHEET_TICK',receipt);else console.error('NBA_SHEET_TICK',receipt);
 return receipt;
}
