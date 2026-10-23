import 'server-only';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import {saveEnv} from './tesla-auth';
export const authDirectory=()=>path.join(process.env.ENV_FILE_PATH?path.dirname(process.env.ENV_FILE_PATH):path.join(process.cwd(),'runtime'),'site-auth');
export async function authSettings(){
 const env={...process.env};
 try{const text=await readFile(/* turbopackIgnore: true */process.env.ENV_FILE_PATH||path.join(process.cwd(),'.env.local'),'utf8');for(const key of ['SITE_SESSION_SECRET','TESLA_AUTH_SUBJECT','METRICS_TOKEN','DASHBOARD_READ_TOKEN','JOURNEY_RECORDER_TOKEN','JOURNEY_AUTH_TOKEN']){const match=text.match(new RegExp('^'+key+'=([^\\r\\n]*)','m'));if(match)env[key]=match[1].replace(/^["']|["']$/g,'');}}catch{}
 return env;
}
export async function ensureSessionSecret(){const env=await authSettings();if(env.SITE_SESSION_SECRET&&env.SITE_SESSION_SECRET.length>=43)return env.SITE_SESSION_SECRET;const secret=randomBytes(32).toString('base64url');await saveEnv({SITE_SESSION_SECRET:secret});return secret;}
export type AuthTransaction={nonce:string;verifier:string;origin:string;expires:number};
export async function storeTicket(kind:'oauth'|'handoff',value:object){
 const root=authDirectory();await mkdir(root,{recursive:true,mode:0o700});
 // Remove abandoned ten-minute transactions. Tickets contain no Tesla access tokens.
 for(const name of await readdir(root)){if(!/^(oauth|handoff)-[a-f0-9]{64}\.json$/.test(name))continue;try{const file=path.join(root,name);const saved=JSON.parse(await readFile(file,'utf8'));if(saved.expires<Date.now())await unlink(file);}catch{}}
 const ticket=randomBytes(32).toString('hex');await writeFile(path.join(root,`${kind}-${createHash('sha256').update(ticket).digest('hex')}.json`),JSON.stringify(value),{mode:0o600,flag:'wx'});return ticket;
}
export async function consumeTicket<T extends {expires:number}>(kind:'oauth'|'handoff',ticket:string):Promise<T>{
 if(!/^[a-f0-9]{64}$/.test(ticket))throw Error('Invalid sign-in ticket');
 const file=path.join(authDirectory(),`${kind}-${createHash('sha256').update(ticket).digest('hex')}.json`),claimed=file+'.'+randomBytes(8).toString('hex');
 await rename(file,claimed);try{const data=JSON.parse(await readFile(claimed,'utf8'));if(!Number.isFinite(data.expires)||data.expires<Date.now())throw Error('Sign-in expired');return data;}finally{await unlink(claimed);}
}
