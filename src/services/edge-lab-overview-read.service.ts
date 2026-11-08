import 'server-only';
import {cache} from 'react';
import {readEdgeLab} from './edge-lab.service.mjs';
import {readMultiSports} from './edge-lab-multi.service.mjs';
import {buildEdgeLabOverviewCard} from '@/lib/edge-lab/overview-cards.mjs';
import type {SportModelCard} from '@/lib/sport-model-overview';
// Only aggregate counts are returned to the homepage; full selections remain in protected Edge Lab.
export const getEdgeLabOverviewCards=cache(async():Promise<SportModelCard[]>=>{
 const [soccer,multi]=await Promise.allSettled([readEdgeLab(),readMultiSports()]);
 const checkedAt=new Date().toISOString();
 return [buildEdgeLabOverviewCard('SOCCER',soccer.status==='fulfilled'?soccer.value:null,checkedAt),
  buildEdgeLabOverviewCard('TT',multi.status==='fulfilled'?multi.value:null,checkedAt),
  buildEdgeLabOverviewCard('NCAAF',multi.status==='fulfilled'?multi.value:null,checkedAt)];
});
