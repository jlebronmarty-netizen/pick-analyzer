import assert from "node:assert/strict";
import fs from "node:fs";
import { archiveFixture } from "./fixtures/nhl-sheet-final.mjs";
import { postgresLedger } from "../research/nhl-sheet-tracker/ledger.mjs";
import { processPending } from "../research/nhl-sheet-tracker/settlement.mjs";
const { Client } = (await import(process.env.NBA_SHEET_TEST_PG_MODULE ?? "pg"))
  .default;
const db = new Client({
  host: "127.0.0.1",
  port: Number(process.env.NBA_SHEET_TEST_PORT ?? 55438),
  user: "postgres",
  database: "postgres",
});
await db.connect();
const q = async (s, args) => (await db.query(s, args)).rows;
try {
  await q(
    "begin; create role anon; create role authenticated; create role service_role bypassrls; create role inherited_reader; grant inherited_reader to authenticated",
  );
  await q(
    "alter default privileges grant all on tables to anon,authenticated,service_role; alter default privileges grant all on sequences to service_role",
  );
  const migration = fs.readFileSync(
    new URL(
      "../supabase/migrations/202611270901_nhl_sheet_tracker_review.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await q("savepoint unsafe");
  await q(
    "alter default privileges grant insert on tables to inherited_reader",
  );
  await assert.rejects(q(migration), /unexpected effective table ACL/);
  await q("rollback to unsafe");
  await q(migration);
  const check = migration.slice(migration.lastIndexOf("do $$"));
  await q("savepoint col");
  await q("grant update(side) on nhl_sheet_v1.receipts to inherited_reader");
  await assert.rejects(q(check), /unexpected effective column ACL/);
  await q("rollback to col");
  assert.equal(
    (
      await q(
        "select count(*) n from pg_class where relnamespace='nhl_sheet_v1'::regnamespace and relkind='v' and reloptions @> array['security_invoker=true']",
      )
    )[0].n,
    "5",
  );
  const start = new Date(Date.now() + 2500).toISOString();
  const insert = async (source, strategy, side, line, odds, pos, ev = 6) =>
    (
      await q(
        `insert into nhl_sheet_v1.receipts
 (source,strategy,event_id,home_id,away_id,market,book,label,jurisdiction,rule_id,period,side,line,odds,position,evaluated,quoted_at,recorded_at,starts_at)
 values($1,$2,'nhl:2',1,2,'spread','test','GAME','test','test','REG',$3,$4,$5,$6,$7,statement_timestamp(),'2000-01-01',$8) on conflict do nothing returning id,recorded_at`,
        [
          source,
          strategy,
          side,
          line,
          odds,
          pos,
          pos === null ? null : ev,
          start,
        ],
      )
    )[0];
  const pick = await insert("pick", "pickA", "away", 0.5, -150, null);
  const s = await insert("sheet", "frequency", "home", -0.5, 125, 3);
  assert.ok(s.recorded_at.getUTCFullYear() > 2020);
  assert.equal(
    await insert("sheet", "frequency", "home", -0.5, 120, 1),
    undefined,
  );
  await insert("pick", "late", "home", -0.5, 120, null);
  await insert("sheet", "conditions", "away", 0.5, -145, 1, 8);
  const perf = async () =>
    await q(
      "select * from nhl_sheet_v1.performance where strategy='frequency' and grouping_mask=0 and grain='all' order by rank_type,rank_n",
    );
  assert.equal((await perf()).length, 5);
  for (const r of await perf()) {
    assert.deepEqual(
      [r.decided, r.stake_units, r.net_units, r.won_units, r.lost_units].map(
        Number,
      ),
      [0, 0, 0, 0, 0],
    );
    assert.equal(r.roi, null);
    assert.equal(r.accuracy, null);
  }
  const grade = (id, result) =>
    q(
      "insert into nhl_sheet_v1.grades(receipt_id,result,evidence_id,observed_at) values($1,$2,'fixture',clock_timestamp()) on conflict do nothing",
      [id, result],
    );
  await q("savepoint early");
  await assert.rejects(grade(s.id, "win"), /chronology/);
  await q("rollback to early");
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, Date.parse(start) - Date.now() + 30)),
  );
  const ledger = postgresLedger(db);
  const frozen = new Date().toISOString();
  const rule = {
    id: "test",
    book: "test",
    label: "GAME",
    jurisdiction: "test",
    scope: "REG",
    market: "spread",
    verified: true,
    push: "refund",
    from: "2000-01-01",
    until: "2100-01-01",
    source: "test",
    voidTerms: "test",
  };
  let archive = [];
  const settle = () =>
    processPending({
      ledger,
      rules: [rule],
      readFinal: () => archive,
      asOf: new Date().toISOString(),
    });
  assert.equal((await settle()).written, 0);
  assert.equal((await q("select * from nhl_sheet_v1.pairs")).length, 0);
  archive = [archiveFixture(start, frozen)];
  assert.equal((await settle()).written, 4);
  assert.equal((await settle()).written, 0);
  const [paired] = await q(
    "select * from nhl_sheet_v1.paired_performance where strategy='frequency' and grouping_mask=0 and grain='all' and rank_type='position'",
  );
  assert.deepEqual(
    [
      paired.pairs,
      paired.sheet_roi,
      paired.pick_roi,
      paired.sheet_accuracy,
      paired.pick_accuracy,
    ].map(Number),
    [1, 1.25, -1, 1, 0],
  );
  assert.equal(paired.pick_strategy, "pickA");
  assert.equal(paired.evaluated, 6);
  assert.equal(
    (await q("select distinct grain from nhl_sheet_v1.performance")).length,
    4,
  );
  assert.equal(
    (await perf())
      .filter((r) => r.rank_type === "top")
      .map((r) => r.rank_n)
      .join(","),
    "3,5,7,10",
  );
  await q("savepoint mutation");
  await assert.rejects(q("delete from nhl_sheet_v1.receipts"), /immutable/);
  await q("rollback to mutation");
  await q("set local role service_role");
  await q("select * from nhl_sheet_v1.performance");
  console.log(
    "PASS prospective pairs, retry, rankings, chronology, accounting, ACL and RLS",
  );
} finally {
  await q("rollback");
  await db.end();
}
