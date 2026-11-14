import 'server-only';
import {getNhlFreeReport} from '@/services/nhl-free.service';
import {getNhlCausalLearningReport} from '@/services/nhl-causal-learning.service';
import {nhlAuditSummary} from '@/lib/nhl-audit-core.mjs';
// Bounded database-backed read only; no outbound NHL requests, crons or model writes.
export async function getNhlProductionAudit(){
 const [report,learning]=await Promise.all([getNhlFreeReport(),getNhlCausalLearningReport()]);
 return nhlAuditSummary({report,learning,now:new Date().toISOString()});
}
