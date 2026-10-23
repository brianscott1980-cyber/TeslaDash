import {NextRequest,NextResponse} from 'next/server';
import {validOAuthState,oauthConfig} from '../../../../lib/tesla-oauth';
import {siteCallback} from '../../../../lib/site-login';
import {journeyCallback} from '../../../../lib/journey-authorization';
import {authSettings} from '../../../../lib/site-auth';
import {readSession,sessionCookie} from '../../../../lib/site-session';
import {audience,callback,localOrigin,saveEnv,saveTokens,token} from '../../../../lib/tesla-auth';
export async function GET(request:NextRequest){
 const state=request.nextUrl.searchParams.get('state');
 // An abandoned GPS consent flow must not hijack a later site sign-in.
 if(validOAuthState(request.cookies.get('tesla_journey_state')?.value,state))return journeyCallback(request);
 if(validOAuthState(request.cookies.get('tesla_site_state')?.value,state))return siteCallback(request);
 const settings=await authSettings();if(!readSession(request.cookies.get(sessionCookie)?.value,settings.SITE_SESSION_SECRET,settings.TESLA_AUTH_SUBJECT))return new Response('Sign in before changing the vehicle connection.',{status:401,headers:{'Cache-Control':'no-store'}});
 const q=request.nextUrl.searchParams;const expected=request.cookies.get('tesla_oauth_state')?.value;
 const finish=(status:string)=>{const r=NextResponse.redirect(localOrigin+'/connect/tesla?result='+status);r.cookies.set('tesla_oauth_state','',{httpOnly:true,sameSite:'lax',maxAge:0,path:'/api/tesla',secure:oauthConfig().secure});r.headers.set('Cache-Control','no-store');r.headers.set('Referrer-Policy','no-referrer');return r;};
 if(!validOAuthState(expected,state))return finish('invalid-state');
 if(q.has('error')||!q.get('code'))return finish('cancelled');
 try{
  const data=await token({grant_type:'authorization_code',client_id:process.env.TESLA_CLIENT_ID!,client_secret:process.env.TESLA_CLIENT_SECRET!,code:q.get('code')!,audience:audience(),redirect_uri:callback});
  await saveTokens(data);
  const r=await fetch(audience()+'/api/1/vehicles',{headers:{Authorization:`Bearer ${data.access_token}`},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!r.ok)return finish('vehicle-list-unavailable');const cars=(await r.json()).response;
  if(!Array.isArray(cars)||!cars.length)return finish('no-vehicles');
  const selected=cars.find((c:{vin:string})=>c.vin===process.env.TESLA_VIN)??(cars.length===1?cars[0]:undefined);if(!selected||typeof selected.vin!=='string')return finish('select-vehicle');await saveEnv({TESLA_VIN:selected.vin,DEMO_MODE:'false'});
  return finish('connected');
 }catch{return finish('authentication-failed');}
}
