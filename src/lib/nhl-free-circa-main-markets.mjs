// Pure parser of already-archived DRatings detail HTML.
// Optional research only: never alters Moneyline feed or official betting recommendations.
export const NHL_FREE_MARKETS_VERSION='NHL_CIRCA_FREE_SPREAD_TOTAL_V1';
const clean=s=>String(s??'').replace(/&frac12;|&#189;|&#xBD;/gi,'½')
 .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
 .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const canonical=s=>clean(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases={'new york rangers':'ny rangers','new york islanders':'ny islanders'};
function teamMatch(team,label){
 const full=canonical(team),short=canonical(label);
 if(!short)return false;
 return [full,aliases[full]].filter(Boolean).some(x=>short===x||x.startsWith(short+' '));
}
const odds=n=>Number.isSafeInteger(n)&&Math.abs(n)>=100&&Math.abs(n)<=20000;
const reasonable=(a,b)=>{
 const pp=o=>o>0?100/(100+o):-o/(100-o);
 const sum=pp(a)+pp(b);
 return sum>=.90&&sum<=1.35;
};
function cells(r){
 return [...r.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>clean(x[1]));
}
function circaPair(html,section,forecast,expectedSides){
 if(typeof html!=='string'||html.length>2000000||!forecast?.awayName||!forecast?.homeName)return null;
 const marker=new RegExp('id=["\\x27]'+section+'["\\x27]','i').exec(html);
 if(!marker)return null;
 // Only inspect the FIRST two bookmaker tables in this exact section (known public layout).
 const fragment=html.slice(marker.index,Math.min(html.length,marker.index+160000));
 for(const table of [...fragment.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].slice(0,2)){
  const rows=[...table[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>cells(r[1]));
  if(rows.length!==3)continue;
  const index=rows[0]?.findIndex(x=>x==='Circa')??-1;
  if(index<0||rows.some(r=>r.length<=index))continue;
  const labels=[rows[1][0],rows[2][0]];
  if(expectedSides==='teams'&&(!teamMatch(forecast.awayName,labels[0])||
    !teamMatch(forecast.homeName,labels[1])||
    teamMatch(forecast.homeName,labels[0])||teamMatch(forecast.awayName,labels[1])))continue;
  if(expectedSides==='totals'&&(canonical(labels[0])!=='over'||canonical(labels[1])!=='under'))continue;
  return {a:rows[1][index],b:rows[2][index],labels};
 }
 return null;
}
const parseH=x=>{
 const m=/^([+-])(\d+)(½|\.5)?([+-])(\d{3,5})$/.exec(String(x??'').replace(/\s+/g,''));
 if(!m)return null;
 const line=(m[1]==='-'?-1:1)*(Number(m[2])+(m[3]?0.5:0));
 const price=(m[4]==='-'?-1:1)*Number(m[5]);
 return Number.isFinite(line)&&line!==0&&Math.abs(line)<=5&&odds(price)?{line,price}:null;
};
const parseTotal=x=>{
 const m=/^([ou])(\d+)(½|\.5)?([+-])(\d{3,5})$/i.exec(String(x??'').replace(/\s+/g,''));
 if(!m)return null;
 const line=Number(m[2])+(m[3]?0.5:0),price=(m[4]==='-'?-1:1)*Number(m[5]);
 return line>=1&&line<=14&&odds(price)?{side:m[1].toLowerCase()==='o'?'Over':'Under',line,price}:null;
};
export function parseNhlCircaFreeMainMarkets(html,forecast){
 const spread=circaPair(html,'scroll-spread',forecast,'teams');
 const total=circaPair(html,'scroll-ou',forecast,'totals');
 const observations=[],rejected=[];
 if(!spread)rejected.push('NO_VERIFIED_CIRCA_PUCK_LINE_TABLE');
 else{
  const away=parseH(spread.a),home=parseH(spread.b);
  if(!away||!home||away.line!==-home.line||!reasonable(away.price,home.price))
   rejected.push('UNPAIRED_CIRCA_PUCK_LINE');
  else observations.push({market:'spread',book:'CIRCA',away:{name:forecast.awayName,...away},
   home:{name:forecast.homeName,...home},sourceUpdatedAt:null,
   fullGameContractCertified:false,readyForOfficialPicks:false});
 }
 if(!total)rejected.push('NO_VERIFIED_CIRCA_TOTAL_TABLE');
 else{
  const over=parseTotal(total.a),under=parseTotal(total.b);
  if(!over||!under||over.side!=='Over'||under.side!=='Under'||
    over.line!==under.line||!reasonable(over.price,under.price))
   rejected.push('UNPAIRED_CIRCA_TOTAL_LINE');
  else observations.push({market:'total',book:'CIRCA',over,under,
   sourceUpdatedAt:null,fullGameContractCertified:false,readyForOfficialPicks:false});
 }
 return {status:observations.length?'PARTIAL_OR_FULL_RESEARCH_ONLY':'NO_VERIFIED_FREE_MAIN_MARKETS',
  version:NHL_FREE_MARKETS_VERSION,observations,rejected,
  requiresPregameFreeze:true,bookmakerMarketRulesCertified:false,
  providerCalls:0,subscriptionCost:0,officialPicksChanged:false};
}
