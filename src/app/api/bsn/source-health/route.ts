import {NextResponse} from 'next/server';
import {getBsnArchiveHealth} from '@/services/bsn-archive.service.mjs';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json(await getBsnArchiveHealth(),{headers:{'Cache-Control':'no-store'}});}
