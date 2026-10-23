import {withSavedVehicle} from './saved-vehicle';
import {journeyHistory} from './journey-recorder';
import {mergeVehicleSnapshot,chargeStateRanges} from './vehicle-snapshot';
import 'server-only';
import {vehicleName} from './vehicle-name';
import {smartSchedule} from './octopus-schedule';
import {scheduledForecast} from './scheduled-forecast';
import {forecastCharge,type ForecastRate} from './charge-forecast';
import {demoData, emptyDashboard, type Dashboard} from './data';
import {accessToken} from './tesla-auth';
import {expandIntelligentRates} from './octopus';
async function get(url:string,headers:Record<string,string>={}) {const r=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`Provider returned HTTP ${r.status}`);return r.json();}
async function prices(url:string){const r=await get(url);if(r.results.length||!process.env.OCTOPUS_PRODUCT_CODE?.startsWith('IOG-'))return r;const [day,night]=await Promise.all([get(url.replace('/standard-unit-rates/','/day-unit-rates/')),get(url.replace('/standard-unit-rates/','/night-unit-rates/'))]);const q=new URL(url).searchParams;return {results:expandIntelligentRates(day.results,night.results,Date.parse(q.get('period_from')!),Date.parse(q.get('period_to')!)),next:day.next||night.next};}
async function collectDashboard():Promise<Dashboard>{
 if(process.env.DEMO_MODE!=='false')return demoData();
 const d=emptyDashboard();
 const recorded=await journeyHistory();d.trips=recorded.trips;
 let forecastRates:ForecastRate[]=[];
 const e=process.env;
 await Promise.all([ (async()=>{if(!e.TESLA_ACCESS_TOKEN||!e.TESLA_VIN){d.notices.push('Tesla is not connected yet. Octopus data below is live.');return;}try{const currentToken=await accessToken();const host=e.TESLA_REGION==='na'?'fleet-api.prd.na.vn.cloud.tesla.com':'fleet-api.prd.eu.vn.cloud.tesla.com';const headers={Authorization:`Bearer ${currentToken}`};const {response:identity}=await get(`https://${host}/api/1/vehicles/${encodeURIComponent(e.TESLA_VIN)}`,headers);d.vehicleConnection=identity.state??'unknown';d.vehicle=mergeVehicleSnapshot(undefined,{name:identity.display_name,vin:identity.vin},d.updated);if(identity.state&&identity.state!=='online'){d.notices.push('Vehicle is '+identity.state+'. Showing saved vehicle readings; no wake-up was requested.');return;}const {response:v}=await get(`https://${host}/api/1/vehicles/${encodeURIComponent(e.TESLA_VIN)}/vehicle_data?endpoints=charge_state%3Bvehicle_state%3Bvehicle_config%3Bclimate_state`,{Authorization:`Bearer ${currentToken}`});const c=v.charge_state??{};const rangeReadings=chargeStateRanges(c);d.realWorldRange=rangeReadings.realWorldRange;const vs=v.vehicle_state??{};d.vehicle=mergeVehicleSnapshot(d.vehicle,{name:vehicleName(v),model:v.vehicle_config?.car_type,vin:v.vin,paint:v.vehicle_config?.exterior_color,wheels:v.vehicle_config?.wheel_type,odometer:vs.odometer,software:vs.car_version,battery:c.battery_level,...rangeReadings,temperature:v.climate_state?.inside_temp,locked:vs.locked,sentry:vs.sentry_mode,tyreFL:vs.tpms_pressure_fl,tyreFR:vs.tpms_pressure_fr,tyreRL:vs.tpms_pressure_rl,tyreRR:vs.tpms_pressure_rr},new Date(vs.timestamp??c.timestamp??Date.now()).toISOString());d.name=vehicleName(v);d.model=v.vehicle_config?.car_type??'Tesla';d.paint=v.vehicle_config?.exterior_color;d.wheels=v.vehicle_config?.wheel_type;d.vin=v.vin;d.battery=c.battery_level??0;d.range=c.battery_range??0;d.state=c.charging_state??'Unknown';d.power=c.charger_power??0;d.limit=c.charge_limit_soc??0;d.hours=c.time_to_full_charge??0;d.added=c.charge_energy_added??0;d.odometer=v.vehicle_state?.odometer??0;d.software=v.vehicle_state?.car_version??'—';d.temperature=v.climate_state?.inside_temp??0;}catch{d.notices.push('Tesla data unavailable. Check token expiry, vehicle permissions and whether the car is asleep. No wake-up was requested.');}})(),(async()=>{if(!e.OCTOPUS_PRODUCT_CODE||!e.OCTOPUS_TARIFF_CODE){d.notices.push('Set your Octopus product and tariff codes to load electricity prices.');return;}try{const now=new Date();const end=new Date(now.getTime()+86400000);const q=new URLSearchParams({period_from:now.toISOString(),period_to:end.toISOString(),page_size:'100'});const r=await prices(`https://api.octopus.energy/v1/products/${encodeURIComponent(e.OCTOPUS_PRODUCT_CODE)}/electricity-tariffs/${encodeURIComponent(e.OCTOPUS_TARIFF_CODE)}/standard-unit-rates/?${q}`);forecastRates=r.results;d.rates=r.results.sort((a:{valid_from:string},b:{valid_from:string})=>a.valid_from.localeCompare(b.valid_from)).map((r:{valid_from:string;value_inc_vat:number})=>({time:new Date(r.valid_from).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}),rate:r.value_inc_vat}));const current=r.results.find((r:{valid_from:string;valid_to:string})=>new Date(r.valid_from)<=now&&(!r.valid_to||new Date(r.valid_to)>now));d.rate=current?.value_inc_vat??null;}catch{d.notices.push('Octopus prices unavailable. Check product and tariff codes.');}})()]);
 d.schedule=await smartSchedule();
 const futureSlots=d.schedule.status==='ready'?d.schedule.slots.filter(s=>Date.parse(s.end)>Date.now()):[];
 const smartRate=forecastRates.length?Math.min(...forecastRates.map(r=>r.value_inc_vat)):null;
 d.forecastSource=futureSlots.length?'schedule':'continuous';
 d.forecast=futureSlots.length?scheduledForecast({now:Date.now(),added:d.added,currentRate:d.rate,smartRate,slots:futureSlots,rates:forecastRates}):d.state==='Charging'?forecastCharge({now:Date.now(),added:d.added,power:d.power,hours:d.hours,currentRate:d.rate,rates:forecastRates}):null;
 if(e.OCTOPUS_PRODUCT_CODE?.startsWith('IOG-'))d.notices.push('Intelligent Octopus Go estimates use the standard 23:30-05:30 UK off-peak window. Octopus SMART slots are shown below and priced at the lowest published rate for estimates. Bill adjustments are not included.');
 d.notices.push('Charging sessions and trips are not reconstructed yet. Current-session costs are estimates, not billed totals.');
 return withSavedVehicle(d);
}

const cache=globalThis as typeof globalThis & {teslaDashboardCache?:{value?:Dashboard;until:number;pending?:Promise<Dashboard>}};
export async function getDashboard():Promise<Dashboard>{
 const state=cache.teslaDashboardCache??(cache.teslaDashboardCache={until:0});
 if(state.value&&state.until>Date.now())return state.value;
 if(!state.pending)state.pending=collectDashboard().then(value=>{state.value=value;state.until=Date.now()+(value.vehicleConnection==='online'?25000:60000);return value}).finally(()=>{state.pending=undefined});
 return state.pending;
}
