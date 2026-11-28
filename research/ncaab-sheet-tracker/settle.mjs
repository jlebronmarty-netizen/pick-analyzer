import {verifyGrade} from "./verify.mjs";

// Dedicated, isolated client. No scheduled hook or production rule catalog.
export async function settlePending(client, {rules, readFinal, asOf}) {
  let after="0", written=0;
  for (;;) {
    const {rows}=await client.query(`select r.* from ncaab_sheet_lab.receipts r
      left join ncaab_sheet_lab.grades g on g.receipt_id=r.id where g.receipt_id is null
      and r.starts_at<$1 and r.id>$2 order by r.id limit 100`,[asOf,after]);
    for (const r of rows) {
      const contract={eventId:r.event_id,homeId:r.home_id,awayId:r.away_id,start:r.starts_at.toISOString(),
        market:r.market,side:r.side,line:Number(r.line),book:r.book,jurisdiction:r.jurisdiction,period:r.period,label:r.label,
        ruleId:r.rule_id,cutAt:r.cut_at.toISOString(),quotedAt:r.quoted_at.toISOString(),recordedAt:r.recorded_at.toISOString()};
      const matches=rules.filter(rule=>rule.ruleId===contract.ruleId && rule.book===contract.book && rule.jurisdiction===contract.jurisdiction);
      if(matches.length!==1)continue;
      const g=verifyGrade(contract,matches[0],await readFinal(contract,asOf),asOf);
      if(!g)continue;
      const inserted=await client.query(`insert into ncaab_sheet_lab.grades(receipt_id,result,evidence_id,observed_at)
        values($1,$2,$3,$4) on conflict(receipt_id) do nothing`,[r.id,g.result,g.evidenceId,g.observedAt]);
      if(inserted.rowCount)written++;
      else {
        const old=(await client.query("select result,evidence_id from ncaab_sheet_lab.grades where receipt_id=$1",[r.id])).rows[0];
        if(old?.result!==g.result||old.evidence_id!==g.evidenceId)throw Error("Conflicting archived settlement");
      }
    }
    if(rows.length<100)return written;
    after=rows.at(-1).id;
  }
}
