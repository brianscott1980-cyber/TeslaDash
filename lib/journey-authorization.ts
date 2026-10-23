import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {audience,callback,localOrigin,token,saveTokens} from './tesla-auth';
import {consumeTicket,authSettings,type AuthTransaction} from './site-auth';
import {validOAuthState,oauthConfig} from './tesla-oauth';
import {verifyTeslaIdentity,siteOriginAllowed} from './site-session';
import {teslaTokenScopes} from './tesla-scopes';
export async function acceptJourneyCredentials(data:{access_token:string;refresh_token:string;expires_in:number;client_id:string}){
 if(data.client_id!==process.env.TESLA_CLIENT_ID||typeof data.access_token!=='string'||typeof data.refresh_token!=='string'||!data.refresh_token||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error('Invalid connection');
 const r=await fetch(audience()+'/api/1/vehicles/'+encodeURIComponent(process.env.TESLA_VIN!),{headers:{Authorization:'Bearer '+data.access_token},cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Vehicle access not granted');const identity=(await r.json()).response;
 if(identity.vin!==process.env.TESLA_VIN||identity.granular_access?.hide_private)throw Error('Vehicle location is private');
 if(!teslaTokenScopes(data.access_token).includes('vehicle_location'))throw Error('Vehicle Location not granted');
 await saveTokens(data);
}
export async function journeyCallback(request:NextRequest){
 let origin=localOrigin;
 const finish=(result:string)=>{const response=NextResponse.redirect(new URL('/connect/journeys?result='+result,origin));response.cookies.set('tesla_journey_state','',{httpOnly:true,sameSite:'lax',secure:oauthConfig().secure,path:'/api/tesla',maxAge:0});response.headers.set('Cache-Control','no-store');return response;};
 try{
  const settings=await authSettings();
  const state=request.nextUrl.searchParams.get('state');if(!validOAuthState(request.cookies.get('tesla_journey_state')?.value,state))throw Error('Invalid state');
  const pending=await consumeTicket<AuthTransaction&{purpose:string;sub:string}>('oauth',state!);if(pending.purpose!=='journey-recording'||pending.sub!==settings.TESLA_AUTH_SUBJECT||!siteOriginAllowed(pending.origin,localOrigin))throw Error('Wrong sign-in flow');origin=pending.origin;
  if(request.nextUrl.searchParams.has('error'))return finish('cancelled');const code=request.nextUrl.searchParams.get('code');if(!code)throw Error('Missing code');
  const data=await token({grant_type:'authorization_code',client_id:process.env.TESLA_CLIENT_ID!,client_secret:process.env.TESLA_CLIENT_SECRET!,code,audience:audience(),redirect_uri:callback,code_verifier:pending.verifier});
  const keyResponse=await fetch('https://auth.tesla.com/oauth2/v3/discovery/thirdparty/keys',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!keyResponse.ok)throw Error('Identity keys unavailable');
  const sub=verifyTeslaIdentity(data.id_token,(await keyResponse.json()).keys,process.env.TESLA_CLIENT_ID!,pending.nonce);if(sub!==pending.sub)throw Error('Use the same approved Tesla account');
  const payload={access_token:data.access_token,refresh_token:data.refresh_token,expires_in:data.expires_in,client_id:process.env.TESLA_CLIENT_ID!};
  if(process.env.DASHBOARD_READ_PROXY){
   if(!process.env.JOURNEY_AUTH_RELAY_TOKEN)throw Error('NAS journey relay is not configured');
   const r=await fetch(process.env.DASHBOARD_READ_PROXY+'/api/journeys/credentials',{method:'POST',headers:{Authorization:'Bearer '+process.env.JOURNEY_AUTH_RELAY_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw Error('NAS did not accept location access');
  }else await acceptJourneyCredentials(payload);
  return finish('connected');
 }catch{return finish('failed');}
}
