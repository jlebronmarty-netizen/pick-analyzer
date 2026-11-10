import {NextResponse} from 'next/server';
import {getTennisSourceHealth} from '@/services/tennis-source-preflight.service.mjs';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json(await getTennisSourceHealth(),{headers:{'Cache-Control':'no-store'}});}
