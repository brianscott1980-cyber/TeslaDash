import {NextResponse,type NextRequest} from 'next/server';
import {randomBytes,createHash} from 'node:crypto';
import {callback,localOrigin} from '../../../../lib/tesla-auth';
import {consumeTicket,storeTicket,authSettings} from '../../../../lib/site-auth';
import {authorizeUrl,oauthConfig} from '../../../../lib/tesla-oauth';
import {requestSiteOrigin,siteOriginAllowed} from '../../../../lib/site-session';
import {journeyScopes} from '../../../../lib/tesla-scopes';
export async function GET(request:NextRequest){try{
 if(requestSiteOrigin(request,localOrigin)!==localOrigin)throw Error();const begin=await consumeTicket<{purpose:string;sub:string;origin:string;expires:number}>('handoff',request.nextUrl.searchParams.get('ticket')??'');
 const settings=await authSettings();if(begin.purpose!=='journey-begin'||begin.sub!==settings.TESLA_AUTH_SUBJECT||!siteOriginAllowed(begin.origin,localOrigin))throw Error();
 const nonce=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url');const state=await storeTicket('oauth',{...begin,purpose:'journey-recording',nonce,verifier,expires:Date.now()+600000});
 const url=authorizeUrl(process.env.TESLA_CLIENT_ID!,callback,state);url.searchParams.set('scope',journeyScopes);url.searchParams.set('require_requested_scopes','true');url.searchParams.set('nonce',nonce);url.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));url.searchParams.set('code_challenge_method','S256');
 const response=NextResponse.redirect(url);response.cookies.set('tesla_journey_state',state,{httpOnly:true,sameSite:'lax',secure:oauthConfig().secure,path:'/api/tesla',maxAge:600});response.headers.set('Cache-Control','no-store');return response;
}catch{return NextResponse.redirect(new URL('/connect/journeys?result=failed',localOrigin));}}
