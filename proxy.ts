import {NextResponse,type NextRequest} from 'next/server';
import {readSession,sessionCookie,machineReadAccess,requestSiteOrigin} from './lib/site-session';
import {localOrigin} from './lib/tesla-auth';
import {authSettings} from './lib/site-auth';

export async function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 const publicPaths=['/.well-known/appspecific/com.tesla.3p.public-key.pem','/api/journeys/begin','/login','/api/auth/tesla/start','/api/auth/tesla/begin','/api/auth/tesla/callback','/api/auth/tesla/complete','/api/auth/logout','/api/health'];
 // Tesla's already registered callback remains the entry point for site sign-in.
 if(publicPaths.includes(path)||path==='/api/tesla/callback'){const response=NextResponse.next();response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy',path==='/login'?'same-origin':'no-referrer');return response;}
 const env=await authSettings();
 const machine=machineReadAccess(path,request.method,request.headers.get('authorization'),env);
 if(!machine&&!readSession(request.cookies.get(sessionCookie)?.value,env.SITE_SESSION_SECRET,env.TESLA_AUTH_SUBJECT)){
  if(path.startsWith('/api/'))return NextResponse.json({error:'Sign in with Tesla to access this dashboard.'},{status:401,headers:{'Cache-Control':'no-store'}});
  let origin:string;try{origin=requestSiteOrigin(request,localOrigin)}catch{return new Response('Unknown dashboard host',{status:403})}return NextResponse.redirect(new URL('/login',origin));
 }
 const response=NextResponse.next();response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','same-origin');return response;
}
export const config={matcher:['/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|vehicles/).*)']};
