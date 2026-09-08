// Compile only the frozen, explicitly authorized R2C packet. No network client.
import assert from 'node:assert/strict'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { classifyRepair } from './mlb-data-02r-r2t-r2c-repair-review.mjs'
export const PROJECT = 'MLB_DATA_02R_R2T_R2D_CANONICAL_NATIVE_ENRICHMENT_EXECUTION'
export const FROZEN_SHA = '9fb94364d843c4b5bf5c81bd9f2a36b2c5205b0f'
export const PACKET_DIGEST = '69c04f384e4582005340078487e0b0f31a0f47c3afbdc2d9a68cfdf5ce6d0f03'
export const CERTIFICATE = 'docs/CERTIFICATION/MLB_DATA_02R_R2T_R2C_NATIVE_REPAIR_REVIEW_AND_UNKNOWN_STARTER_RESOLUTION.json'
const allowed = ['away_team_id', 'game_type', 'home_team_id', 'metadata.officialDate', 'metadata.r2t_r2b_evidence', 'updated_at']

export function validatePacket(certificate, rows) {
  const packet = certificate.authorizationPacket
  assert.equal(sha256(packet), PACKET_DIGEST, 'FROZEN_PACKET_CHANGED')
  assert.equal(rows.length, 15); assert.equal(new Set(rows.map((r) => r.game_pk)).size, 15)
  assert.deepEqual(rows.map((r) => r.game_pk).sort((a, b) => a - b), packet.rows.map((r) => r.gamePk).sort((a, b) => a - b), 'ROW_SCOPE')
  for (const plan of packet.rows) {
    assert.deepEqual(plan.patches.map((p) => p.logicalField).sort(), allowed, 'EXCLUDED_FIELD_OR_CAP')
    assert.ok(plan.patches.every((p) => p.table === 'public.pick2_mlb_games' && p.safeToPatch && p.historicallyPregameProven === false))
    assert.equal(sha256(rows.find((r) => r.game_pk === plan.gamePk)), plan.expectedRowDigest, 'EXPECTED_OLD_ROW_CHANGED')
  }
  return true
}

export function compileEnrichment(certificate, before, { execute = false } = {}) {
  validatePacket(certificate, before)
  const records = certificate.authorizationPacket.rows.map((plan) => {
    const projected = classifyRepair(plan, plan.expectedRow, plan.minimumWriteTimestamp)
    assert.equal(projected.action, 'UPDATE_ELIGIBLE')
    return { gamePk: plan.gamePk, old: plan.expectedRow, next: projected.projected,
      minimumWriteTimestamp: plan.minimumWriteTimestamp, patchCount: plan.patches.length }
  })
  const payload = JSON.stringify(records)
  assert.ok(!payload.includes('$r2d_packet$') && !payload.includes('$r2d$'), 'SQL_DELIMITER')
  // One anonymous block is one atomic statement: any exception rolls back all
  // UPDATEs. No persistent function/table or schema object is created.
  return `DO $r2d$
DECLARE
  packet constant jsonb := $r2d_packet$${payload}$r2d_packet$::jsonb;
  execute_authorized constant boolean := ${execute ? 'true' : 'false'};
  item jsonb;
  old_row public.pick2_mlb_games%ROWTYPE;
  next_row public.pick2_mlb_games%ROWTYPE;
  actual_row public.pick2_mlb_games%ROWTYPE;
  write_time constant timestamptz := statement_timestamp();
  locked_count integer := 0;
  affected integer := 0;
  total_updates integer := 0;
BEGIN
  LOCK TABLE public.pick2_mlb_games IN ROW EXCLUSIVE MODE NOWAIT;
  IF jsonb_array_length(packet) <> 15 OR (SELECT sum((p->>'patchCount')::integer) FROM jsonb_array_elements(packet) p) <> 90 THEN
    RAISE EXCEPTION 'R2D_CAP_OR_PACKET';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.pick2_mlb_games'::regclass AND NOT tgisinternal)
    OR EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class='public.pick2_mlb_games'::regclass AND rulename <> '_RETURN') THEN
    RAISE EXCEPTION 'R2D_UNEXPECTED_WRITE_SIDE_EFFECT';
  END IF;
  -- Lock and verify ALL rows before the first UPDATE. NOWAIT fails closed on contention.
  FOR item IN SELECT p FROM jsonb_array_elements(packet) p ORDER BY (p->>'gamePk')::bigint LOOP
    old_row := jsonb_populate_record(NULL::public.pick2_mlb_games, item->'old');
    SELECT * INTO STRICT actual_row FROM public.pick2_mlb_games WHERE game_pk=(item->>'gamePk')::bigint FOR UPDATE NOWAIT;
    IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(to_jsonb(actual_row)) k)
      IS DISTINCT FROM (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(item->'old') k) THEN RAISE EXCEPTION 'R2D_SCHEMA_SHAPE'; END IF;
    IF to_jsonb(actual_row) IS DISTINCT FROM to_jsonb(old_row) THEN RAISE EXCEPTION 'R2D_OLD_VALUE_CONFLICT:%', actual_row.game_pk; END IF;
    IF write_time < (item->>'minimumWriteTimestamp')::timestamptz OR write_time < actual_row.updated_at THEN RAISE EXCEPTION 'R2D_TIMESTAMP'; END IF;
    locked_count := locked_count + 1;
  END LOOP;
  IF locked_count <> 15 THEN RAISE EXCEPTION 'R2D_ROW_SCOPE'; END IF;
  IF execute_authorized THEN
    FOR item IN SELECT p FROM jsonb_array_elements(packet) p ORDER BY (p->>'gamePk')::bigint LOOP
      old_row := jsonb_populate_record(NULL::public.pick2_mlb_games, item->'old');
      next_row := jsonb_populate_record(NULL::public.pick2_mlb_games, item->'next');
      next_row.updated_at := write_time;
      -- Only five physical columns: two approved JSON paths are coalesced in metadata.
      UPDATE public.pick2_mlb_games AS g SET
        home_team_id=next_row.home_team_id, away_team_id=next_row.away_team_id,
        game_type=next_row.game_type, metadata=next_row.metadata, updated_at=write_time
      WHERE g.game_pk=old_row.game_pk AND to_jsonb(g)=to_jsonb(old_row);
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> 1 THEN RAISE EXCEPTION 'R2D_UPDATE_PREDICATE'; END IF;
      total_updates := total_updates + affected;
      IF total_updates > 15 OR total_updates * 6 > 90 THEN RAISE EXCEPTION 'R2D_DML_CAP'; END IF;
      SELECT * INTO STRICT actual_row FROM public.pick2_mlb_games WHERE game_pk=old_row.game_pk;
      IF to_jsonb(actual_row) IS DISTINCT FROM to_jsonb(next_row) THEN RAISE EXCEPTION 'R2D_TRANSACTION_READBACK'; END IF;
    END LOOP;
    IF total_updates <> 15 THEN RAISE EXCEPTION 'R2D_FINAL_CAP'; END IF;
  END IF;
END
$r2d$;`
}

export function verifyReadback(certificate, before, after) {
  validatePacket(certificate, before)
  assert.equal(after.length, 15)
  assert.deepEqual(after.map((r) => r.game_pk).sort((a, b) => a - b), before.map((r) => r.game_pk).sort((a, b) => a - b))
  const rows = certificate.authorizationPacket.rows.map((plan) => {
    const current = after.find((r) => r.game_pk === plan.gamePk)
    assert.equal(classifyRepair(plan, current, current.updated_at).action, 'REUSE_NO_OP', 'READBACK_OR_PROVENANCE_CONFLICT')
    const expected = classifyRepair(plan, plan.expectedRow, current.updated_at).projected
    assert.equal(sha256(current), sha256(expected), 'EXACT_READBACK')
    const excluded = certificate.exclusions.fields.filter((p) => p.gamePk === plan.gamePk)
    const value = (row, field) => field.split('.').reduce((v, k) => v?.[k], row)
    for (const p of excluded) assert.deepEqual(value(current, p.logicalField), value(plan.expectedRow, p.logicalField), 'EXCLUDED_FIELD_CHANGED')
    return { gamePk: plan.gamePk, rowUpdates: 1, fieldPatches: 6, updatedAt: current.updated_at,
      beforeDigest: sha256(plan.expectedRow), afterDigest: sha256(current), excludedFieldsChecked: excluded.length,
      provenance: 'EXACT_PACKET_MATCH', idempotencyProjection: 'REUSE_NO_OP' }
  })
  assert.equal(rows.reduce((n, r) => n + r.excludedFieldsChecked, 0), 52)
  const unknown = after.find((r) => r.game_pk === 823092)
  assert.deepEqual(unknown.metadata.starter_evidence, { homeProbablePitcher: null, awayProbablePitcher: null })
  assert.ok(!unknown.metadata.homeProbablePitcher && !unknown.metadata.awayProbablePitcher)
  return { status: 'PASS', rowUpdates: 15, fieldPatches: 90, physicalColumnAssignments: 75, excludedFieldsUntouched: 52,
    unknown823092: 'PRESERVED_UNKNOWN', secondPassProjectedUpdates: 0, rows }
}
