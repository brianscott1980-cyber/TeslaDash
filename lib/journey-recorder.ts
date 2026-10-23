import 'server-only';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {accessToken,audience} from './tesla-auth';
import {updateDrive,driveTrip,hasGps,type DriveSample,type JourneyStore} from './journey-recorder-model';
import {teslaTokenScopes} from './tesla-scopes';
export type JourneyTracking={status:'ready'|'driving'|'asleep'|'needs-permission'|'unavailable';message:string;updated:string;lastSample?:string;nextPollSeconds:number};
const root=()=>path.join(process.env.ENV_FILE_PATH?path.dirname(process.env.ENV_FILE_PATH):path.join(process.cwd(),'runtime'),'journeys');
const lock=globalThis as typeof globalThis&{journeyPoll?:Promise<JourneyTracking>};
async function loadStore():Promise<JourneyStore>{try{return JSON.parse(await readFile(path.join(root(),'history.json'),'utf8'))}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {trips:[]};throw Error('Journey history could not be read safely');}}
async function save(file:string,value:unknown){await mkdir(root(),{recursive:true,mode:0o700});const target=path.join(root(),file);await writeFile(target+'.tmp',JSON.stringify(value),{mode:0o600});await rename(target+'.tmp',target);}
export async function journeyHistory(){const store=await loadStore();let tracking:JourneyTracking={status:'unavailable',message:'Journey recorder has not reported yet.',updated:'',nextPollSeconds:60};try{tracking=JSON.parse(await readFile(path.join(root(),'status.json'),'utf8'))}catch{}
 if(tracking.updated&&Date.now()-Date.parse(tracking.updated)>150000)tracking={...tracking,status:'unavailable',message:'Journey recorder has stopped reporting. Check the NAS worker.'};
 return {trips:store.trips,active:store.active?driveTrip(store.active):undefined,tracking};
}
export function pollJourney(){if(!lock.journeyPoll)lock.journeyPoll=collect().finally(()=>{lock.journeyPoll=undefined});return lock.journeyPoll;}
async function collect():Promise<JourneyTracking>{
 const updated=new Date().toISOString();let store=await loadStore();
 const finish=async(status:JourneyTracking['status'],message:string,nextPollSeconds=60,lastSample?:string)=>{const result={status,message,updated,nextPollSeconds,lastSample};await save('status.json',result);return result;};
 try{
  const token=await accessToken();if(!token||!process.env.TESLA_VIN)return finish('unavailable','Tesla connection is not configured.');
  const headers={Authorization:'Bearer '+token};const scopes=teslaTokenScopes(token);
  const location=scopes.includes('vehicle_location');
  if(!location){store=updateDrive(store,undefined);await save('history.json',store);return finish('needs-permission','Grant Tesla Vehicle Location before driving to record a route. No location polling is attempted until permission is granted.');}
  const get=async(url:string)=>{const r=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Vehicle sample unavailable');return (await r.json()).response;};
  const base=audience()+'/api/1/vehicles/'+encodeURIComponent(process.env.TESLA_VIN);
  if(!store.active){const identity=await get(base);if(identity.state!=='online'){store=updateDrive(store,undefined);await save('history.json',store);return finish(location?'asleep':'needs-permission',location?'Car is asleep or offline. Waiting without waking it.':'Grant Tesla Vehicle Location before driving to record a route.');}}
  const v=await get(base+'/vehicle_data?'+new URLSearchParams({endpoints:'drive_state;vehicle_state'+(location?';location_data':'')}));const drive=v.drive_state??{},vehicle=v.vehicle_state??{};
  const timestamp=Number(drive.timestamp);if(!Number.isFinite(timestamp))return finish('unavailable','Tesla returned no fresh driving timestamp.');
  const sample:DriveSample={time:new Date(timestamp).toISOString(),gear:drive.shift_state,speed:drive.speed,latitude:location?drive.latitude:undefined,longitude:location?drive.longitude:undefined,odometer:vehicle.odometer,powerKw:drive.power};
  if(Date.now()-timestamp>150000)return finish('unavailable','Tesla returned an old driving sample. Waiting for fresh GPS data.',store.active?15:60,sample.time);
  store=updateDrive(store,sample);await save('history.json',store);
  if(location&&!hasGps(sample))return finish('unavailable','Vehicle Location is granted, but Tesla returned no GPS coordinates. Check vehicle sharing privacy and location availability.',store.active?15:60,sample.time);
  return finish(!location?'needs-permission':store.active?'driving':'ready',!location?'Route recording needs Tesla Vehicle Location permission.':store.active?'Recording this drive. GPS and sampled energy are saved on your NAS.':'Recorder ready. Your next drive will appear after parking for a minute.',store.active?15:60,sample.time);
 }catch{store=updateDrive(store,undefined);await save('history.json',store);return finish('unavailable','Tesla driving data is unavailable. Saved journeys are retained; no wake-up requested.');}
}
