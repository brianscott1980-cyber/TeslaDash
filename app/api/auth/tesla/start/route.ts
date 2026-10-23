import {NextResponse} from 'next/server';
import {localOrigin} from '../../../../../lib/tesla-auth';
import {requestSiteOrigin} from '../../../../../lib/site-session';
export function POST(request:Request){
 let origin:string;try{origin=requestSiteOrigin(request,localOrigin)}catch{return new Response('Invalid sign-in origin',{status:403})}
 if(request.headers.get('origin')!==origin)return new Response('Invalid sign-in origin',{status:403});
 const begin=new URL('/api/auth/tesla/begin',localOrigin);begin.searchParams.set('return',origin);
 return NextResponse.redirect(begin,303);
}
