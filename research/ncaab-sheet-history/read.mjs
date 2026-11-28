import archive from "./prior.json" with {type:"json"};
const meetings=new Map();
const key=(a,b)=>[a,b].sort().join("/");
for(const [season,eventId,start,home,away,h,a] of archive.games){
  const pair=key(home,away);
  if(!meetings.has(pair))meetings.set(pair,[]);
  meetings.get(pair).push({season,eventId,start,home,away,h,a});
}
export function priorSeasons(f, season, cut) {
  if(!(Date.parse(cut)>=Date.parse(archive.availableAt)))return [];
  const groups=new Map();
  for(const g of meetings.get(key(f.homeId,f.awayId))??[]) {
    if(g.season>=season || Date.parse(g.start)>=Date.parse(cut))continue;
    if(!groups.has(g.season))groups.set(g.season,[]);
    groups.get(g.season).push({id:g.eventId,date:g.start.slice(0,10),homePoints:g.home===f.homeId?g.h:g.a,awayPoints:g.home===f.homeId?g.a:g.h});
  }
  return [...groups].sort(([a],[b])=>b-a).map(([year,games])=>({year,n:games.length,games:games.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,10)}));
}
