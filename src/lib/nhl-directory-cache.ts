import 'server-only';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {normalizeNhlDirectory} from './nhl-free';
export function readNhlDirectoryCache(row:{id:string;captured_at:string;body:Record<string,unknown>}|null,now:number){
 if(!row)return null;const age=now-Date.parse(row.captured_at);
 if(!Number.isFinite(age)||age< -5000||age>24*3600000)return null;
 const b=row.body;if(b.http_status!==200||b.encoding!=='gzip/base64'||typeof b.raw!=='string'||typeof b.sha256!=='string')throw Error('NHL_DIRECTORY_CACHE_INVALID');
 const raw=gunzipSync(Buffer.from(b.raw,'base64'),{maxOutputLength:2000000});
 if(createHash('sha256').update(raw).digest('hex')!==b.sha256)throw Error('NHL_DIRECTORY_CACHE_HASH');
 return {id:row.id,directory:normalizeNhlDirectory(JSON.parse(raw.toString('utf8')))};
}
