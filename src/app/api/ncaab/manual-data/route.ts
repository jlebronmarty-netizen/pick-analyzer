import {NextResponse} from 'next/server';
import {getNcaabManualData} from '@/services/ncaab-manual-data.service';
import {ncaabManualJsonResponse} from '@/lib/ncaab-manual-response';

export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request) {
  const params=new URL(request.url).searchParams;
  if(params.getAll('date').length>1)return NextResponse.json({error:'INVALID_DATE'},{status:400,headers:{'Cache-Control':'no-store'}});
  try {
    const report=await getNcaabManualData(params.get('date')??undefined);
    return ncaabManualJsonResponse(report);
  } catch {
    return NextResponse.json({error:'INVALID_DATE',message:'Usa una fecha válida en formato YYYY-MM-DD.'},{status:400,headers:{'Cache-Control':'no-store'}});
  }
}
