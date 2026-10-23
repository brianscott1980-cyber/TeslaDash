export const dynamic='force-dynamic';
import {readProxyHeaders} from '../../../lib/read-proxy';
export async function GET(){
 if(process.env.DASHBOARD_READ_PROXY){try{const r=await fetch(`${process.env.DASHBOARD_READ_PROXY}/api/recording`,{headers:readProxyHeaders(),cache:'no-store',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();return Response.json(await r.json())}catch{return Response.json({status:'unavailable'})}}
 const root=process.env.PROMETHEUS_URL;
 if(!root)return Response.json({status:'unconfigured'});
 try{const query=encodeURIComponent('max(tesladash_poll_timestamp_seconds{job="tesladash"})');const r=await fetch(`${root}/api/v1/query?query=${query}`,{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const j=await r.json();const timestamp=Number(j.data?.result?.[0]?.value?.[1]);const age=(Date.now()/1000)-timestamp;return Response.json({status:Number.isFinite(age)&&age<180?'recording':'waiting',lastSample:Number.isFinite(timestamp)?new Date(timestamp*1000).toISOString():null,intervalSeconds:60,retentionDays:365});}catch{return Response.json({status:'unavailable'})}
}
