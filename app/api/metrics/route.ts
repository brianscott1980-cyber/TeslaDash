import {getDashboard} from '../../../lib/dashboard';
import {readProxyHeaders} from '../../../lib/read-proxy';
import {prometheusMetrics} from '../../../lib/prometheus';
export const dynamic='force-dynamic';
export async function GET(){try{
 const headers={'Content-Type':'text/plain; version=0.0.4; charset=utf-8','Cache-Control':'no-store'};
 if(process.env.DASHBOARD_READ_PROXY){const r=await fetch(`${process.env.DASHBOARD_READ_PROXY}/api/metrics`,{headers:readProxyHeaders(),cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();return new Response(await r.text(),{headers})}
 return new Response(prometheusMetrics(await getDashboard()),{headers});
 }catch{return new Response('Provider collection failed\n',{status:503})}}
