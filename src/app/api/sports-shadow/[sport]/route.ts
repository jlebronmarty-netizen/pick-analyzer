import {NextResponse} from 'next/server';
import {getFreeLeagueReport} from '@/services/free-sports.service';
import {SPORT_LEAGUES,type Sport} from '@/lib/free-sports/model';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{sport:string}>}){
 const {sport}=await params;
 if(!Object.hasOwn(SPORT_LEAGUES,sport))return NextResponse.json({status:'NOT_FOUND'},{status:404});
 const reports=await Promise.all(SPORT_LEAGUES[sport as Sport].map(getFreeLeagueReport));
 return NextResponse.json({sport,classification:'SHADOW',reports,providerCalls:0,databaseWrites:0},{headers:{'Cache-Control':'no-store'}});
}
