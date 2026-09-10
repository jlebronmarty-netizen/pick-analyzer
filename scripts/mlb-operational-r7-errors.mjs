const codes=new Set(['ODDS_OUTCOME_UNCERTAIN','INCOMPLETE_SOURCE_ACQUISITION','FROZEN_PACKAGE_CONFLICT','STALE_PENDING_RUN_REQUIRES_REVIEW','REVISION_CONFLICT','STALE_FENCE_OR_LEASE','BLOCK_CONFLICT','STATE_COMMAND_FAILED','STARTED_GAME_WRITE','WRITE_PAYLOAD_SHAPE','WRITE_READBACK','EVIDENCE_CREATE_FAILED','EVIDENCE_READ_FAILED','EVIDENCE_IMMUTABLE_CONFLICT','EVIDENCE_BUCKET_REQUIRED','EVIDENCE_BUCKET_CONTRACT','INVOCATION_BUDGET_YIELD','INVALID_OUTCOME','MAPPING_CONFLICT','FUTURE_MARKET_UPDATE','STARTED_GAME','POST_START_VALUE','POST_START_PICK','INSERT_COUNT','INDEPENDENT_READBACK'])
const sqlStates=new Set(['23502','23503','23505','23514','22003','22007','22P02','42501','57014','55P03','40001','40P01','53300','53400','08001','08003','08004','08006','08007','08P01'])
const runtimeCode=code=>code==='RUNTIME_RESPONSE_CONTRACT' || /^RUNTIME_HTTP_[45][0-9]{2}$/.test(code) || /^RUNTIME_SQLSTATE_[A-Z0-9]{5}_HTTP_[45][0-9]{2}$/.test(code)&&sqlStates.has(code.split('_')[2])

// Never retain response messages, bodies, headers or URLs. Only bounded HTTP
// status and a fixed SQLSTATE vocabulary may enter durable diagnostics.
export function runtimeResponseFailure(status,body) {
  if(typeof body?.reason==='string' && /^R6_STATE:[A-Z_]+$/.test(body.reason))return body.reason
  if(Number.isInteger(status) && status>=400 && status<=599) {
    return `R6_STATE:${sqlStates.has(body?.code)?`RUNTIME_SQLSTATE_${body.code}_HTTP_${status}`:`RUNTIME_HTTP_${status}`}`
  }
  return 'R6_STATE:RUNTIME_RESPONSE_CONTRACT'
}
export function sanitizedStageException(error) {
  const message=typeof error?.message==='string'?error.message:''
  const part=message.startsWith('R6_STATE:')?message.slice(9):message.split(':')[1]
  const dependencyCodes=new Set(['OPERATION_TIMEOUT','OPERATION_ABORTED','R2N_CSV_SCHEMA','R2N_CSV_ROW_SHAPE','R2N_CSV_BYTE_CAP','R2N_SCOPED_ROW_CAP','R2N_RAW_CACHE_READ_FAILED','R2N_RAW_CACHE_TRUNCATED_OR_OVER_CAP','R2N_STATCAST_TIMEOUT','R2N_STATCAST_NETWORK_FAILURE','R2N_DEPENDENCY_WINDOW_TOO_BROAD','R2N_STATCAST_PROVIDER_CAP_EXCEEDED','STATCAST_DAILY_CAP_SUSPECT'])
  const candidate=message.startsWith('R6_STATE:')?part:message.split(':')[0]
  const readCodes=new Set(['DEPENDENCY_READ_FAILURE','CANONICAL_READ_FAILURE','CANONICAL_GUARD_FAILURE','DATABASE_READ_FAILURE','PERSISTENCE_INSERT_FAILURE'])
  const classifiedRead=readCodes.has(candidate)?candidate:message.startsWith('R2TR1_READ_BLOCK:')?'DEPENDENCY_READ_FAILURE':message.startsWith('R2T_PRODUCTION_BLOCK:READ:')?'CANONICAL_READ_FAILURE':message.startsWith('R2T_PRODUCTION_BLOCK:')?'CANONICAL_GUARD_FAILURE':message.startsWith('READ_FAILED:')?'DATABASE_READ_FAILURE':message.startsWith('INSERT_FAILED:')?'PERSISTENCE_INSERT_FAILURE':null
  const dependency=dependencyCodes.has(candidate)||/^R2N_STATCAST_HTTP_[45][0-9]{2}$/.test(candidate)||runtimeCode(candidate)?candidate:classifiedRead
  const code=dependency??(codes.has(part)?part:error?.name==='TimeoutError'?'OPERATION_TIMEOUT':error?.name==='AbortError'?'OPERATION_ABORTED':'UNCLASSIFIED_STAGE_EXCEPTION')
  const exceptionClass=['Error','TypeError','RangeError','SyntaxError','AbortError','TimeoutError'].includes(error?.name)?error.name:'Error'
  return {code,exceptionClass,message:code==='UNCLASSIFIED_STAGE_EXCEPTION'?'Stage failed; untrusted exception text withheld.':`Stage stopped: ${code}.`}
}
