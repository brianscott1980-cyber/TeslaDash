import {journeyHistory} from '../../../lib/journey-recorder';
import {readProxyHeaders} from '../../../lib/read-proxy';
export const dynamic='force-dynamic';
export async function GET(){try{
 if(process.env.DASHBOARD_READ_PROXY){const r=await fetch(process.env.DASHBOARD_READ_PROXY+'/api/journeys',{headers:readProxyHeaders(),cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();return Response.json(await r.json(),{headers:{'Cache-Control':'no-store'}})}
 return Response.json(await journeyHistory(),{headers:{'Cache-Control':'no-store'}});
}catch{return Response.json({trips:[],tracking:{status:'unavailable',message:'Journey history could not be loaded.'}},{status:503})}}
