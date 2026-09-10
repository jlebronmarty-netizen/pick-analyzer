const codes=new Set(['ODDS_OUTCOME_UNCERTAIN','INCOMPLETE_SOURCE_ACQUISITION','FROZEN_PACKAGE_CONFLICT','STALE_PENDING_RUN_REQUIRES_REVIEW','REVISION_CONFLICT','STALE_FENCE_OR_LEASE','BLOCK_CONFLICT','STATE_COMMAND_FAILED','STARTED_GAME_WRITE','WRITE_PAYLOAD_SHAPE','WRITE_READBACK','EVIDENCE_CREATE_FAILED','EVIDENCE_READ_FAILED','EVIDENCE_IMMUTABLE_CONFLICT','EVIDENCE_BUCKET_REQUIRED','EVIDENCE_BUCKET_CONTRACT','INVOCATION_BUDGET_YIELD','INVALID_OUTCOME','MAPPING_CONFLICT','FUTURE_MARKET_UPDATE','STARTED_GAME','POST_START_VALUE','POST_START_PICK','INSERT_COUNT','INDEPENDENT_READBACK'])
export function sanitizedStageException(error) {
  const part=typeof error?.message==='string'?error.message.split(':')[1]:null
  const code=codes.has(part)?part:'UNCLASSIFIED_STAGE_EXCEPTION'
  const exceptionClass=['Error','TypeError','RangeError','SyntaxError','AbortError','TimeoutError'].includes(error?.name)?error.name:'Error'
  return {code,exceptionClass,message:code==='UNCLASSIFIED_STAGE_EXCEPTION'?'Stage failed; untrusted exception text withheld.':`Stage stopped: ${code}.`}
}
