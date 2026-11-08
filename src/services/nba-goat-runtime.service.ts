import 'server-only';
import {createHash} from 'node:crypto';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NBA_GOAT_PROVIDER,NBA_GOAT_POLICY,nbaGoatQuoteChecks,nbaGoatGate,isExactGoatModelMatch,nbaGoatDerivedContext} from '@/lib/nba/goat-provider-policy.mjs';
import {teamStatsFresh} from '@/lib/nba/goat-team-stats-core.mjs';
const SPORT='basketball_nba',ORIGIN='CURRENT_ERA_SHADOW';
function rows(r:any){if(r.error)throw Error('NBA_GOAT_READ_FAILED');return r.data??[];}
function yearAndSeason(now=new Date()){const year=now.getUTCMonth()>=9?now.getUTCFullYear():now.getUTCFullYear()-1;return {year,season:String(year)+'-'+String(year+1).slice(-2)};}
function scheduleMap(row:any){const games=row?.payload?.data?.games;if(!Array.isArray(games))return new Map<number,any>();return new Map<number,any>(games.filter((g:any)=>Number.isSafeInteger(g?.id)).map((g:any)=>[g.id,g] as [number,any]));}
function providerGameId(id:string){const m=/^bdl_nba_(\d+)$/.exec(id);return m?Number(m[1]):null;}
async function load(){
 const now=new Date(),checkedAt=now.toISOString(),info=yearAndSeason(now),year=info.year,season=info.season;
 const [ev,od,st,ph,jobs,archive,schedule]=await Promise.all([
  db.from('sport_events').select('id,sport_key,league_key,season,home_team,away_team,start_time,status,metadata').eq('sport_key',SPORT).eq('season',season).gte('start_time',checkedAt).order('start_time').limit(25),
  db.from('sports_odds_snapshots').select('id,event_id,provider,sportsbook,¶»§q«^u5…À¡±…ÍÑM¡•‘Õ±”¤±•Ù•¹Ñ5…Àõ¹•Ü5…ÀñÍÑÉ¥¹œ±…¹äø¡•Ù•¹ÑÌ¹µ…À ¡”é…¹ä¤ôùm”¹¥±•t…ÌmÍÑÉ¥¹œ±…¹åt¤¤±Í••¸õ¹•ÜM•ÐñÍÑÉ¥¹œø ¤±…¹‘¥‘…Ñ•Ìé…¹åmtõmtì(™½È¡½¹ÍÐÄ½˜ÅÕ½Ñ•Ì¥í½¹ÍÐ”õ•Ù•¹Ñ5…À¹•Ð¡Ä¹•Ù•¹Ñ}¥¤í¥˜ …”¥½¹Ñ¥¹Õ”í½¹ÍÐ­•äõmÄ¹•Ù•¹Ñ}¥±Ä¹µ…É­•Ð±Ä¹½ÕÑ½µ”±Ä¹±¥¹”±Ä¹ÍÁ½ÉÑÍ‰½½­t¹©½¥¸ ðœ¤í¥˜¡Í••¸¹¡…Ì¡­•ä¤¥½¹Ñ¥¹Õ”íÍ••¸¹…‘¡­•ä¤í½¹ÍÐ¥õÁÉ½Ù¥‘•É…µ•%¡”¹¥¤±œõ¥ôôõ¹Õ±°ý¹Õ±°éÉ…Ý…µ•Ì¹•Ð¡¥¤±½¹Ñ•áÐõ¹‰…½…Ñ•É¥Ù•‘½¹Ñ•áÐ¡”±Ä±œ±±…ÍÑM¡•‘Õ±”ü¹Í½ÕÉ•}É••¥Ù•‘}…Ð±¡•­•‘Ð¤í…¹‘¥‘…Ñ•Ì¹ÁÕÍ ¡í•Ù•¹Ðé”±ÅÕ½Ñ”éÄ±½¹Ñ•áÐ±¡•¬é¹‰…½…ÑEÕ½Ñ•¡•­Ì¡”±Ä±¡•­•‘Ð±½¹Ñ•áÐ¥ô¤íô(½¹ÍÐÁ•¹‘¥¹I½ÝÌõ¡¥ÍÑ½Éä¹™¥±Ñ•È ¡Àé…¹ä¤ôø…À¹É•ÍÕ±ÑññÀ¹É•ÍÕ±ÐôôôÁ•¹‘¥¹œœ¤±½…ÑA•¹‘¥¹I½ÝÌõÁ•¹‘¥¹I½ÝÌ¹™¥±Ñ•È ¡Àé…¹ä¤ôùÀ¹™•…ÑÕÉ•}Í¹…ÁÍ¡½Ðü¹½…ÑAÉ½Ù¥‘•ÉA½±¥äôôõ9	}=Q}A=1%d¤±±•…åA•¹‘¥¹I½ÝÌõÁ•¹‘¥¹I½ÝÌ¹™¥±Ñ•È ¡Àé…¹ä¤ôùÀ¹™•…ÑÕÉ•}Í¹…ÁÍ¡½Ðü¹½…ÑAÉ½Ù¥‘•ÉA½±¥ä„ôõ9	}=Q}A=1%d¤ì(½¹ÍÐÑ½‘…äõ¡•­•‘Ð¹Í±¥” À°ÄÀ¤±½…Ñ!¥ÍÑ½Éäõ¡¥ÍÑ½Éä¹™¥±Ñ•È ¡Àé…¹ä¤ôùÀ¹™•…ÑÕÉ•}Í¹…ÁÍ¡½Ðü¹½…ÑAÉ½Ù¥‘•ÉA½±¥äôôõ9	}=Q}A=1%d¤±É½ÝÍQ½‘…äõ½…Ñ!¥ÍÑ½Éä¹™¥±Ñ•È ¡Àé…¹ä¤ôùMÑÉ¥¹œ¡À¹É•…Ñ•‘}…Ð¤¹Í±¥” À°ÄÀ¤ôôõÑ½‘…ä¤¹±•¹Ñ ì(½¹ÍÐ½µÁ±•Ñ•õÉÕ¹Ì¹™¥±Ñ•È ¡Èé…¹ä¤ôùÈ¹ÍÑ…ÑÕÌôôô½µÁ±•Ñ•œ¤±É•Á…¥É•õ½µÁ±•Ñ•¹™¥±Ñ•È ¡Èé…¹ä¤ôùÈ¹µ•Ñ…‘…Ñ„ü¹ÉÕ¹AÕÉÁ½Í”ôôôIA%I}IU9Q%5}YI%%Q%=9}IU8œ¤¹±•¹Ñ ±…¹…ÉåI½ÝÌõ½µÁ±•Ñ•¹É•‘Õ” ¡¸é¹Õµ‰•È±Èé…¹ä¤ôù¸­9Õµ‰•È¡È¹É•½É‘Í}¥¹Í•ÉÑ•üýÈ¹µ•Ñ…‘…Ñ„ü¹¥¹Í•ÉÑ•‘½Õ¹ÐüüÀ¤°À¤ì(½¹ÍÐÕÉÉ•¹ÑMÑ…ÑÌõÑ•…µMÑ…ÑÍÉ•Í ¡ÍÑ…ÑÌ±¹½Ü¤±ÍÑ…Ñ9…µ•Ìõ¹•ÜM•Ð¡ÍÑ…ÑÌ¹µ…À ¡Ìé…¹ä¤ôùÌ¹Ñ•…µ}¹…µ”¤¤±µ¥ÍÍ¥¹Q•…µÌõl¸¸¹¹•ÜM•Ð¡•Ù•¹ÑÌ¹™±…Ñ5…À ¡”é…¹ä¤ôùm”¹¡½µ•}Ñ•…´±”¹…ÞÚîÆ­yÔôDE5ô4ôääT5DTEôÔôDTÅô$Äô4´TBrÆ—77VW3¦6æF–FFW2ç&VGV6R‚†¥&V6÷&CÇ7G&–ærÆçVÖ&W#âÆ3¦ç’“Óç¶f÷"†6öç7B²öb²ââæ2æ6†V6²æ—77VW2Âââæ2æ6†V6²çw&—FT—77VW5Ò–¶µÓÒ†¶µÓóó’³·&WGW&â·ÒÇ·Ò’Ææ÷FS¢ttôB&–6W2&Ræ÷B&VF–7F–öç2âÆVv7’6†F÷r&÷w2&VÖ–â6W&FRæBFòæ÷B&Æö6²F†RtôB6ö†÷'BâæWr6öçG&7G2&R7FF—7F–6Â6†F÷rWf–FVæ6RÂæ÷B6Æ–ÒöbW6W"7÷'G6&öö²6WGFÆVÖVçBâwÓ°¢&WGW&â·7FGW2Æ6æF–FFW2Æ†—7F÷'“¦vöD†—7F÷'—Ó°§Ð¦W‡÷'B7–æ2gVæ7F–öâvWDæ&vöE'VçF–ÖU7FGW2‚—·&WGW&â†v—BÆöB‚’’ç7FGW3·Ð¦W‡÷'B7–æ2gVæ7F–öâ'Väæ&vöE6†F÷u66†VGVÆW"‚—°¢6öç7BÆöFVCÖv—BÆöB‚’Ç7FGW3ÖÆöFVBç7FGW2Æ6æF–FFW3ÖÆöFVBæ6æF–FFW2Æ†—7F÷'“ÖÆöFVBæ†—7F÷'“¶–b‚7FGW2ævFRæÆÆ÷vVB—&WGW&â²ââç7FGW2Ç&VEööæÇ“¦fÇ6RÇ&VF–7F–öç5ö–ç6W'FVC£Ç&÷f–FW%ö6ÆÇ3£Æf–æÄ6Æ76–f–6F–öã§7FGW2æ6Æ76–f–6F–öçÓ°¢6öç7B6Æ÷CÔÖF‚æfÆö÷"„FFRææ÷r‚’óƒ’ÆƒÖ7&VFT†6‚‚w6†#Sbr’çWFFR„ä$ôtôEõôÄ”5’²s¢rµ7G&–ær‡6Æ÷B’’æF–vW7B‚v†W‚r’Ç'Vä–CÖ‚ç6Æ–6RƒÃ‚’²rÒr¶‚ç6Æ–6Rƒ‚Ã"’²rÓBr¶‚ç6Æ–6Rƒ2Ãb’²rÖr¶‚ç6Æ–6RƒrÃ#’²rÒr¶‚ç6Æ–6Rƒ#Ã3"“°¢6öç7B6Æ–ÓÖv—BF"æg&öÒ‚w7÷'G5÷7–æ5ö¦ö'2r’æ–ç6W'B‡¶–C§'Vä–BÆ¦ö%÷G—S¢væ&övöE÷6†F÷u÷crÇ7÷'Eö¶W“¥5õ%BÆÆVwVUö¶W“¢væ&rÇ&÷f–FW#¤ä$ôtôEõ$õd”DU"Ç7FGW3¢w'Vææ–ærrÆÖWFFF§·öÆ–7“¤ä$ôtôEõôÄ”5’Ç6Æ÷G×Ò“¶–b†6Æ–ÒæW'&÷"—¶–b†6Æ–ÒæW'&÷"æ6öFSÓÓÒs#3SRr—&WGW&â²ââç7FGW2Æf–æÄ6Æ76–f–6F–öã¢tÅ$TE•ô4Ä”ÔTBrÇ&VF–7F–öç5ö–ç6W'FVC£Ó·F‡&÷rW'&÷"‚tä$ôtôEô4Ä”Õôd”ÄTBr“·Ð¢ÆWB–ç6W'FVCÓ¶6öç7B&V6öç3¥&V6÷&CÇ7G&–ærÆçVÖ&W#ã×·Ó°¢G'—°¢6öç7B¶vVæW&FTæ&&VF–7F–öç7ÓÖv—B›kºwµçXË˜ÛÛ^œÙX\ÛÛ”\ÙQ]šY[˜ÙKÛÝ\˜ÙT][ÝRYœKšYÛÝ\˜ÙT›ÝšY\Ž“WÑÓÐUÔ“Õ’QTŸNÜ›ÝËœ™XÛÛ[Y[™YÜXÚÏY˜[ÙNÜ›ÝËœ›ÙXÝ[Û—Ù[YÚX›OY˜[ÙNØÛÛœÝØ]™YX]ØZ]Ø]™T™YXÝ[Û’\ÝÜžJÜ›Ý×JNÚ[œÙ\Y
Ï\Ø]™YœØ]™YÏÌÚYŠØ]™YœØ]™Y
^Ù]™[ÛÝ[ËœÙ]
KšY
]™[ÛÝ[Ë™Ù]
KšY
OÏÌ
JÌJNÛX\šÙ]ÛÝ[ËœÙ]
Ù^K
X\šÙ]ÛÝ[Ë™Ù]
Ù^JOÏÌ
JÌJNß_BˆÛÛœÝÝ[[X\žO^ÜÛXÞN“WÑÓÐUÔÓPÖK›ÝšY\Ž“WÑÓÐUÔ“Õ’QT‹›ÝšY\Ø[ÎŒ[œÙ\YÛÝ[š[œÙ\Y™X\ÛÛœË[”\œÜÙNœÝ]\Ë™Ø]K˜ÛÛ[[Ý\ÏÉÐÓÓ•S•SÕT×ÔÒQÕ×ÑU’QSÑWÔ•S‰ÎœÝ]\Ë™Ø]Kœ™\Z\ÉÔ‘TRT‘QÔ•S•SQWÕ‘T’Q’PÐUSÓ—Ô•S‰Î‰ÑÓÐUÐÐST–IËÙ™šXÚX[XÚÑ[NŒ[Ù[›Ü›][PÚ[™ÙY™˜[ÙKYØXÞT[™[™Ñ^ÛYYY_NØÛÛœÝØ]™YX]ØZ]‹™œ›ÛJ	ÜÜÜ×ÜÞ[˜×Ú›ØœÉÊK\]JÜÝ]\Î‰ØÛÛ\]Y	ËÛÛ\]YØ]›™]È]J
KÒTÓÔÝš[™Ê
K™XÛÜ™×Ú[œÙ\Yš[œÙ\YY]Y]NœÝ[[X\ž_JK™\J	ÚY	Ë[’Y
NÚYŠØ]™Y™\œ›ÜŠ]›ÝÈ\œ›ÜŠ	ÓWÑÓÐUÐUQUÑRSQ	ÊNÜ™]\›ˆÜÝXØÙ\ÜÎYKš[˜[Û\ÜÚYšXØ][ÛŽš[œÙ\YÉÓWÑÓÐUÔÒQÕ×ÔÕPÐÑTÔÉÎ‰Ó“×ÑVPÕÓSÑSÓPUÒ	Ë‹‹œÝ[[X\ž_NÂˆXØ]ÚØ]ØZ]‹™œ›ÛJ	ÜÜÜ×ÜÞ[˜×Ú›ØœÉÊK\]JÜÝ]\Î‰Ù˜Z[Y	ËÛÛ\]YØ]›™]È]J
KÒTÓÔÝš[™Ê
K\ÝÙ\œ›ÜŽ‰ÓWÑÓÐUÔÒQÕ×ÑVPÕUSÓ—ÑRSQ	Ë™XÛÜ™×Ú[œÙ\Yš[œÙ\YJK™\J	ÚY	Ë[’Y
NÝ›ÝÈ\œ›ÜŠ	ÓWÑÓÐUÔÒQÕ×ÑVPÕUSÓ—ÑRSQ	ÊNßBŸB