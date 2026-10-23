import {NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {callback,isLocalPost,localOrigin} from '../../../../lib/tesla-auth';
import {authorizeUrl,oauthConfig} from '../../../../lib/tesla-oauth';
export async function POST(request:Request){
 if(!isLocalPost(request))return new Response('Start Tesla sign-in from the configured connection page.',{status:403});
 if(!process.env.TESLA_CLIENT_ID||!process.env.TESLA_CLIENT_SECRET)return NextResponse.redirect(localOrigin+'/connect/tesla?error=credentials',303);
 const state=randomBytes(32).toString('hex');const url=authorizeUrl(process.env.TESLA_CLIENT_ID,callback,state);
 const r=NextResponse.redirect(url,303);r.cookies.set('tesla_oauth_state',state,{httpOnly:true,sameSite:'lax',maxAge:600,path:'/api/tesla',secure:oauthConfig().secure});r.headers.set('Cache-Control','no-store');r.headers.set('Referrer-Policy','no-referrer');return r;
}
