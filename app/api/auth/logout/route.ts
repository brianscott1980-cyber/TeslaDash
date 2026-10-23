import {NextResponse,type NextRequest} from 'next/server';
import {sessionCookie,requestSiteOrigin} from '../../../../lib/site-session';
import {localOrigin} from '../../../../lib/tesla-auth';
export function POST(request:NextRequest){
 let origin:string;try{origin=requestSiteOrigin(request,localOrigin)}catch{return new Response('Invalid origin',{status:403})}if(request.headers.get('origin')!==origin)return new Response('Invalid origin',{status:403});
 const response=NextResponse.redirect(new URL('/login',origin),303);response.cookies.set(sessionCookie,'',{path:'/',maxAge:0,httpOnly:true,sameSite:'lax',secure:new URL(origin).protocol==='https:'});response.headers.set('Cache-Control','no-store');return response;
}
