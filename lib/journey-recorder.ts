import 'server-only';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {accessToken,audience} from './tesla-auth';
import {updateDrive,driveTrip,hasGps,isDriving,gpsMiles,type DriveSample,type JourneyStore} from './journey-recorder-model';
import {teslaTokenScopes} from './tesla-scopes';
export type JourneyTracking={status:'ready'|'driving'|'asleep'|'needs-permission'|'unavailable';message:string;updated:string;lastSample?:string;nextPollSeconds:number};
const root=()=>path.join(process.env.ENV_FILE_PATH?path.dirname(process.env.ENV_FILE_PATH):path.join(process.cwd(),'runtime'),'journeys');
const lock=globalThis as typeof globalThis&{journeyPoll?:Promise<JourneyTracking>};
async function loadStore():Promise<JourneyStore>{try{return JSON.parse(await readFile(path.join(root(),'history.json'),'utf8'))}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {trips:[]};throw Error('Journey history could not be read safely');}}
async function save(file:string,value:unknown){await mkdir(root(),{recursive:true,mode:0o700});const target=path.join(root(),file);await writeFile(target+'.tmp',JSON.stringify(value),{mode:0o600});await rename(target+'.tmp',target);}
export async function journeyHistory(){const store=await loadStore();let tracking:JourneyTracking={status:'unavailable',message:'Journey recorder has not reported yet.',updated:'',nextPollSeconds:60};try{tracking=JSON.parse(await readFile(path.join(root(),'status.json'),'utf8'))}catch{}
 if(tracking.updated&&Date.now()-Date.parse(tracking.updated)>150000)tracking={...tracking,status:'unavailable',message:'Journey recorder has stopped reporting. Check the NAS worker.'};
 const active=store.active,trip=active?driveTrip(active,active.parkedAt??active.last.time):undefined;
 const recent=active&&Date.now()-Date.parse(active.last.time)<150000;
 const provisional=active?.parkedAt&&Date.now()-Date.parse(active.parkedAt)>=60000;
 return {trips:provisional&&trip?[trip,...store.trips.filter(t=>t.id!==trip.id)]:store.trips,active:trip,live:active&&trip?{trip,sample:active.last,driving:!!recent&&isDriving(active.last),paused:!!active.parkedAt}:undefined,tracking};
}
export function pollJourney(){if(!lock.journeyPoll)lock.journeyPoll=collect().finally(()=>{lock.journeyPoll=undefined});return lock.journeyPoll;}
async function collect():Promise<JourneyTracking>{
 const updated=new Date().toISOString();let store=updateDrive(await loadStore(),undefined);
 const finish=async(status:JourneyTracking['status'],message:string,nextPollSeconds=60,lastSample?:string)=>{const result={status,message,updated,nextPollSeconds,lastSample};await save('history.json',store);await save('status.json',result);return result;};
 try{
  const token=await accessToken();if(!token||!process.env.TESLA_VIN)return finish('unavailable','Tesla connection is not configured.');
  const headers={Authorization:'Bearer '+token};const scopes=teslaTokenScopes(token);
  const location=scopes.includes('vehicle_location');
  if(!location){try{const capability=JSON.parse(await readFile(path.join(root(),'capabilities.json'),'utf8'));if(capability.vin===process.env.TESLA_VIN&&capability.requiresLocationForDrive)return finish('needs-permission','Tesla requires Vehicle Location before it will supply driving readings for this car. Connect location to enable live journeys, energy and routes.',15);}catch{}}
  const get=async(url:string)=>{const r=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Vehicle sample unavailable');return (await r.json()).response;};
  const base=audience()+'/api/1/vehicles/'+encodeURIComponent(process.env.TESLA_VIN);
  if(!store.active||store.active.parkedAt){const identity=await get(base);if(identity.state!=='online'){store=updateDrive(store,undefined);await save('history.json',store);return finish(location?'asleep':'needs-permission',location?'Car is asleep or offline. Waiting without waking it.':'Car is asleep or offline. Energy recording is configured; grant Vehicle Location to add GPS routes.');}}
  const v=await get(base+'/vehicle_data?'+new URLSearchParams({endpoints:'drive_state;vehicle_state;charge_state'+(location?';location_data':'')}));const drive=v.drive_state??{},vehicle=v.vehicle_state??{},charge=v.charge_state??{};
  const timestamp=typeof drive.timestamp==='number'?drive.timestamp:NaN;
  if(!Number.isFinite(timestamp)){
   if(!location){await save('capabilities.json',{vin:process.env.TESLA_VIN,requiresLocationForDrive:true});return finish('needs-permission','Tesla omitted driving readings from the current grant. Connect Vehicle Location to enable live journeys, energy and routes.',15);}
   return finish('unavailable','Tesla returned no fresh driving timestamp.');
  }
  const sample:DriveSample={time:new Date(timestamp).toISOString(),gear:drive.shift_state,speed:drive.speed,heading:location?drive.heading:undefined,latitude:location?drive.latitude:undefined,longitude:location?drive.longitude:undefined,odometer:vehicle.odometer,powerKw:drive.power,batteryPercent:charge.battery_level};
  const home={time:sample.time,latitude:Number(process.env.HOME_LATITUDE),longitude:Number(process.env.HOME_LONGITUDE)};
  sample.chargingAway=charge.charging_state==='Charging'&&(charge.fast_charger_present===true||drive.located_at_home===false||(!!process.env.HOME_LATITUDE&&!!process.env.HOME_LONGITUDE&&hasGps(home)&&hasGps(sample)&&gpsMiles(home,sample)>.2));
  if(location&&typeof drive.active_route_destination==='string'&&drive.active_route_destination.trim())sample.navigation={destination:drive.active_route_destination.slice(0,160),minutesRemaining:drive.active_route_minutes_to_arrival,milesRemaining:drive.active_route_miles_to_arrival,arrivalBatteryPercent:drive.active_route_energy_at_arrival};
  if(Date.now()-timestamp>150000)return finish('unavailable','Tesla returned an old driving sample. Waiting for fresh GPS data.',store.active?15:60,sample.time);
  store=updateDrive(store,sample);await save('history.json',store);
  if(location&&!hasGps(sample))return finish('unavailable','Vehicle Location is granted, but Tesla returned no GPS coordinates. Check vehicle sharing privacy and location availability.',store.active?15:60,sample.time);
  if(!location)return finish('needs-permission',isDriving(sample)?'Recording driving energy and distance. Grant Tesla Vehicle Location to add the route, destination and arrival estimates.':'Energy recorder ready. Grant Tesla Vehicle Location to add GPS routes and navigation estimates.',store.active?15:30,sample.time);
  return finish(isDriving(sample)?'driving':'ready',isDriving(sample)?'Recording this drive. GPS and sampled energy are saved on your NAS.':store.active?.parkedAt?'Journey paused. Stops under 30 minutes and identified charging stops away from home remain part of this journey.':'Recorder ready for your next drive.',store.active?15:30,sample.time);
 }catch{store=updateDrive(store,undefined);await save('history.json',store);return finish('unavailable','Tesla driving data is unavailable. Saved journeys are retained; no wake-up requested.');}
}
