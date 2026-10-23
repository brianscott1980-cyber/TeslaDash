import {createHmac,createPublicKey,timingSafeEqual,verify} from 'node:crypto';
// Temporary owner-only policy: exact addresses, without Gmail alias expansion.
const allowedEmails=new Set(['brianscott1980@googlemail.com','brianscott1980@gmail.com']);
export function allowedSiteEmail(value:unknown):string|null{
 if(typeof value!=='string')return null;
 const email=value.trim().toLowerCase();return allowedEmails.has(email)?email:null;
}
export const sessionCookie='volt_session';
export const sessionSeconds=7*24*3600;
export function equalSecret(a:string,b:string){return a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
export function machineReadAccess(path:string,method:string,authorization:string|null,env:Record<string,string|undefined>){
 if(!authorization)return false;
 if(method==='POST'&&path==='/api/journeys/poll'&&env.JOURNEY_RECORDER_TOKEN&&equalSecret(authorization,'Bearer '+env.JOURNEY_RECORDER_TOKEN))return true;
 if(method==='POST'&&path==='/api/journeys/credentials'&&env.JOURNEY_AUTH_TOKEN&&equalSecret(authorization,'Bearer '+env.JOURNEY_AUTH_TOKEN))return true;
 if(method!=='GET')return false;
 if(path==='/api/metrics'&&env.METRICS_TOKEN&&equalSecret(authorization,'Bearer '+env.METRICS_TOKEN))return true;
 return !!env.DASHBOARD_READ_TOKEN&&['/api/dashboard','/api/charging-history','/api/recording','/api/metrics','/api/journeys'].includes(path)&&equalSecret(authorization,'Bearer '+env.DASHBOARD_READ_TOKEN);
}
export function signSession(sub:string,secret:string,now=Date.now(),email?:string){
 const permittedEmail=allowedSiteEmail(email);
 if(secret.length<43||!sub||!permittedEmail)throw Error('Missing or unauthorized session identity');
 const body=Buffer.from(JSON.stringify({sub,email:permittedEmail,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+sessionSeconds})).toString('base64url');
 return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
export function readSession(value:string|undefined,secret:string|undefined,allowedSub:string|undefined,now=Date.now()):{sub:string}|null{
 try{if(!value||!secret||secret.length<43||!allowedSub)return null;const [body,signature,...extra]=value.split('.');if(extra.length||!body||!signature)return null;
  const expected=createHmac('sha256',secret).update(body).digest('base64url');if(!equalSecret(expected,signature))return null;
  const claim=JSON.parse(Buffer.from(body,'base64url').toString());const seconds=Math.floor(now/1000);
  if(claim.sub!==allowedSub||!allowedSiteEmail(claim.email)||!Number.isFinite(claim.iat)||!Number.isFinite(claim.exp)||claim.iat>seconds+30||claim.exp<=seconds||claim.exp-claim.iat!==sessionSeconds)return null;return {sub:claim.sub};
 }catch{return null;}
}
export function verifyTeslaIdentity(jwt:string,keys:JsonWebKey[],clientId:string,nonce:string,now=Date.now()):string{
 const parts=jwt.split('.');if(parts.length!==3)throw Error('Invalid identity token');
 const header=JSON.parse(Buffer.from(parts[0],'base64url').toString());
 if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error('Unsupported identity signature');
 const jwk=keys.find(k=>(k as JsonWebKey&{kid?:string;use?:string}).kid===header.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig')&&(!k.alg||k.alg==='RS256'));
 if(!jwk||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk as import('node:crypto').JsonWebKey,format:'jwk'}),Buffer.from(parts[2],'base64url')))throw Error('Invalid identity signature');
 const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString()),seconds=Math.floor(now/1000);
 const audience=Array.isArray(claims.aud)?claims.aud:[claims.aud];
 if(claims.iss!=='https://auth.tesla.com/oauth2/v3/nts'||!audience.includes(clientId)||(audience.length>1&&claims.azp!==clientId)||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>512||claims.nonce!==nonce||!Number.isFinite(claims.exp)||claims.exp<=seconds||!Number.isFinite(claims.iat)||claims.iat>seconds+30)throw Error('Invalid identity claims');
 return claims.sub;
}
export function siteOriginAllowed(origin:string,configured:string,additional=process.env.SITE_ALLOWED_ORIGINS??'http://192.168.0.102:3000,http://127.0.0.1:3000'){
 return [configured,...additional.split(',').map(x=>x.trim())].includes(origin);
}
export function requestSiteOrigin(request:Request,configured:string,additional=process.env.SITE_ALLOWED_ORIGINS??'http://192.168.0.102:3000,http://127.0.0.1:3000'){
 // Next's internal URL can use the 0.0.0.0 bind address. Match the HTTP Host
 // against explicit origins rather than trusting forwarded headers or that URL.
 const host=request.headers.get('host')??new URL(request.url).host;
 const origin=[configured,...additional.split(',').map(x=>x.trim())].find(value=>{try{return new URL(value).host===host}catch{return false}});
 if(!origin)throw Error('Unknown dashboard host');return origin;
}
