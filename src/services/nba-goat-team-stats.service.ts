import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {normalizeTeamSeasonAverages,teamStatsFresh} from '@/lib/nba/goat-team-stats-core.mjs';
const SPORT='basketball_nba',PROVIDER='balldontlie',JOB='nba_goat_team_stats_v1',FRESH_MS=6*3600000;
function seasonYear(now=new Date()){return now.getUTCMonth()>=9?now.getUTCFullYear():now.getUTCFullYear()-1;}
async function currentRows(year:number){const r=await db.from('team_stats').select('team_name,updated_at,raw_data').eq('sport_key',SPORT).eq('season',String(year));if(r.error)throw Error('NBA_GOAT_TEAM_STATS_READ_FAILED');return r.data??[];}
async function fetchAverages(year:number){
 const key=process.env.BALLDONTLIE_API_KEY?.trim();if(!key)throw Error('BALLDONTLIE_API_KEY_UNAVAILABLE');
 const u=new URL('https://api.balldontlie.io/nba/v1/team_season_averages/general');u.searchParams.set('season',String(year));u.searchParams.set('season_type','regular');u.searchParams.set('type','base');u.searchParams.set('per_page','100');
 const r=await fetch(u,{headers:{Authorization:key,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json'))throw Error('NBA_GOAT_TEAM_STATS_PROVIDER_FAILED');
 return r.json();
}
export async function getNbaGoatTeamStatsStatus(){const year=seasonYear(),rows=await currentRows(year);return {provider:PROVIDER,season:year,rows:rows.length,fresh:teamStatsFresh(rows¶»§q«^uÕÉ¸íÍÑ…ÑÕÌèUAQœ±ÁÉ½Ù¥‘•ÈéAI=Y%H±Í•…Í½¸éå•…È±É½İÌé¹½Éµ…±¥é•¹±•¹Ñ ±ÁÉ½Ù¥‘•É}…±±ÌèÄ±‘…Ñ…‰…Í•}İÉ¥Ñ•Ìé¹½Éµ…±¥é•¹±•¹Ñ¡ôì(õ…Ñ ¡”¥í…İ…¥Ğ‘ˆ¹™É½´ ÍÁ½ÉÑÍ}Íå¹}©½‰Ìœ¤¹ÕÁ‘…Ñ”¡íÍÑ…ÑÕÌè™…¥±•œ±½µÁ±•Ñ•‘}…Ğé¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤±•ÉÉ½É}½Õ¹ĞèÄ±±…ÍÑ}•ÉÉ½Èé”¥¹ÍÑ…¹•½˜ÉÉ½Èı”¹µ•ÍÍ…”è9	}=Q}Q5}MQQM}%1œ±‘ÕÉ…Ñ¥½¹}µÌé…Ñ”¹¹½Ü ¤µÍÑ…ÉÑ•‘ô¤¹•Ä ¥œ±©½ˆ¹‘…Ñ„¹¥¤íÑ¡É½Ü”íô)ô