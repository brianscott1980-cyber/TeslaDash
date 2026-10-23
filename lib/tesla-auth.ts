import 'server-only';
import {readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {oauthConfig,sameOriginPost} from './tesla-oauth';
export const localOrigin=oauthConfig().origin;
export const callback=oauthConfig().callback;
export function audience(){return process.env.TESLA_REGION==='na'?'https://fleet-api.prd.na.vn.cloud.tesla.com':'https://fleet-api.prd.eu.vn.cloud.tesla.com';}
// Next can load this module separately for different route bundles. Share locks
// across those bundles so dashboard reads and the worker cannot rotate twice.
const locks=globalThis as typeof globalThis&{teslaEnvWriting?:Promise<unknown>;teslaRefreshing?:Promise<string>};
export function saveEnv(values:Record<string,string>){
 const work=(locks.teslaEnvWriting??Promise.resolve()).then(()=>writeEnv(values));locks.teslaEnvWriting=work.catch(()=>{});return work;
}
async function writeEnv(values:Record<string,string>){
 const file=process.env.ENV_FILE_PATH||path.join(process.cwd(),'.env.local');let content='';try{content=await readFile(/* turbopackIgnore: true */file,'utf8')}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 for(const[k,v]of Object.entries(values)){if(!/^[A-Z_]+$/.test(k)||/[\r\n]/.test(v))throw Error('Invalid environment entry');const re=new RegExp('^'+k+'=[^\\r\\n]*','m');content=re.test(content)?content.replace(re,()=>k+'='+v):content+'\n'+k+'='+v+'\n';}
 await writeFile(file+'.tmp',content,{mode:0o600});await rename(file+'.tmp',file);Object.assign(process.env,values);
}
export async function token(body:Record<string,string>){
 const r=await fetch('https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error(`Tesla authentication failed (HTTP ${r.status}). Check client settings and enabled scopes.`);
 const data=await r.json();if(typeof data.access_token!=='string')throw Error('Tesla did not return an access token');return data;
}
export async function saveTokens(data:{access_token:string;refresh_token?:string;expires_in?:number}){if(!data.access_token||!Number.isFinite(data.expires_in??3600)||(data.expires_in??3600)<=0)throw Error('Invalid Tesla token response');const values:Record<string,string>={TESLA_ACCESS_TOKEN:data.access_token,TESLA_TOKEN_EXPIRES_AT:String(Date.now()+(data.expires_in??3600)*1000)};if(data.refresh_token)values.TESLA_REFRESH_TOKEN=data.refresh_token;await saveEnv(values);}
export async function accessToken(){
 const e=process.env;
 if(!e.TESLA_REFRESH_TOKEN||Number(e.TESLA_TOKEN_EXPIRES_AT||Infinity)>Date.now()+60000)return e.TESLA_ACCESS_TOKEN;
 if(!locks.teslaRefreshing)locks.teslaRefreshing=(async()=>{const data=await token({grant_type:'refresh_token',client_id:e.TESLA_CLIENT_ID!,refresh_token:e.TESLA_REFRESH_TOKEN!});await saveTokens(data);return data.access_token as string;})().finally(()=>{locks.teslaRefreshing=undefined});
 return locks.teslaRefreshing;
}
export function isLocalPost(request:Request){return sameOriginPost(request,localOrigin);}
