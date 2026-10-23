import {withSavedVehicle} from '../../../lib/saved-vehicle';
import {readProxyHeaders} from '../../../lib/read-proxy';
import {emptyDashboard} from '../../../lib/data';
import {NextResponse} from 'next/server';
import {getDashboard} from '../../../lib/dashboard';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.DASHBOARD_READ_PROXY){try{const r=await fetch(`${process.env.DASHBOARD_READ_PROXY}/api/dashboard`,{headers:readProxyHeaders(),cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();return NextResponse.json(await withSavedVehicle(await r.json()),{headers:{'Cache-Control':'no-store'}})}catch{const d=emptyDashboard();d.notices.push('The recording server could not be reached. Showing locally saved vehicle details.');return NextResponse.json(await withSavedVehicle(d),{headers:{'Cache-Control':'no-store'}})}}
 return NextResponse.json(await getDashboard(),{headers:{'Cache-Control':'no-store'}})
}
