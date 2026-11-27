// Takes a dedicated PostgreSQL client owned by the caller. Never opens a connection.
export function postgresLedger(client) {
  return {
    async *pending(asOf) {
      let after = "0";
      for (;;) {
        const { rows } = await client.query(
          `select r.id,r.event_id as "eventId",r.home_id::int as "homeId",
         r.away_id::int as "awayId",r.market,r.period as scope,r.book,r.jurisdiction,r.label,r.rule_id as "ruleId",
         r.side,r.line::float8 as line,r.odds,r.starts_at as start,r.quoted_at as "quotedAt",r.recorded_at as "recordedAt"
         from nhl_sheet_v1.receipts r left join nhl_sheet_v1.grades g on r.id=g.receipt_id
         where r.starts_at<$1 and r.id>$2 and g.receipt_id is null order by r.id limit 100`,
          [asOf, after],
        );
        for (const row of rows)
          yield {
            ...row,
            start: row.start.toISOString(),
            quotedAt: row.quotedAt.toISOString(),
            recordedAt: row.recordedAt.toISOString(),
          };
        if (rows.length < 100) return;
        after = rows.at(-1).id;
      }
    },
    async insertGradeOnce(id, g) {
      const inserted = await client.query(
        `insert into nhl_sheet_v1.grades(receipt_id,result,evidence_id,observed_at)
       values($1,$2,$3,$4) on conflict(receipt_id) do nothing returning receipt_id`,
        [id, g.result, g.evidenceId, g.observedAt],
      );
      if (inserted.rowCount) return true;
      const previous = await client.query(
        "select result,evidence_id from nhl_sheet_v1.grades where receipt_id=$1",
        [id],
      );
      if (
        previous.rows[0]?.result !== g.result ||
        previous.rows[0]?.evidence_id !== g.evidenceId
      )
        throw Error("NHL settlement conflict");
      return false;
    },
    async freeze(entries) {
      await client.query("begin");
      try {
        let saved = 0;
        for (const c of entries) {
          const x = await client.query(
            `insert into nhl_sheet_v1.receipts(source,strategy,event_id,home_id,away_id,market,book,jurisdiction,rule_id,label,period,side,line,odds,position,evaluated,quoted_at,cut_at,starts_at)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) on conflict do nothing returning id`,
            [
              c.source,
              c.strategy,
              c.eventId,
              c.homeId,
              c.awayId,
              c.market,
              c.book,
              c.jurisdiction,
              c.ruleId,
              c.label,
              c.scope,
              c.side,
              c.line,
              c.odds,
              c.position,
              c.evaluated,
              c.quotedAt,
              c.cutAt,
              c.start,
            ],
          );
          saved += x.rowCount;
        }
        await client.query("commit");
        return saved;
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    },
  };
}
