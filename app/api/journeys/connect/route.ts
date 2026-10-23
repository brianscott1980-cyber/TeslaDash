import {NextResponse,type NextRequest} from 'next/server';
import {localOrigin} from '../../../../lib/tesla-auth';
import {storeTicket,authSettings} from '../../../../lib/site-auth';
import {requestSiteOrigin,readSession,sessionCookie} from '../../../../lib/site-session';
export async function POST(request:NextRequest){
 let origin:string;try{origin=requestSiteOrigin(request,localOrigin)}catch{return new Response('Invalid origin',{status:403})}if(request.headers.get('origin')!==origin)return new Response('Invalid origin',{status:403});
 const settings=await authSettings(),session=readSession(request.cookies.get(sessionCookie)?.value,settings.SITE_SESSION_SECRET,settings.TESLA_AUTH_SUBJECT);if(!session)return new Response('Sign in first',{status:401});
 const ticket=await storeTicket('handoff',{purpose:'journey-begin',sub:session.sub,origin,expires:Date.now()+60000});const url=new URL('/api/journeys/begin',localOrigin);url.searchParams.set('ticket',ticket);return NextResponse.redirect(url,303);
}
