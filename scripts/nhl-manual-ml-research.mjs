#!/usr/bin/env node
// Offline by default. --live performs SELECTs on existing Supabase tables only.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildNhlManualMlResearch,readNhlManualMlArchive,NHL_MANUAL_ML_INPUT_KEYS} from '../src/lib/nhl-manual-ml-archive.mjs';
import {nhlManualMlTime} from '../src/lib/nhl-manual-ml-evaluation.mjs';

const args=process.argv.slice(2), value=key=>{const i=args.indexOf(key);return i<0?null:args[i+1];};
const output=value('--output');
if(!output) throw Error('Use --input <export directory> --output <report.json>; or --live --output <report.json>.');
if(args.includes('--live') && value('--input')) throw Error('Choose either --input or --live, not both.');
let data, cutoff=value('--cutoff');
if(args.includes('--live')) {
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Existing Supabase server credentials are required; they are never printed.');
  const {createClient}=await import('@supabase/supabase-js');
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  cutoff=cutoff??new Date().toISOString();
  data=await readNhlManualMlArchive(db,{cutoff,signal:AbortSignal.timeout(40000)});
  const destination=value('--export-input');
  if(destination) {
    await fs.mkdir(destination,{recursive:true});
    const files={};
    for(const key of NHL_MANUAL_ML_INPUT_KEYS) {
      const bytes=JSON.stringify(data[key],null,2)+'\n';
      await fs.writeFile(path.join(destination,key+'.json'),bytes,{flag:'wx'});
      files[key]={rows:data[key].length,sha256:createHash('sha256').update(bytes).digest('hex')};
    }
    await fs.writeFile(path.join(destination,'manifest.json'),JSON.stringify({cutoff,complete:true,files,readEvidence:data.readEvidence},null,2)+'\n',{flag:'wx'});
  }
} else {
  const directory=value('--input');
  if(!directory) throw Error('An immutable input export is required for offline research.');
  const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
  if(manifest.complete!==true || nhlManualMlTime(manifest.cutoff)===null) throw Error('Unverified export manifest.');
  cutoff=cutoff??manifest.cutoff;
  if(nhlManualMlTime(cutoff)!==nhlManualMlTime(manifest.cutoff)) throw Error('Cutoff must match the immutable export manifest.');
  data={cutoff};
  const hashes={};
  for(const key of NHL_MANUAL_ML_INPUT_KEYS) {
    const bytes=await fs.readFile(path.join(directory,key+'.json'));
    data[key]=JSON.parse(bytes);hashes[key]=createHash('sha256').update(bytes).digest('hex');
    if(!Array.isArray(data[key]) || data[key].length!==manifest.files?.[key]?.rows || hashes[key]!==manifest.files?.[key]?.sha256) throw Error('Export integrity mismatch: '+key);
  }
  data.readEvidence={complete:true,cutoff,mode:'OFFLINE_EXPORTED_ARCHIVE',sha256:hashes,sourceReadEvidence:manifest.readEvidence??null};
}
const report=buildNhlManualMlResearch(data,{cutoff});
if(report.status==='READ_UNAVAILABLE') throw Error('Report inputs unavailable; no partial report written.');
await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true});
await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
const exclusionsOutput=value('--exclusions-output');
if(exclusionsOutput) {
  const records=[...report.adapter.exclusions.map(row=>({anchor:'adapter',...row})),
    ...['strictOriginal','lateResearchAnchor'].flatMap(anchor=>report[anchor].exclusions.map(row=>({anchor,...row})))];
  await fs.mkdir(path.dirname(path.resolve(exclusionsOutput)),{recursive:true});
  await fs.writeFile(exclusionsOutput,JSON.stringify(records,null,2)+'\n');
}
console.log(JSON.stringify({status:report.status,cutoff,output,manualGames:report.joinCoverage.uniqueGames,
  strictOriginal:report.joinCoverage.manualAvailableAtOriginal,lateAnchored:report.joinCoverage.manualAvailableAtLate,
  settledManual:report.joinCoverage.manualGamesWithFinal,providerCalls:0,databaseWrites:0}));
