// Server-side adapter only. The route injects the existing supabaseAdmin client.
export function createHoopsDurableStore(db) {
  async function rpc(name, args) {
    const result = await db.rpc(name, args).abortSignal(AbortSignal.timeout(5000));
    if (result.error || !result.data || typeof result.data !== 'object') throw new Error('HOOPSAPI_LEDGER_UNAVAILABLE');
    return result.data;
  }
  async function capture(account, id = null) {
    let query = db.from('nba_hoopsapi_captures_v1').select('capture_id,source_received_at,archived_at,response_sha256,normalized').eq('account_scope', account);
    query = id ? query.eq('capture_id', id) : query.order('archived_at', {ascending: false});
    const result = await query.limit(1).maybeSingle().abortSignal(AbortSignal.timeout(5000));
    if (result.error) throw new Error('HOOPSAPI_ARCHIVE_READ_UNAVAILABLE');
    return result.data ? {...result.data.normalized, capture_id: result.data.capture_id,
      archived_at: result.data.archived_at, response_sha256: result.data.response_sha256,
      capture_persisted: true, restored_from_archive: true, provider_calls_made: 0, database_writes: 0} : null;
  }
  return {
    status: account => rpc('read_nba_hoopsapi_quota_v1', {p_account: account}),
    claim: (account, requestId) => rpc('claim_nba_hoopsapi_capture_v1', {p_account: account, p_request_id: requestId}),
    claimScheduled: (account, requestId) => rpc('claim_nba_hoopsapi_scheduled_capture_v1', {p_account: account, p_request_id: requestId}),
    dispatch: (account, attemptId) => rpc('dispatch_nba_hoopsapi_capture_v1', {p_account: account, p_attempt_id: attemptId}),
    complete: (account, attemptId, evidence) => rpc('complete_nba_hoopsapi_capture_v1', {
      p_account: account, p_attempt_id: attemptId, p_received_at: evidence.receivedAt,
      p_raw: evidence.raw, p_sha256: evidence.sha256, p_normalized: evidence.normalized,
    }),
    fail: (account, attemptId, failure) => rpc('fail_nba_hoopsapi_capture_v1', {
      p_account: account, p_attempt_id: attemptId, p_code: failure.code,
      p_http: failure.http ?? null, p_retry_seconds: failure.retrySeconds ?? null,
    }),
    latest: account => capture(account), capture,
  };
}
