import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';

export async function getMlbCausalLearningReadiness(){
 const [d,c,m]=await Promise.all([
  db.from('mlb_causal_diagnostics_v1').select('prediction_key',{count:'exact',head:true}),
  db.from('mlb_game_context_v2').select('game_id',{count:'exact',head:true}),
  db.from('mlb_batter_pitcher_v3').select('game_id',{count:'exact',head:true}),
 ]);
 if(d.error||c.error||m.error)throw Error('MLB_CAUSAL_READINESS_FAILED');
 return {
  status:'OFFSEASON_PAUSED',
  activation:'2027_REGULAR_SEASON_ONLY',
  collectorActive:false,
  providerCalls:0,
  schemas:{diagnostics:d.count??0,gameContext:c.count??0,batterPitcher:m.count??0},
  planned:{
   v1:'inning-by-inning flow, starter/bullpen changes, lead changes, run environment',
   v2:'actual lineup, starter, bullpen usage, pitch counts, batter/pitcher game stats',
   v3:'confirmed batter-vs-pitcher and batter-vs-pitch-type observations',
  },
  policy:{autoModelChanges:false,validatedCandidateRequiresHoldout:true},
 };
}
