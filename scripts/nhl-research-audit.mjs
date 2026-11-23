#!/usr/bin/env node
// Offline by default; --live reads only the existing Supabase archive, never providers.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildNhlResearchAudit,NHL_RESEARCH_REGISTRATION_CUTOFF} from '../src/lib/nhl-research-audit.mjs';
import {readNhlResearchArchive} from '../src/lib/nhl-research-reader.mjs';

const args=process.argv.slice(2),arg=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const output=arg('--output');
const keys=['contexts','predictions','outcomes','early','late','goalies','specialTeams','quotes','runs','matchups','sources','sourceMetadata','diagnostics'];
if(!output)throw Error('Use --input <export directory> --output <report.json>; or --live --output <report.json>.');
let data,cutoff=arg('--cutoff')??NHL_RESEARCH_REGISTRATION_CUTOFF;
if(args.includes('--live')) {
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Supabase server environment is required; credentials are never printed.');
  const {createClient}=await import('@supabase/supabase-js');
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  cutoff=arg('--cutoff')??new Date().toISOString();
  data=await readNhlResearchArchive(db,{cutoff,signal:AbortSignal.timeout(40000)});
  const exportDir=arg('--export-input');
  if(exportDir){
    await fs.mkdir(exportDir,{recursive:true});const files={};
    for(const key of keys){
      const bytes=JSON.stringify(data[key],null,2)+'\n';
      await fs.writeFile(path.join(exportDir,key+'.json'),bytes);
      files[key]={rows:data[key].length,sha256:createHash('sha256').update(bytes).digest('hex')};
    }
    await fs.writeFile(path.join(exportDir,'manifest.json'),JSON.stringify({cutoff,complete:true,files,readEvidence:data.readEvidence},null,2)+'\n');
  }
} else {
  const dir=arg('--input');if(!dir)throw Error('An archived export directory is required for offline research.');
  const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
  if(manifest.complete!==true||!Number.isFinite(Date.parse(manifest.cutoff)))throw Error('Unverified export manifest.');
  cutoff=arg('--cutoff')??manifest.cutoff;
  if(Date.parse(cutoff)!==Date.parse(manifest.cutoff))throw Error('The requested cutoff must match the immutable export manifest.');
  data={cutoff};const hashes={};
  for(const key of keys) {
    const file=await fs.readFile(path.join(dir,key+'.json'));data[key]=JSON.parse(file);hashes[key]=createHash('sha256').update(file).digest('hex');
    if(!Array.isArray(data[key])||data[key].length!==manifest.files?.[key]?.rows||hashes[key]!==manifest.files?.[key]?.sha256)
      throw Error('Export integrity mismatch: '+key);
  }
  data.readEvidence={complete:true,mode:'OFFLINE_EXPORTED_ARCHIVE',cutoff,sha256:hashes,sourceReadEvidence:manifest.readEvidence??null};
}
const report=buildNhlResearchAudit(data,{cutoff,includeNormalized:args.includes('--include-normalized')});
await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true});
await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,cutoff,output,independentFourWayGames:report.moneyline?.cohorts?.fourWay?.games??null,providerCalls:0,databaseWrites:0}));
