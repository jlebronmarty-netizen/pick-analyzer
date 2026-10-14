import {NextResponse} from 'next/server';
import {getMultisportModelReport} from '@/services/multisport-model-read.service';
import {getMlbOperationalView} from '@/services/pick2-operational-read.service';
import {combinedDay} from '@/lib/multisport-day';
export const dynamic='force-dynamic';
export async function GET(){const [report,view]=await Promise.all([getMultisportModelReport(),getMlbOperationalView()]);return NextResponse.json({cards:report.cards,day:combinedDay(view,report.nhl,report.research),readAt:report.readAt,providerCalls:0,databaseWrites:0},{headers:{'Cache-Control':'no-store'}});}
