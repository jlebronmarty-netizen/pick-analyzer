import {getNbaManualData} from '@/services/nba-manual-data.service';
import {ncaabManualDate,validateNcaabManualDate} from '@/services/ncaab-manual-data.service';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 let date:string;
 try{if(params.getAll('date').length>1)throw Error();date=validateNcaabManualDate(params.get('date')??ncaabManualDate());}
 catch{return Response.json({error:'INVALID_DATE'},{status:400,headers:{'Cache-Control':'no-store'}});}
 try{
 const report=await getNbaManualData(date);
 const bytes=new TextEncoder().encode(JSON.stringify(report));let offset=0;
 return new Response(new ReadableStream<Uint8Array>({pull(c){if(offset>=bytes.length){c.close();return;}const end=Math.min(offset+65536,bytes.length);c.enqueue(bytes.subarray(offset,end));offset=end;}}),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({schemaVersion:'NBA_MANUAL_DATA_V1',date,status:'UNAVAILABLE',readOnly:true,providerCalls:0,databaseWrites:0,warnings:['No se pudo verificar la lectura completa del archivo.']},{status:503,headers:{'Cache-Control':'no-store'}});}
}
