import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {audience,callback,localOrigin,token,saveEnv} from './tesla-auth';
import {oauthConfig,validOAuthState} from './tesla-oauth';
import {authSettings,consumeTicket,storeTicket,type AuthTransaction} from './site-auth';
import {verifyTeslaIdentity,siteOriginAllowed,allowedSiteEmail} from './site-session';
let enrollment:Promise<unknown>=Promise.resolve();
async function allowSubject(sub:string,accessToken:string){
 const env=await authSettings();
 if(env.TESLA_AUTH_SUBJECT){if(env.TESLA_AUTH_SUBJECT!==sub)throw Error('Account not allowed');return;}
 if(!env.TESLA_VIN)throw Error('Vehicle identity not configured');
 const r=await fetch(audience()+'/api/1/vehicles',{headers:{Authorization:'Bearer '+accessToken},cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Could not verify vehicle access');const list=(await r.json()).response;
 if(!Array.isArray(list)||!list.some((v:{vin?:string})=>v.vin===env.TESLA_VIN))throw Error('Account not allowed');
 const work=enrollment.then(async()=>{const latest=await authSettings();if(latest.TESLA_AUTH_SUBJECT&&latest.TESLA_AUTH_SUBJECT!==sub)throw Error('Account not allowed');if(!latest.TESLA_AUTH_SUBJECT)await saveEnv({TESLA_AUTH_SUBJECT:sub});});enrollment=work.catch(()=>{});await work;
}
export async function siteCallback(request:NextRequest){
 const q=request.nextUrl.searchParams,expected=request.cookies.get('tesla_site_state')?.value,state=q.get('state');
 let origin=localOrigin;
 const finish=(url:URL)=>{const r=NextResponse.redirect(url);r.cookies.set('tesla_site_state','',{path:'/api',maxAge:0,httpOnly:true,sameSite:'lax',secure:oauthConfig().secure});r.headers.set('Cache-Control','no-store');r.headers.set('Referrer-Policy','no-referrer');return r;};
 try{
  if(!validOAuthState(expected,state))throw Error('Invalid state');
  const transaction=await consumeTicket<AuthTransaction>('oauth',state!);if(!siteOriginAllowed(transaction.origin,localOrigin))throw Error('Invalid return origin');origin=transaction.origin;
  if(q.has('error')||!q.get('code'))return finish(new URL('/login?error=cancelled',origin));
  const data=await token({grant_type:'authorization_code',client_id:process.env.TESLA_CLIENT_ID!,client_secret:process.env.TESLA_CLIENT_SECRET!,code:q.get('code')!,audience:audience(),redirect_uri:callback,code_verifier:transaction.verifier});
  if(typeof data.id_token!=='string')throw Error('Tesla identity token missing');
  const response=await fetch('https://auth.tesla.com/oauth2/v3/discovery/thirdparty/keys',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Identity keys unavailable');const keys=await response.json();
  const sub=verifyTeslaIdentity(data.id_token,keys.keys,process.env.TESLA_CLIENT_ID!,transaction.nonce);
  const profile=await fetch(audience()+'/api/1/users/me',{headers:{Authorization:'Bearer '+data.access_token},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!profile.ok)return finish(new URL('/login?error=email-unavailable',origin));
  const address=(await profile.json()).response?.email;
  if(typeof address!=='string'||!address.trim())return finish(new URL('/login?error=email-unavailable',origin));
  const email=allowedSiteEmail(address);if(!email)return finish(new URL('/login?error=denied',origin));
  await allowSubject(sub,data.access_token);
  const ticket=await storeTicket('handoff',{sub,email,origin,expires:Date.now()+60000});const complete=new URL('/api/auth/tesla/complete',origin);complete.searchParams.set('ticket',ticket);return finish(complete);
 }catch{return finish(new URL('/login?error=signin',origin));}
}
