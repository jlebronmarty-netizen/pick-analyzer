import {NextResponse} from 'next/server';
import {getNhlResearchAudit} from '@/services/nhl-research-audit.service';

export const dynamic='force-dynamic';
export const revalidate=0;
export const maxDuration=60;

export async function GET() {
  try {
    return NextResponse.json(await getNhlResearchAudit(),{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {
    const code=error instanceof Error ? error.message : 'READ_UNAVAILABLE';
    return NextResponse.json({
      status:code==='SOURCE_SCAN_CAPPED'?'SOURCE_SCAN_CAPPED':'READ_UNAVAILABLE',
      auditedAt:new Date().toISOString(),readOnly:true,providerCalls:0,databaseWrites:0,
      warnings:['No se pudo verificar el archivo completo de NHL. No se muestran métricas de una lectura parcial.'],
    },{status:503,headers:{'Cache-Control':'private, no-store'}});
  }
}
