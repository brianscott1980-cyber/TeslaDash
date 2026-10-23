import {NextResponse,type NextRequest} from 'next/server';
import {randomBytes,createHash} from 'node:crypto';
import {localOrigin,callback} from '../../../../../lib/tesla-auth';
import {oauthConfig,authorizeUrl} from '../../../../../lib/tesla-oauth';
import {siteOriginAllowed,requestSiteOrigin} from '../../../../../lib/site-session';
import {ensureSessionSecret,storeTicket} from '../../../../../lib/site-auth';
export async function GET(request:NextRequest){
 const origin=request.nextUrl.searchParams.get('return')??localOrigin;
 try{if(requestSiteOrigin(request,localOrigin)!==localOrigin||!siteOriginAllowed(origin,localOrigin))throw Error()}catch{return new Response('Invalid sign-in origin',{status:403})}
 if(!process.env.TESLA_CLIENT_ID||!process.env.TESLA_CLIENT_SECRET||!process.env.TESLA_VIN)return NextResponse.redirect(new URL('/login?error=configuration',origin));
 await ensureSessionSecret();
 const nonce=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url');
 const state=await storeTicket('oauth',{nonce,verifier,origin,expires:Date.now()+600000});
 const url=authorizeUrl(process.env.TESLA_CLIENT_ID,callback,state);
 // Site sign-in never saves or rotates the vehicle collector's tokens.
 url.searchParams.set('scope','openid user_data vehicle_device_data');url.searchParams.set('nonce',nonce);url.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));url.searchParams.set('code_challenge_method','S256');
 const response=NextResponse.redirect(url);response.cookies.set('tesla_site_state',state,{httpOnly:true,sameSite:'lax',secure:oauthConfig().secure,path:'/api',maxAge:600});response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
}
