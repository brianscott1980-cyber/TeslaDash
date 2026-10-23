import {chargingHistory} from '../../../lib/charging-history';
import {readProxyHeaders} from '../../../lib/read-proxy';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.DASHBOARD_READ_PROXY){const r=await fetch(`${process.env.DASHBOARD_READ_PROXY}/api/charging-history`,{headers:readProxyHeaders(),cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)return new Response('Charging history unavailable',{status:502});return Response.json(await r.json(),{headers:{'Cache-Control':'no-store'}})}
 return Response.json(await chargingHistory(),{headers:{'Cache-Control':'no-store'}})
}
