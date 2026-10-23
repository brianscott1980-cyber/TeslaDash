import 'server-only';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {Dashboard} from './data';
import {legacyVehicleValues,mergeVehicleSnapshot,recordedVehicle,type VehicleSnapshot} from './vehicle-snapshot';

let pending:Promise<unknown>=Promise.resolve();
// Serialize writes so a slower poll cannot overwrite a newer snapshot.
export function withSavedVehicle(d:Dashboard):Promise<Dashboard>{
 const work=pending.then(()=>update(d));pending=work.catch(()=>{});return work;
}
async function update(d:Dashboard):Promise<Dashboard>{
 if(d.demo)return d;
 const file=path.join(process.env.ENV_FILE_PATH?path.dirname(process.env.ENV_FILE_PATH):path.join(process.cwd(),'runtime'),'vehicle-snapshot.json');
 let saved:VehicleSnapshot|undefined;
 try{const raw=JSON.parse(await readFile(file,'utf8'));if(raw?.values&&raw?.observedAt&&(!process.env.TESLA_VIN||!raw.values.vin||raw.values.vin===process.env.TESLA_VIN)){saved=mergeVehicleSnapshot(undefined,{},d.updated);for(const key of Object.keys(raw.observedAt))saved=mergeVehicleSnapshot(saved,{[key]:raw.values[key]},raw.observedAt[key]);}}catch{}
 const persisted=JSON.stringify(saved);
 // Bootstrap an existing installation from its recorded gauges without contacting the car.
 if(saved?.values.odometer===undefined&&process.env.PROMETHEUS_URL){try{
  const query='{__name__=~"tesladash_(odometer_miles|battery_percent|range_miles|real_world_range_miles)",job="tesladash"}[365d]';
  const r=await fetch(`${process.env.PROMETHEUS_URL}/api/v1/query?${new URLSearchParams({query})}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(r.ok){const json=await r.json();if(json.status==='success'&&Array.isArray(json.data?.result)){const recovered=recordedVehicle(json.data.result);for(const [key,time] of Object.entries(recovered.observedAt))saved=mergeVehicleSnapshot(saved,{[key]:recovered.values[key as keyof typeof recovered.values]},time!);}}
 }catch{}}
 let next=mergeVehicleSnapshot(saved,d.vehicle?{}:legacyVehicleValues(d),d.updated);
 if(d.vehicle){for(const [key,time] of Object.entries(d.vehicle.observedAt))next=mergeVehicleSnapshot(next,{[key]:d.vehicle.values[key as keyof typeof d.vehicle.values]},time!);}
 if(Object.keys(next.values).length&&JSON.stringify(next)!==persisted){
  try{await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(next),{mode:0o600});await rename(file+'.tmp',file);}catch{d.notices.push('Vehicle readings are available, but could not be saved to disk.');}
 }
 return {...d,vehicle:next};
}
