import {NextResponse} from 'next/server';import {getUfcFreeReport} from '@/services/ufc-free.service';
export const dynamic='force-dynamic';export async function GET(){return NextResponse.json(await getUfcFreeReport(),{headers:{'Cache-Control':'no-store'}});}
