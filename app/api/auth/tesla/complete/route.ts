import {NextResponse,type NextRequest} from 'next/server';
import {consumeTicket,authSettings} from '../../../../../lib/site-auth';
import {sessionCookie,sessionSeconds,signSession,requestSiteOrigin,allowedSiteEmail} from '../../../../../lib/site-session';
import {localOrigin} from '../../../../../lib/tesla-auth';
export async function GET(request:NextRequest){
 try{
  const claim=await consumeTicket<{sub:string;email?:string;origin:string;expires:number}>('handoff',request.nextUrl.searchParams.get('ticket')??'');
  if(claim.origin!==requestSiteOrigin(request,localOrigin))throw Error('Wrong return origin');const env=await authSettings();if(claim.sub!==env.TESLA_AUTH_SUBJECT||!env.SITE_SESSION_SECRET||!allowedSiteEmail(claim.email))throw Error('Account not allowed');
  const response=NextResponse.redirect(new URL('/',claim.origin));response.cookies.set(sessionCookie,signSession(claim.sub,env.SITE_SESSION_SECRET,Date.now(),claim.email),{httpOnly:true,sameSite:'lax',path:'/',secure:new URL(claim.origin).protocol==='https:',maxAge:sessionSeconds});response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
 }catch{let origin=localOrigin;try{origin=requestSiteOrigin(request,localOrigin)}catch{}return NextResponse.redirect(new URL('/login?error=expired',origin));}
}
