import type {Dashboard} from './data';

export type VehicleValues={name?:string;model?:string;vin?:string;paint?:string;wheels?:string;odometer?:number;software?:string;battery?:number;range?:number;realWorldRange?:number;temperature?:number;locked?:boolean;sentry?:boolean;tyreFL?:number;tyreFR?:number;tyreRL?:number;tyreRR?:number};
export type VehicleSnapshot={values:VehicleValues;observedAt:Partial<Record<keyof VehicleValues,string>>};
export const vehicleFields=['name','model','vin','paint','wheels','odometer','software','battery','range','realWorldRange','temperature','locked','sentry','tyreFL','tyreFR','tyreRL','tyreRR'] as const;
export function chargeStateRanges(charge:{battery_range?:unknown;est_battery_range?:unknown}):Pick<VehicleValues,'range'|'realWorldRange'>{
 const result:Pick<VehicleValues,'range'|'realWorldRange'>={};
 for(const [field,value] of [['range',charge.battery_range],['realWorldRange',charge.est_battery_range]] as const){if(typeof value==='number'&&Number.isFinite(value)&&value>=0)result[field]=value;}
 return result;
}
const textFields=new Set(['name','model','vin','paint','wheels','software']);
export function validVehicleValue(key:keyof VehicleValues,value:unknown){
 if(textFields.has(key))return typeof value==='string'&&value.trim().length>0&&!['—','Vehicle unavailable','Your Tesla'].includes(value);
 if(key==='locked'||key==='sentry')return typeof value==='boolean';
 return typeof value==='number'&&Number.isFinite(value)&&(key==='temperature'||value>=0)&&(key!=='battery'||value<=100);
}
export function mergeVehicleSnapshot(previous:VehicleSnapshot|undefined,values:VehicleValues,observedAt:string):VehicleSnapshot{
 const next:VehicleSnapshot={values:{...previous?.values},observedAt:{...previous?.observedAt}};
 if(!Number.isFinite(Date.parse(observedAt)))return next;
 for(const key of vehicleFields){if(!validVehicleValue(key,values[key]))continue;if(Date.parse(next.observedAt[key]??'')>Date.parse(observedAt))continue;Object.assign(next.values,{[key]:values[key]});next.observedAt[key]=observedAt;}
 return next;
}
export function legacyVehicleValues(d:Dashboard):VehicleValues{
 if(d.demo||d.state==='Unavailable')return {};
 return Object.fromEntries(vehicleFields.filter(key=>key in d).map(key=>[key,d[key as keyof Dashboard]])) as VehicleValues;
}
// Prometheus range-vector timestamps are the original scrape times, not query time.
export function recordedVehicle(rows:{metric:{__name__?:string};values?:[number,string][]}[]):VehicleSnapshot{
 let result:VehicleSnapshot={values:{},observedAt:{}};
 const fields:Record<string,keyof VehicleValues>={tesladash_odometer_miles:'odometer',tesladash_battery_percent:'battery',tesladash_range_miles:'range',tesladash_real_world_range_miles:'realWorldRange'};
 for(const row of rows){const key=fields[row.metric?.__name__??''];if(!key)continue;for(const [timestamp,value] of row.values??[]){if(!Number.isFinite(timestamp)||!Number.isFinite(Number(value))||!value.trim())continue;result=mergeVehicleSnapshot(result,{[key]:Number(value)},new Date(timestamp*1000).toISOString());}}
 return result;
}
