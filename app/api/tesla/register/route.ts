import {NextResponse} from 'next/server';
import {audience,isLocalPost,localOrigin,saveEnv,token} from '../../../../lib/tesla-auth';
export async function POST(request:Request){
 if(!isLocalPost(request))return new Response('Local setup only',{status:403});
 const e=process.env;
 if(!e.TESLA_CLIENT_ID||!e.TESLA_CLIENT_SECRET||!e.TESLA_APP_DOMAIN)return NextResponse.redirect(localOrigin+'/connect/tesla?result=missing-settings',303);
 try{
  const data=await token({grant_type:'client_credentials',client_id:e.TESLA_CLIENT_ID,client_secret:e.TESLA_CLIENT_SECRET,audience:audience(),scope:'openid vehicle_device_data'});
  const r=await fetch(audience()+'/api/1/partner_accounts',{method:'POST',headers:{Authorization:`Bearer ${data.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({domain:e.TESLA_APP_DOMAIN}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)return NextResponse.redirect(localOrigin+'/connect/tesla?result=registration-http-'+r.status,303);
  await saveEnv({TESLA_REGISTERED:'true'});return NextResponse.redirect(localOrigin+'/connect/tesla?result=registered',303);
 }catch{return NextResponse.redirect(localOrigin+'/connect/tesla?result=registration-failed',303);}
}
