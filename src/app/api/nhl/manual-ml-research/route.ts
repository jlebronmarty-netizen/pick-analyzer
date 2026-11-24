import {NextResponse} from 'next/server';
import {getNhlManualMlResearch} from '@/services/nhl-manual-ml-research.service';

export const dynamic='force-dynamic';
export const revalidate=0;
export const maxDuration=60;

export async function GET() {
  try {
    return NextResponse.json(await getNhlManualMlResearch(),{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {
    const code=error instanceof Error ? error.message : 'READ_UNAVAILABLE';
    return NextResponse.json({status:code==='SOURCE_SCAN_CAPPED'?'SOURCE_SCAN_CAPPED':'READ_UNAVAILABLE',
      cutoff:new Date().toISOString(),readOnly:true,providerCalls:0,databaseWrites:0,predictionAdjustment:false,modelPromoted:false,
      warnings:['No se pudo verificar el archivo completo. No se publican métricas parciales.']},
      {status:503,headers:{'Cache-Control':'private, no-store'}});
  }
}
