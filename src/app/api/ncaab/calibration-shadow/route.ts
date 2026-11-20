import {NextResponse} from 'next/server';
import {getNcaabCalibrationReadiness} from '@/services/ncaab-calibration-readiness.service';

export const dynamic='force-dynamic';export const revalidate=0;
export async function GET(){
 try{return NextResponse.json(await getNcaabCalibrationReadiness(),
  {headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({status:'UNAVAILABLE',
  warning:'NCAAB calibration research could not verify its frozen sources. No accuracy, model promotion or betting edge assumed.'},
  {status:503,headers:{'Cache-Control':'private, no-store'}});}
}
