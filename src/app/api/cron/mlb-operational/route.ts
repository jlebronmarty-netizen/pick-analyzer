import {timingSafeEqual} from 'node:crypto'
import {executeProductionTick} from '../../../../../scripts/mlb-operational-tick.mjs'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=800
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}})

async function invoke(request:Request,hostDry:boolean) {
  const secret=process.env.CRON_SECRET,supplied=Buffer.from(request.headers.get('authorization')??''),expected=Buffer.from(`Bearer ${secret??''}`)
  if(!secret || supplied.length!==expected.length || !timingSafeEqual(supplied,expected))return reply({status:'UNAUTHORIZED'},401)
  if(new URL(request.url).search || request.body!==null)return reply({status:'INVALID_REQUEST'},400)
  try {return reply(await executeProductionTick({packageSha:process.env.VERCEL_GIT_COMMIT_SHA,hostDry}))}
  catch(error) {
    const code=error instanceof Error?error.message:''
    const reason=/^(R6_HOST|R6_STATE|R6_CLIENT|R6_CHECKPOINT|AUTOMATION_BLOCK|PREFLIGHT)[:_][A-Z_]+$/.test(code)?code:'MLB_OPERATIONAL_EXECUTION_BLOCKED'
    return reply({status:'BLOCKED',reason},503)
  }
}
// Cron uses GET. POST is the same authenticated, provider-free host probe.
// Neither method accepts caller-selected games, dates, packages or budgets.
export const GET=(request:Request)=>invoke(request,false)
export const POST=(request:Request)=>invoke(request,true)
