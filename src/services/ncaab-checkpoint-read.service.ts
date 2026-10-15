import 'server-only';
import {createHash} from 'node:crypto';
import snapshot from '@/data/ncaab-checkpoint.json' with {type:'json'};
import {checkpointSchema,type NcaabReport} from '@/lib/ncaab-checkpoint';

// An imported, immutable display projection, not a running prediction pipeline.
export function getNcaabCheckpoint():NcaabReport{
 const digest=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 const result=checkpointSchema.safeParse(snapshot);
 if(digest!==SNAPSHOT_SHA256||!result.success)return {status:'UNAVAILABLE',warning:'NCAAB: checkpoint no verificable; no se sustituyen datos ni métricas.'};
 return {status:'AVAILABLE',data:result.data};
}
const SNAPSHOT_SHA256='3ef881c69ed403d0d2731ab894ddaa0c9532f9a42360108c800476e5b9b498c9';
