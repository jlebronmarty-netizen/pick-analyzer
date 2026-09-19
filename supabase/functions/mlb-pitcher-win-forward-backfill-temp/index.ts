import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const AUDIENCE="supabase-pitcher-win-forward-backfill";
const REPOSITORY="jlebronmarty-netizen/pick-analyzer";
const ALLOWED_REF="refs/heads/research/pitcher-win-forward-compatible-20260919";
const JWKS=createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST") return json({error:"METHOD_NOT_ALLOWED"},405);
  const token=(req.headers.get("x-github-oidc-token")||"").trim();
  if(!token) return json({error:"OIDC_REQUIRED"},401);
  try{
    const {payload}=await jwtVerify(token,JWKS,{issuer:"https://token.actions.githubusercontent.com",audience:AUDIENCE});
    if(payload.repository!==REPOSITORY||payload.ref!==ALLOWED_REF) return json({error:"OIDC_SCOPE_REJECTED"},403);
  }catch{return json({error:"OIDC_INVALID"},401);}

  const body=await req.json().catch(()=>({}));
  const dates=Array.isArray(body?.dates)?body.dates.map(String):[];
  if(!dates.length||dates.some((d:string)=>!/^2026-\d{2}-\d{2}$/.test(d))) return json({error:"DATES_REQUIRED"},400);

  const url=Deno.env.get("SUPABASE_URL")||"";
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

  const results=[];
  for(const date of dates){
    const teamSync=await db.rpc("sync_mlb_pitcher_win_forward_team_history_v1",{p_target_date:date});
    if(teamSync.error) return json({error:"TEAM_SYNC_FAILED",date,detail:teamSync.error.message},500);
    const starterSync=await db.rpc("sync_mlb_pitcher_win_forward_starter_history_v1",{p_target_date:date});
    if(starterSync.error) return json({error:"STARTER_SYNC_FAILED",date,detail:starterSync.error.message},500);

    const fields="dates,date,games,gamePk,decisions,winner,id,fullName,loser";
    const params=new URLSearchParams({sportId:"1",date,hydrate:"decisions",fields});
    const resp=await fetch("https://statsapi.mlb.com/api/v1/schedule?"+params.toString(),{headers:{"User-Agent":"pick-analyzer-research/1.0"}});
    if(!resp.ok) return json({error:"MLB_DECISIONS_HTTP",date,status:resp.status},502);
    const payload=await resp.json();
    const games=(payload?.dates??[]).flatMap((d:any)=>Array.isArray(d?.games)?d.games:[]);
    let resolved=0,updated=0;
    for(const game of games){
      const gamePk=Number(game?.gamePk);
      const winnerId=Number(game?.decisions?.winner?.id);
      if(!Number.isSafeInteger(gamePk)||!Number.isSafeInteger(winnerId)) continue;
      resolved+=1;
      const rows=await db.from("mlb_pitcher_win_forward_starter_history_v1")
        .select("starter_side,starter_mlbam_id")
        .eq("season",2026).eq("game_pk",gamePk);
      if(rows.error) return json({error:"STARTER_READ_FAILED",date,gamePk,detail:rows.error.message},500);
      for(const row of rows.data??[]){
        const yWin=Number(row.starter_mlbam_id)===winnerId?1:0;
        const upd=await db.from("mlb_pitcher_win_forward_starter_history_v1")
          .update({y_win:yWin,outcome_source:"MLB_OFFICIAL_DECISIONS_FORWARD_SYNC_V1",updated_at:new Date().toISOString()})
          .eq("season",2026).eq("game_pk",gamePk).eq("starter_side",row.starter_side);
        if(upd.error) return json({error:"STARTER_UPDATE_FAILED",date,gamePk,detail:upd.error.message},500);
        updated+=1;
      }
    }
    results.push({date,resolvedGames:resolved,updatedStarterRows:updated,teamSync:teamSync.data,starterSync:starterSync.data});
  }

  return json({
    contract:"MLB_PITCHER_WIN_FORWARD_BACKFILL_TEMP/1.0.0",
    researchOnly:true,officialPicksModified:false,apostarActivated:false,
    oddsApiCalls:0,results
  });
});