const finiteInt=v=>Number.isInteger(v)&&v>=0;
export function finalGamesFromSchedules(scheduleRows){
 if(!Array.isArray(scheduleRows))throw Error('NBA_GOAT_SCHEDULE_ROWS_INVALID');
 const map=new Map();
 for(const row of scheduleRows){
  const received=Date.parse(row?.source_received_at??'');if(!Number.isFinite(received))continue;
  const games=row?.payload?.data?.games;if(!Array.isArray(games))continue;
  for(const g of games){
   if(!Number.isSafeInteger(g?.id)||!Number.isFinite(Date.parse(g?.datetime??''))||!g?.home_team?.full_name||!g?.visitor_team?.full_name)continue;
   if(String(g.status_state??'').toLowerCase()!=='final'&&!/final/i.test(String(g.status??'')))continue;
   if(!finiteInt(g.home_team_score)||!finiteInt(g.visitor_team_score))continue;
   const old=map.get(g.id);if(!old||received>old.received)map.set(g.id,{game:g,received});
  }
 }
 return [...map.values()].map(x=>x.game).sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime)||a.id-b.id);
}
export function normalizedGameResult(game,event){
 const expected='bdl_nba_'+String(game?.id??'');
 if(!event||event.id!==expected||event.home_team!==game?.home_team?.full_name||event.away_team!==game?.visitor_team?.full_name)throw Error('NBA_GOAT_RESULT_IDENTITY_MISMATCH');
 if(String(game.status_state??'').toLowerCase()!=='final'&&!/final/i.test(String(game.status??'')))throw Error('NBA_GOAT_RESULT_NOT_FINAL');
 if(!finiteInt(game.home_team_score)||!finiteInt(game.visitor_team_score))throw Error('NBA_GOAT_RESULT_SCO¶»§q«^tôôõ¡½µ”ı…Ìé¡Ìì(¥˜¡µ…É­•Ğôôôµ½¹•å±¥¹”œ¥É•ÑÕÉ¸í½ÕÑ½µ”éÍ•±•Ñ•ù½ÁÁ½¹•¹Ğüİ¥¸œè±½ÍÌœ±…ÑÕ…°éÍ•±•Ñ•µ½ÁÁ½¹•¹Ñôì(¥˜ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡9Õµ‰•È¡±¥¹”¤¤¥Ñ¡É½ÜÉÉ½È 9	}=Q}MQQ159Q}=9QIQ}%9Y1%œ¤ì(½¹ÍĞ½Ù•É•õÍ•±•Ñ•­9Õµ‰•È¡±¥¹”¤µ½ÁÁ½¹•¹ĞíÉ•ÑÕÉ¸í½ÕÑ½µ”é½Ù•É•ôôôÀüÁÕÍ œé½Ù•É•øÀüİ¥¸œè±½ÍÌœ±…ÑÕ…°é½Ù•É•‘ôì)ô(