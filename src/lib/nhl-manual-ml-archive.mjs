// Read-only join between the shared manual archive and Pick's immutable ledgers.
// This module never calls NHL/DRatings/DFO or writes a forecast, label, or snapshot.
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readNhlResearchPages, NhlResearchReadError} from './nhl-research-reader.mjs';
import {evaluateNhlV6Paired} from './nhl-v6-prospective-validation.mjs';
import {selectNhlV6CircaAsOf} from './nhl-late-v6-core.mjs';
import {buildNhlMoneylineResearch} from './nhl-research-evaluation.mjs';
import {buildNhlManualMlEvaluation, nhlManualMlTime, NHL_MANUAL_ML_REGISTERED_AT} from './nhl-manual-ml-evaluation.mjs';

export const NHL_MANUAL_ML_RESEARCH_VERSION = 'NHL_MANUAL_ML_RESEARCH_V1';
export {NHL_MANUAL_ML_REGISTERED_AT};
export const NHL_MANUAL_ML_INPUT_KEYS = ['manual', 'predictions', 'outcomes', 'early', 'late', 'directories'];
export const NHL_MANUAL_ML_TABLES = [
  {key:'manual', table:'nhl_manual_feature_snapshots_v1', select:'*', time:'inserted_at', order:['event_id','available_as_of'], cap:20000},
  {key:'predictions', table:'nhl_free_predictions_v1', select:'*', time:'created_at', order:['id'], cap:6000},
  {key:'outcomes', table:'nhl_free_outcomes_v1', select:'*', time:'observed_at', order:['id'], cap:6000},
  {key:'early', table:'nhl_challenger_shadow_v1', select:'*', time:'created_at', order:['id'], cap:4000},
  {key:'late', table:'nhl_late_shadow_v6', select:'*', time:'created_at', order:['id'], cap:4000},
];
const time = nhlManualMlTime; // Epoch microseconds; retain database clock precision.
const prob = x => typeof x === 'number' && Number.isFinite(x) && x > 0 && x < 1;
const id = x => typeof x === 'string' && /^nhl:\d{10}$/.test(x);
const positive = x => Number.isSafeInteger(x) && x > 0;
const score = x => Number.isSafeInteger(x) && x >= 0;
const pair = (a,b,tolerance=0.00002) => prob(a) && prob(b) && Math.abs(a+b-1) <= tolerance;
const text = x => typeof x === 'string' && x.length > 0;
const canonical = value => JSON.stringify(value, (_key,item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item);

/** Complete, bounded archive read; separate transactions, never a database-wide snapshot.
 * @param {any} db
 * @param {{cutoff?:string,signal?:AbortSignal}} options
 */
export async function readNhlManualMlArchive(db, {cutoff=new Date().toISOString(), signal}={}) {
  if(time(cutoff) === null) throw new NhlResearchReadError('INVALID_READ_REQUEST','manual-ml');
  const data={cutoff}, evidence=[];
  let cursor=0;
  async function worker() {
    while(cursor<NHL_MANUAL_ML_TABLES.length) {
      const spec=NHL_MANUAL_ML_TABLES[cursor++];
      const result=await readNhlResearchPages(db,spec,{cutoff,signal});
      data[spec.key]=result.rows;
      evidence.push(result.evidence);
    }
  }
  const results=await Promise.allSettled([worker(),worker(),worker()]);
  const failure=results.find(result=>result.status==='rejected');
  if(failure) throw failure.reason;
  const directoryIds=[...new Set(data.predictions.map(row=>row.body?.directorySourceId).filter(text))].sort();
  data.directories=[];
  for(let offset=0;offset<directoryIds.length;offset+=50) {
    const ids=directoryIds.slice(offset,offset+50);
    const result=await readNhlResearchPages(db,{table:'nhl_free_source_v1',select:'id,captured_at,source_url,body',time:'captured_at',order:['id'],cap:50,ids},{cutoff,signal});
    // Missing source IDs remain explicit exclusions in the adapter, not invented identities.
    data.directories.push(...result.rows);
    evidence.push({...result.evidence,requestedDirectoryIds:ids.length});
  }
  data.readEvidence={complete:true,cutoff,tables:evidence.sort((a,b)=>a.table.localeCompare(b.table)),
    consistency:'Fixed capture cutoff and stable exact counts per page; separate read transactions.',
    readOnly:true,providerCalls:0,databaseWrites:0};
  return data;
}

/** Validates archived directory bytes; never guesses an NHL ID from a team name. */
function directoryIndex(rows, cutoff, exclude) {
  const grouped=new Map(), result=new Map();
  for(const row of rows) {
    if(time(row?.captured_at)!==null && time(row.captured_at)>cutoff) continue;
    if(!text(row?.id)) {exclude('directories',null,'DIRECTORY_ID_MISSING');continue;}
    grouped.set(row.id,[...(grouped.get(row.id)??[]),row]);
  }
  for(const [key,values] of grouped) {
    if(new Set(values.map(canonical)).size!==1) {exclude('directories',null,'DIRECTORY_CONFLICT',key);continue;}
    const row=values[0], b=row.body;
    try {
      if(time(row.captured_at)===null || row.source_url!=='https://api.nhle.com/stats/rest/en/team' ||
        b?.http_status!==200 || b.encoding!=='gzip/base64' || b.error || b.access_denied!==false ||
        typeof b.raw!=='string' || !/^[a-f0-9]{64}$/.test(b.sha256??'')) throw Error('DIRECTORY_SOURCE_INVALID');
      const raw=gunzipSync(Buffer.from(b.raw,'base64'),{maxOutputLength:2000000});
      if(createHash('sha256').update(raw).digest('hex')!==b.sha256) throw Error('DIRECTORY_HASH_MISMATCH');
      const decoded=JSON.parse(raw.toString('utf8')), teams=new Map();
      if(!Array.isArray(decoded.data) || !decoded.data.length) throw Error('DIRECTORY_SCHEMA_INVALID');
      for(const team of decoded.data) {
        if(!positive(team.id) || !text(team.fullName) || !/^[A-Z]{2,3}$/.test(team.triCode??'') || teams.has(team.id)) throw Error('DIRECTORY_TEAM_INVALID');
        teams.set(team.id,{name:team.fullName,abbrev:team.triCode});
      }
      result.set(key,{teams,capturedAt:row.captured_at});
    } catch(error) {exclude('directories',null,String(error.message??'DIRECTORY_INVALID'),key);}
  }
  return result;
}

/** Normalize stored decisions; source-specific guards supplement the reusable pure evaluator. */
export function normalizeNhlManualMlArchive(input, {cutoff=input.cutoff}={}) {
  const end=time(cutoff), exclusions=[];
  const exclude=(source,eventId,reason,sourceId=null)=>exclusions.push({source,eventId:eventId??null,reason,sourceId});
  if(end===null || NHL_MANUAL_ML_INPUT_KEYS.some(key=>!Array.isArray(input[key])))
    return {status:'READ_UNAVAILABLE',strictDecisions:[],lateDecisions:[],outcomes:[],exclusions};
  const directories=directoryIndex(input.directories,end,exclude);
  function unique(rows,source,clock) {
    const groups=new Map(), valid=new Map();
    for(const row of rows) {
      const event=row?.event_id, observed=time(row?.[clock]);
      if(!id(event)) {exclude(source,event,'INVALID_EVENT_ID');continue;}
      if(observed===null) {exclude(source,event,'INVALID_CAPTURE_TIMESTAMP');continue;}
      if(observed>end || (time(row.created_at)!==null && time(row.created_at)>end)) {exclude(source,event,'AFTER_REPORT_CUTOFF');continue;}
      groups.set(event,[...(groups.get(event)??[]),row]);
    }
    for(const [event,values] of groups) {
      if(new Set(values.map(canonical)).size!==1) {exclude(source,event,'CONFLICTING_DUPLICATE_EVENT');continue;}
      valid.set(event,values[0]);
      if(values.length>1) exclude(source,event,'IDENTICAL_DUPLICATE_IGNORED');
    }
    return valid;
  }
  const originals=unique(input.predictions,'predictions','created_at'), accepted=new Map();
  const strictDecisions=[];
  for(const [event,row] of originals) {
    const b=row.body??{}, captured=time(b.capturedAt), scheduled=time(b.scheduledAt);
    if(b.eventId!==event || b.model!=='DRATINGS_PUBLIC_V1' || row.id!==`DRATINGS_PUBLIC_ARGMAX_V1:${event}` || b.id!==row.id ||
      captured===null || scheduled===null || captured!==time(row.created_at) || captured>=scheduled ||
      scheduled!==time(row.scheduled_at) || !positive(b.homeId) || !positive(b.awayId) || b.homeId===b.awayId ||
      !pair(b.homeProbability,b.awayProbability,0.002) || !text(row.source_id)) {
      exclude('predictions',event,'INVALID_ORIGINAL_DRATINGS_CONTRACT');continue;
    }
    const directory=directories.get(b.directorySourceId), home=directory?.teams.get(b.homeId), away=directory?.teams.get(b.awayId);
    if(!directory || time(directory.capturedAt)>captured || !home || !away || home.abbrev===away.abbrev || home.name!==b.home || away.name!==b.away) {
      exclude('predictions',event,'ORIGINAL_TEAM_DIRECTORY_NOT_VERIFIED',b.directorySourceId??null);continue;
    }
    const decision={eventId:event,decisionId:row.id,modelVersion:b.model,forecastAt:b.capturedAt,persistedAt:row.created_at,
      originalForecastAt:b.capturedAt,originalPersistedAt:row.created_at,scheduledAt:b.scheduledAt,
      homeTeamId:b.homeId,awayTeamId:b.awayId,homeAbbrev:home.abbrev,awayAbbrev:away.abbrev,
      homeProbability:b.homeProbability,awayProbability:b.awayProbability,referenceSourceId:row.source_id,
      identityVerified:true,identitySourceId:b.directorySourceId,identityCapturedAt:directory.capturedAt,
      anchorType:'STRICT_ORIGINAL',comparators:[]};
    accepted.set(event,{row,decision});strictDecisions.push(decision);
  }
  const outcomes=[], seenOutcomes=new Set();
  // Preserve result versions. A later correction must not erase a label that
  // was available to an earlier training decision. The evaluator resolves
  // conflicts separately at each decision and at the final report cutoff.
  for(const row of input.outcomes) {
    const event=row?.event_id, observedAt=time(row?.observed_at);
    if(!id(event) || observedAt===null) {exclude('outcomes',event,'INVALID_FINAL_CONTRACT');continue;}
    const persisted=row.created_at==null?observedAt:time(row.created_at);
    if(persisted===null || persisted<observedAt) {exclude('outcomes',event,'INVALID_FINAL_PERSISTENCE');continue;}
    if(observedAt>end || persisted>end) {exclude('outcomes',event,'AFTER_REPORT_CUTOFF');continue;}
    const signature=canonical(row);
    if(seenOutcomes.has(signature)) {exclude('outcomes',event,'IDENTICAL_DUPLICATE_IGNORED');continue;}
    seenOutcomes.add(signature);
    const b=row.body??{}, observed=time(row.observed_at), scheduled=time(b.scheduledAt);
    if(b.eventId!==event || scheduled===null || observed<=scheduled || observed!==time(b.capturedAt) ||
      !positive(b.homeId) || !positive(b.awayId) || b.homeId===b.awayId || !score(b.homeScore) || !score(b.awayScore) ||
      b.homeScore===b.awayScore || !text(row.source_id)) {exclude('outcomes',event,'INVALID_FINAL_CONTRACT');continue;}
    const d=accepted.get(event)?.decision;
    if(!d || time(d.scheduledAt)!==scheduled || d.homeTeamId!==b.homeId || d.awayTeamId!==b.awayId) {
      exclude('outcomes',event,'FINAL_ORIGINAL_IDENTITY_MISMATCH');continue;
    }
    outcomes.push({eventId:event,scheduledAt:b.scheduledAt,observedAt:row.observed_at,homeTeamId:b.homeId,awayTeamId:b.awayId,
      homeAbbrev:d.homeAbbrev,awayAbbrev:d.awayAbbrev,homeScore:b.homeScore,awayScore:b.awayScore,final:true,
      ...(row.created_at==null?{}:{persistedAt:row.created_at}),sourceId:row.source_id,settlementContract:'OFFICIAL_FINAL_INCLUDES_OT_SO'});
  }
  const lateDecisions=[];
  for(const [event,row] of unique(input.late,'late','created_at')) {
    const checked=evaluateNhlV6Paired({frozenRows:[row],finalRows:[]});
    const frozen=time(row.frozen_at), stored=time(row.created_at), scheduled=time(row.scheduled_at), original=accepted.get(event), cal=row.calibration;
    const completed=time(row.source_completed_at), goalieObserved=time(row.goalie_evidence?.observedAt), quoteObserved=time(cal?.circaPrice?.capturedAt);
    if(checked.invalid || checked.status==='UNAVAILABLE' || row.status!=='FROZEN_RESEARCH' ||
      row.id!==`NHL_LATE_PROBABLE_CALIBRATION_SHADOW_V6:${event}` || frozen===null || scheduled===null || stored===null ||
      frozen>end || stored<frozen || stored>=scheduled || stored-frozen>5*60*1000000 ||
      scheduled-frozen<60*60*1000000 || scheduled-frozen>8*60*60*1000000 ||
      completed===null || completed>frozen || frozen-completed>45*60*1000000 ||
      goalieObserved===null || goalieObserved>frozen || frozen-goalieObserved>45*60*1000000 ||
      (cal?.circaPrice && (quoteObserved===null || quoteObserved>frozen || frozen-quoteObserved>40*60*1000000 || scheduled-quoteObserved<60*60*1000000)) ||
      !positive(row.home_team_id) || !positive(row.away_team_id) || !/^[a-f0-9]{64}$/.test(row.source_hash??'')) {
      exclude('late',event,'INVALID_LATE_ANCHOR_CONTRACT');continue;
    }
    const d=original?.decision;
    if(!d || time(d.scheduledAt)!==scheduled || d.homeTeamId!==row.home_team_id || d.awayTeamId!==row.away_team_id ||
      time(d.originalForecastAt)>frozen || time(d.persistedAt)!==time(cal?.dratingsOriginalObservedAt) ||
      !prob(cal?.originalDratingsHome) || Math.abs(d.homeProbability-cal.originalDratingsHome)>1e-7) {
      exclude('late',event,'ORIGINAL_DRATINGS_PROVENANCE_NOT_VERIFIED');continue;
    }
    const comparators=[], q=cal.circaPrice;
    if(q) {
      const verified=selectNhlV6CircaAsOf({game:{eventId:event,scheduledAt:row.scheduled_at,homeId:row.home_team_id,awayId:row.away_team_id},decisionAt:row.frozen_at,
        quotes:[{id:q.observationId,captured_at:q.capturedAt,body:{eventId:q.eventId,scheduledAt:row.scheduled_at,homeId:row.home_team_id,awayId:row.away_team_id,
          sportsbook:q.bookmaker,capturedAt:q.capturedAt,homeOdds:q.homeOdds,awayOdds:q.awayOdds}}]});
      if(verified.status==='CIRCA_PREGAME_RESEARCH_ONLY' && pair(q.homeNoVig,q.awayNoVig) && Math.abs(verified.homeNoVig-q.homeNoVig)<=1e-5) {
        comparators.push({id:'circaNoVig',label:'Circa sin margen archivada',homeProbability:q.homeNoVig,awayProbability:q.awayNoVig,availableAt:q.capturedAt,sourceId:q.observationId});
      } else exclude('comparators',event,'FROZEN_CIRCA_PRICE_PAIR_INCONSISTENT');
    }
    const p=row.market_proxies;
    if(pair(p?.homeMoneylineProxy,p?.awayMoneylineProxy)) comparators.push({id:'poisson',label:'Poisson tardío: proxy con empate repartido 50/50',
      homeProbability:p.homeMoneylineProxy,awayProbability:p.awayMoneylineProxy,availableAt:row.frozen_at,sourceId:row.id});
    if(cal.status==='PROSPECTIVE_TEST_ONLY' && pair(cal.candidateHome,cal.candidateAway) && comparators.some(x=>x.id==='circaNoVig')) {
      comparators.push({id:'v6',label:'V6 experimental archivado',homeProbability:cal.candidateHome,awayProbability:cal.candidateAway,availableAt:row.frozen_at,sourceId:row.id});
    }
    lateDecisions.push({...d,decisionId:row.id,forecastAt:row.frozen_at,persistedAt:row.created_at,anchorType:'LATE_RESEARCH_ANCHOR',comparators,
      anchorModelVersion:row.model_version,anchorSourceHash:row.source_hash});
  }
  const order=(a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.eventId.localeCompare(b.eventId);
  return {status:'NORMALIZED_READ_ONLY_ARCHIVE',strictDecisions:strictDecisions.sort(order),lateDecisions:lateDecisions.sort(order),
    outcomes:outcomes.sort((a,b)=>order(a,b)||time(a.observedAt)-time(b.observedAt)),exclusions:exclusions.sort((a,b)=>a.source.localeCompare(b.source)||String(a.eventId).localeCompare(String(b.eventId))||a.reason.localeCompare(b.reason)),
    identitySourcesVerified:directories.size};
}

function joinInventory(input, normalized, cutoff) {
  const end=time(cutoff), groups=new Map();
  for(const row of input.manual) {
    if(!id(row?.event_id) || time(row.available_as_of)===null || time(row.inserted_at)===null || time(row.available_as_of)>end || time(row.inserted_at)>end) continue;
    groups.set(row.event_id,[...(groups.get(row.event_id)??[]),row]);
  }
  const strict=new Map(normalized.strictDecisions.map(row=>[row.eventId,row])), late=new Map(normalized.lateDecisions.map(row=>[row.eventId,row]));
  const finalVersions=new Map();
  for(const row of normalized.outcomes) finalVersions.set(row.eventId,[...(finalVersions.get(row.eventId)??[]),row]);
  const conflicts=new Set([...finalVersions].filter(([,rows])=>new Set(rows.map(row=>canonical([time(row.scheduledAt),row.homeTeamId,row.awayTeamId,row.homeScore,row.awayScore]))).size>1).map(([event])=>event));
  const finals=new Set([...finalVersions.keys()].filter(event=>!conflicts.has(event)));
  const perGame=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([eventId,rows])=>{
    rows.sort((a,b)=>time(a.available_as_of)-time(b.available_as_of));
    const before=at=>time(at)!==null && rows.some(row=>time(row.available_as_of)<=time(at) && time(row.inserted_at)<=time(at));
    const early=input.early.filter(row=>row.event_id===eventId && time(row.created_at)!==null && time(row.created_at)<=end && time(row.frozen_at)!==null && time(row.created_at)<time(row.scheduled_at));
    return {eventId,snapshots:rows.length,scheduledAt:rows[0].scheduled_at,firstAvailableAt:rows[0].available_as_of,lastAvailableAt:rows.at(-1).available_as_of,
      distinctTeamPayloads:new Set(rows.map(row=>canonical(row.feature_payload?.teams))).size,
      originalForecastAt:strict.get(eventId)?.forecastAt??null,lateAnchorAt:late.get(eventId)?.forecastAt??null,
      availableAtOriginal:before(strict.get(eventId)?.forecastAt),availableAtEarly:early.some(row=>before(row.frozen_at)),
      availableAtLate:before(late.get(eventId)?.forecastAt),finalAvailable:finals.has(eventId),conflictingFinals:conflicts.has(eventId)};
  });
  return {snapshotRows:[...groups.values()].reduce((n,rows)=>n+rows.length,0),uniqueGames:groups.size,
    sourceRuns:new Set([...groups.values()].flat().map(row=>row.source_run_id)).size,
    sameValuesAcrossUpdates:perGame.every(row=>row.distinctTeamPayloads===1),
    manualAvailableAtOriginal:perGame.filter(row=>row.availableAtOriginal).length,
    manualAvailableAtEarly:perGame.filter(row=>row.availableAtEarly).length,
    manualAvailableAtLate:perGame.filter(row=>row.availableAtLate).length,
    manualGamesWithFinal:perGame.filter(row=>row.finalAvailable).length,manualGamesWithConflictingFinals:perGame.filter(row=>row.conflictingFinals).length,perGame,
    availabilityOnly:true,warning:'These counts describe temporal joins. Per-variable semantic and provenance guards apply separately.'};
}

/** Public report with two explicit anchors; no mixing of their denominators. */
export function buildNhlManualMlResearch(input={}, {cutoff=input.cutoff??new Date().toISOString()}={}) {
  if(time(cutoff)===null || NHL_MANUAL_ML_INPUT_KEYS.some(key=>!Array.isArray(input[key])) ||
    input.readEvidence?.complete!==true || time(input.readEvidence.cutoff)!==time(cutoff)) {
    return {version:NHL_MANUAL_ML_RESEARCH_VERSION,status:'READ_UNAVAILABLE',cutoff,readOnly:true,providerCalls:0,databaseWrites:0,
      predictionAdjustment:false,modelPromoted:false,warnings:['Complete archived inputs at a common cutoff are required; no partial-cohort metrics are published.']};
  }
  const normalized=normalizeNhlManualMlArchive(input,{cutoff});
  const common={snapshots:input.manual,outcomes:normalized.outcomes,cutoff};
  const strictOriginal=buildNhlManualMlEvaluation({...common,decisions:normalized.strictDecisions,
    policy:{anchorType:'STRICT_ORIGINAL',label:'DRatings en su congelación original',registeredAt:NHL_MANUAL_ML_REGISTERED_AT}});
  const lateResearchAnchor=buildNhlManualMlEvaluation({...common,decisions:normalized.lateDecisions,
    policy:{anchorType:'LATE_RESEARCH_ANCHOR',label:'DRatings conservado al corte real de V6',registeredAt:NHL_MANUAL_ML_REGISTERED_AT}});
  const archived=buildNhlMoneylineResearch({...input,cutoff});
  return {version:NHL_MANUAL_ML_RESEARCH_VERSION,status:lateResearchAnchor.status,cutoff,timezone:'America/Puerto_Rico',
    registeredAt:NHL_MANUAL_ML_REGISTERED_AT,readOnly:true,providerCalls:0,databaseWrites:0,predictionAdjustment:false,
    modelPromoted:false,officialPick:false,prospectiveCandidateForecastsIssued:0,
    target:{market:'FULL_GAME_MONEYLINE',outcome:'OFFICIAL_FINAL_WINNER_INCLUDING_OT_SO',probability:'HOME_WIN',expectedValue:null},
    activeModel:{id:'DRATINGS_PUBLIC_ARGMAX_V1',probabilityContract:'DRATINGS_PUBLIC_V1',internalProviderFeaturesKnown:false,
      researchBaseline:'FIRST_IMMUTABLE_ORIGINAL',dashboardMayShowLaterDratingsObservation:true},
    joinCoverage:joinInventory(input,normalized,cutoff),strictOriginal,lateResearchAnchor,
    historicalContext:{manualFeatureEffectEvaluated:false,cohorts:archived.cohorts,comparisons:archived.comparisons,
      pairedDifferences:archived.pairedDifferences,calibration:archived.calibration,
      warning:'Existing frozen-model results use older games without manual snapshots. They cannot establish incremental manual-feature value; model information times differ.'},
    adapter:{identitySourcesVerified:normalized.identitySourcesVerified,exclusions:normalized.exclusions},readEvidence:input.readEvidence,
    limitations:[
      'Manual availability is the database server insertion clock. Source-generated timestamps and recovered historical game dates do not backdate availability.',
      'Original DRatings and final-result clocks follow existing immutable ledger contracts. They are not independently reverified provider receipt timestamps in this report.',
      'Late research carries forward the original DRatings probability at an existing V6 anchor. This is a separate as-of replay, not a new DRatings forecast or an issued candidate forecast.',
      'The live dashboard may display a later DRatings observation from the latest run or quote snapshot. This study benchmarks the first archived original used by history, not necessarily that later same-time probability.',
      'The frozen V6 anchor requires ESPN probable coverage and a pregame window. Its selected cohort may not represent all NHL games.',
      'Poisson moneyline is an archived proxy splitting equal-score mass 50/50; the label is the full official winner including OT/SO. Regulation is not scored as full-game moneyline.',
      'Manual source_snapshot_sha256 identifies the original full panel dataset, not feature_payload bytes. Export hashes establish this report input integrity only.',
      'No independently validated betting edge, ROI, or promotion is inferred. Bookmaker publication time and exact contract remain unverified.',
    ]};
}
