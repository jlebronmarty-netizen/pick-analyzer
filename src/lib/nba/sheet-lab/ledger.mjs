// The caller supplies the isolated archive client. Neither function runs on a page load.
import {readSheetOriginals} from './shadow.mjs';
import {prepareSnapshots,gradeSnapshot} from './tracker.mjs';

export async function freezeLabRankings(db,lab){
 const originals=await readSheetOriginals(db,lab);
 const snapshots=prepareSnapshots(lab,originals);
 if(!snapshots.length)return [];
 const saved=await db.from('nba_cheat_snapshots_v1').upsert(snapshots,{onConflict:'snapshot_id',ignoreDuplicates:true});
 if(saved.error)throw Error('SHEET_FREEZE_FAILED');
 return snapshots.map(s=>s.snapshot_id);
}
export async function settleLabRankings(db,snapshot,evidence){
 const grades=gradeSnapshot(snapshot,evidence).filter(g=>g.result!=='pending'&&g.pick_result!=='pending');
 if(!grades.length)return [];
 const saved=await db.from('nba_sheet_grades_v1').upsert(grades,{onConflict:'snapshot_id,quote_id',ignoreDuplicates:true});
 if(saved.error)throw Error('SHEET_GRADING_FAILED');
 return grades;
}
