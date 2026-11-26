// The linked automation supplies the authenticated, archive-only Pick response.
export function createNbaService({hash,serviceAuthorized}) {
  const archive=typeof pickArchive==='undefined'?null:pickArchive;
  const mergeArchive=(base,extra)=>{
    if(!extra)return base;
    const combine=(a,b,id,stampKey)=>{
      const values=new Map(a.map(x=>[x[id],x]));
      for(const x of b){const prior=values.get(x[id]);if(!prior||Date.parse(x[stampKey])>=Date.parse(prior[stampKey]))values.set(x[id],x);}
      return [...values.values()];
    };
    return {games:combine(base.games,extra.games,'id','at'),schedule:combine(base.schedule,extra.schedule,'id','at'),originals:combine(base.originals,extra.originals,'id','recordedAt').sort((a,b)=>Date.parse(a.decisionAt)-Date.parse(b.decisionAt))};
  };
  const emptyArchive={games:[],originals:[],schedule:[]};
  async function evidence(b){return archive?mergeArchive(archive,await (await b.get('nba/research.json'))?.json()):null;}
  const enriched=async(d,b)=>archive?enrichEvidence(d,await evidence(b)):d;
  async function research(req,b,now){
    if(!await serviceAuthorized(req))fail('Se requiere acceso de servicio.',403);
    const x=await input(req,8*1024*1024);
    const before=v=>Number.isFinite(Date.parse(v))&&Date.parse(v)<=Date.parse(now);
    if(!x||x.date!==day(now)||!['games','originals','schedule'].every(k=>Array.isArray(x[k]))||
      !x.games.every(g=>gameId(g.id)&&before(g.start)&&before(g.at)&&g.home!==g.away&&g.scores?.length===2&&g.scores.every(score)&&Array.isArray(g.players)&&g.players.every(p=>Array.isArray(p)&&gameId(p[0])&&p.length>=10)&&g.periods&&(!g.periodAt||before(g.periodAt)))||
      !x.originals.every(o=>o.model==='NBA_DECISION_BOARD_SHADOW_V1'&&gameId(o.gameId)&&o.id&&before(o.recordedAt)&&Date.parse(o.decisionAt)<=Date.parse(o.recordedAt)&&Date.parse(o.recordedAt)<Date.parse(o.scheduledAt))||
      !x.schedule.every(g=>gameId(g.id)&&before(g.at)&&stamp(g.start)&&g.away&&g.home))fail('Suplemento inválido.',422);
    const saved=await change(b,'nba/research.json',old=>mergeArchive(old??emptyArchive,x));
    const check=await (await b.get('nba/research.json')).json();
    if(await hash(JSON.stringify(check))!==await hash(JSON.stringify(saved)))fail('Verificar de nuevo el suplemento.',409);
    return reply({readback:'VERIFIED',games:saved.games.length,originals:saved.originals.length,schedule:saved.schedule.length});
  }
  const day = t => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico'}).format(new Date(t));
  const stamp = x => Number.isFinite(Date.parse(x));
  const validDay = x => /^\d{4}-\d\d-\d\d$/.test(x) && stamp(x) && new Date(x).toISOString().startsWith(x);
  const gameId = x => /^[0-9]{1,15}$/.test(String(x));
  const score = x => Number.isInteger(x) && x>=0;
  const reply = (data,status=200) => Response.json(data,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
  const fail = (message,status) => {throw Object.assign(Error(message),{status});};
  const key = date => 'nba/days/'+date+'.json';
  async function input(req,limit) {
    if(!req.headers.get('content-type')?.startsWith('application/json')) fail('Se requiere JSON.',415);
    if(!req.body || Number(req.headers.get('content-length'))>limit) fail('Tamaño inválido.',413);
    const reader=req.body.getReader(),parts=[]; let size=0;
    for(;;){const {value,done}=await reader.read(); if(done)break; size+=value.length;
      if(size>limit){await reader.cancel();fail('Tamaño inválido.',413);} parts.push(value);}
    try{return JSON.parse(await new Blob(parts).text());}catch{fail('JSON inválido.',400);}
  }
  // All mutable R2 objects use an ETag precondition, including first creation.
  async function change(bucket,k,fn) {
    for(let i=0;i<5;i++){
      const obj=await bucket.get(k), before=obj?await obj.json():null, after=fn(before);
      if(after===before)return before;
      if(await bucket.put(k,JSON.stringify(after),{onlyIf:obj?{etagMatches:obj.etag}:{etagDoesNotMatch:'*'}}))return after;
    }
    fail('Otra actualización está en curso. Reintenta.',409);
  }
  function validate(d,now){
    if(!d || d.schemaVersion!=='NBA_MANUAL_DATA_V1'||d.sport!=='NBA'||d.timezone!=='America/Puerto_Rico'||
      d.date!==day(now)||!stamp(d.readAt)||day(d.readAt)!==d.date||Date.parse(d.readAt)>Date.parse(now)+1000||
      !stamp(d.source?.scheduleCapturedAt)||Date.parse(d.source.scheduleCapturedAt)>Date.parse(d.readAt)||
      !['READY','PARTIAL','EMPTY'].includes(d.status)||d.readOnly!==true||d.providerCalls!==0||d.databaseWrites!==0||
      d.modelPromoted!==false||d.predictionAdjustment!==false) return false;
    if(!['fixtures','teams','players','periods','lineups','injuries','matchups','finals','warnings'].every(k=>Array.isArray(d[k])))return false;
    const counts={fixtures:'fixtures',players:'players',periods:'periodGames',lineups:'lineups',injuries:'injuries',matchups:'matchupRows',finals:'observedFinals'};
    if(!Object.entries(counts).every(([k,c])=>d[k].length===d.coverage?.[c]))return false;
    return d.fixtures.every(f=>gameId(f.id)&&stamp(f.scheduledAt)&&day(f.scheduledAt)===d.date&&f.home?.name&&f.away?.name&&f.home.name!==f.away.name) &&
      new Set(d.fixtures.map(f=>String(f.id))).size===d.fixtures.length &&
      d.finals.every(f=>gameId(f.gameId)&&stamp(f.scheduledAt)&&day(f.scheduledAt)<d.date&&f.home&&f.away&&score(f.homeScore)&&score(f.awayScore)&&f.homeScore!==f.awayScore) &&
      new Set(d.finals.map(f=>String(f.gameId))).size===d.finals.length &&
      d.teams.every(t=>t.name&&Array.isArray(t.recent)&&t.recent.length<=10)&&
      d.players.every(p=>p.averages&&Array.isArray(p.recent))&&
      d.periods.every(p=>['home','away'].every(s=>{const q=p[s+'Quarters'],ot=p[s+'Overtime'];return Array.isArray(q)&&q.length===4&&Array.isArray(ot)&&[...q,...ot].every(score)&&[...q,...ot].reduce((a,b)=>a+b,0)===p[s+'Score'];}))&&
      d.lineups.every(l=>Array.isArray(l.players));
  }
  async function refresh(req,b,now){
    if(!await serviceAuthorized(req))fail('Se requiere acceso de servicio.',403);
    const d=await input(req,8*1024*1024);
    if(!validate(d,now))fail('Corte de Pick inválido.',422);
    const sha=await hash(JSON.stringify(d));
    const seen=await change(b,key(d.date),prior=>{
      if(prior?.sha===sha)return prior;
      if(prior&&Date.parse(prior.data.readAt)>=Date.parse(d.readAt))fail('Existe un corte igual o posterior.',409);
      return {sha,data:d};
    });
    if(archive){
      const report=await enriched(d,b), finals=new Set(d.finals.map(f=>String(f.gameId)));
      const outcomes={};
      for(const p of report.players){
        for(const r of p.recent){
          if(!finals.has(String(r.gameId))||!(r.minutes_played>0))continue;
          const target=outcomes[r.gameId]??={};
          target[p.playerId]={full:playerValues(r),periods:report.evidence?.[p.playerId]?.[r.gameId]?.periods};
        }
      }
      for(const [id,games] of Object.entries(report.evidence??{}))for(const [gid,g] of Object.entries(games)){
        if(!finals.has(gid))continue;
        const rows=outcomes[gid]??={};
        if(g.state==='DNP · 0 min registrados')rows[id]={dnp:true};
        else if(g.state==='Conflicto')rows[id]={conflict:true};
      }
      await change(b,'nba/prop-results.json',prior=>{
        const next={...(prior??{})};
        for(const [id,rows] of Object.entries(outcomes))next[id]={...next[id],...rows};
        return next;
      });
    }
    // Preserve verified finals after they age out of Pick's bounded history.
    await change(b,'nba/finals.json',old=>{
      const next={...(old??{})};let dirty=false;
      for(const f of d.finals){const prior=next[f.gameId];
        if(!prior||Date.parse(prior.readAt)<Date.parse(d.readAt)){next[f.gameId]={...f,readAt:d.readAt};dirty=true;}}
      return dirty?next:old;
    });
    await change(b,'nba/latest.json',old=>old&&old.date>=d.date?old:{date:d.date});
    const verified=await (await b.get(key(d.date))).json();
    if(verified.sha!==seen.sha||await hash(JSON.stringify(verified.data))!==sha)fail('No se pudo confirmar el corte.',409);
    return reply({ok:true,date:d.date,sha256:sha,readback:'VERIFIED',counts:d.coverage});
  }
  function settle(p,f){
    if(!f||p.home!==f.home||p.away!==f.away||day(p.scheduledAt)!==day(f.scheduledAt))return 'Pendiente';
    const diff=p.market==='total'?f.homeScore+f.awayScore-p.line:
      (p.side==='home'?f.homeScore-f.awayScore:f.awayScore-f.homeScore)+(p.market==='spread'?p.line:0);
    const v=p.side==='under'?-diff:diff;
    return v===0?'Push':v>0?'Acierto':'Fallo';
  }
  async function tracker(req,b,now){
    const user=req.headers.get('oai-authenticated-user-id');
    if(!user||user.length>256)fail('Inicia sesión para usar el tracker.',401);
    const k='nba/tracker/'+await hash(user)+'.json';
    if(req.method==='GET'){
      const rows=await (await b.get(k))?.json()??[], finals=await (await b.get('nba/finals.json'))?.json()??{};
      const outcomes=await (await b.get('nba/prop-results.json'))?.json()??{};
      function result(p){
        if(p.market!=='props')return settle(p,finals[p.gameId]);
        const row=outcomes[p.gameId]?.[p.playerId],val=p.period==='FT'?row?.full?.[p.key]:playerValues(segmentValues(row?.periods?.[p.period]))[p.key];
        if(row?.dnp)return 'Nulo · DNP';
        if(!Number.isFinite(val))return 'Pendiente';
        return val===p.line?'Push':(p.side==='over'?val>p.line:val<p.line)?'Acierto':'Fallo';
      }
      const library=await evidence(b);
      const records=rows.map(p=>{
        const original=Object.hasOwn(p,'pickOriginal')?p.pickOriginal:library?originalFor(p,library.originals):null;
        return {...p,result:result(p),original:original?{model:original.model,id:original.id,side:original.side,result:result({...p,side:original.side,line:original.line})}:null};
      });
      const wins=records.filter(p=>p.result==='Acierto').length,losses=records.filter(p=>p.result==='Fallo').length;
      return reply({records,wins,losses,accuracy:wins+losses?wins/(wins+losses):null});
    }
    if(req.method!=='POST')fail('Método inválido.',405);
    if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('sec-fetch-site')==='cross-site')fail('Origen inválido.',403);
    const p=await input(req,4096);
    if(!p||!gameId(p.gameId)||!['ml','spread','total','props'].includes(p.market)||(p.market==='props'?typeof p.quoteId!=='string':(
      !(p.market==='total'?['over','under']:['home','away']).includes(p.side)||
      (p.market==='ml'?p.line!==null:(!Number.isFinite(p.line)||Math.abs(p.line)>1000||!Number.isInteger(p.line*2)||(p.market==='total'&&p.line<=0))))))fail('Selección inválida.',422);
    const snapshot=await (await b.get(key(day(now))))?.json();
    const f=snapshot?.data.fixtures.find(f=>String(f.id)===String(p.gameId));
    if(!f||f.state!=='scheduled'||Date.parse(f.scheduledAt)<=Date.parse(now)||snapshot.sha!==p.sha)fail('Revisa la jornada y la hora de inicio.',409);
    let prop=null;
    if(p.market==='props'){
      if(!archive)fail('Archivo no disponible.',409);
      const row=rankLines(await enriched(snapshot.data,b)).flat().find(r=>String(r.f.id)===String(f.id)&&r.q.quote_id===p.quoteId&&r.gap10!=null&&scoreComparison(r.q));
      if(!row)fail('Contrato sin referencia comparable.',422);
      prop={quoteId:p.quoteId,playerId:String(row.m.playerId),player:row.player,key:row.key,statistic:row.q.statistic,period:row.period,line:row.line,side:row.side,conditions:row.checks,ruleVersion:'PR-2026-07-30',conditionsVersion:1};
    }
    const library=await evidence(b),pickOriginal=library?originalFor({...p,...prop,recordedAt:now,scheduledAt:f.scheduledAt},library.originals):null;
    await change(b,k,old=>{
      const rows=old??[],prior=rows.find(r=>r.gameId===String(f.id)&&r.market===p.market&&(!prop||(r.playerId===prop.playerId&&r.statistic===prop.statistic&&r.period===prop.period&&r.line===prop.line)));
      if(prior){if(prior.side===(prop?.side??p.side)&&prior.line===(prop?.line??p.line))return old; fail('Ya guardaste ese mercado.',409);}
      return [{gameId:String(f.id),home:f.home.name,away:f.away.name,scheduledAt:f.scheduledAt,market:p.market,side:p.side,line:p.line,...prop,pickOriginal,recordedAt:now,sourceHash:snapshot.sha},...rows];
    });
    return reply({ok:true});
  }
  return async function handle(req,env,now=new Date().toISOString()){
    try{
      const u=new URL(req.url), b=env.BUCKET;
      if(!b)fail('Almacenamiento no disponible.',503);
      if(u.pathname==='/api/nba/evidence'&&req.method==='POST')return await research(req,b,now);
      if(u.pathname==='/api/nba/refresh'&&req.method==='POST')return await refresh(req,b,now);
      if(u.pathname==='/api/nba/tracker')return await tracker(req,b,now);
      if(!['/api/nba/snapshot','/api/nba/status'].includes(u.pathname)||req.method!=='GET')fail('Ruta no disponible.',404);
      const latest=await (await b.get('nba/latest.json'))?.json();
      const date=u.searchParams.get('date')??latest?.date??day(now);
      if(!validDay(date))fail('Fecha inválida.',400);
      const saved=await (await b.get(key(date)))?.json();
      if(!saved)return reply({error:'Aún no hay corte para esta fecha.',latest:latest?.date??null},404);
      const meta={date,sha256:saved.sha,readAt:saved.data.readAt,currentDay:date===day(now),counts:saved.data.coverage};
      if(u.pathname.endsWith('/status'))return reply(meta);
      const analysis=await enriched(saved.data,b);
      const supplemental=analysis===saved.data?null:{finals:analysis.finals,periods:analysis.periods,players:analysis.players,evidence:analysis.evidence,boxGames:analysis.boxGames,archiveSchedule:analysis.archiveSchedule};
      return reply({...meta,data:saved.data,supplemental});
    }catch(e){return reply({error:e.status?e.message:'Almacenamiento temporalmente no disponible.'},e.status??503);}
  };
}
