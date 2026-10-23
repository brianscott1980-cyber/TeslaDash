import 'server-only';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {expandIntelligentRates,offPeak,type Rate} from './octopus';
import {evaluateCharge,sixMonthsAgo,type ChargingHistory,type ProviderCharge,type HistoricalTariff} from './charging-history-model';
const endpoint='https://api.octopus.energy/v1/graphql/';
type Agreement={tariff_code:string;valid_from:string;valid_to:string|null};
async function json(url:string,init:RequestInit={}){const r=await fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('History provider unavailable');return r.json();}
async function gql(query:string,variables:Record<string,unknown>,token?:string){const j=await json(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:token}:{})},body:JSON.stringify({query,variables})});if(j.errors?.length||!j.data)throw Error('Charging history unavailable');return j.data;}
async function allRates(url:string):Promise<Rate[]>{const rows:Rate[]=[];for(let page=0;url&&page<30;page++){const j=await json(url);rows.push(...j.results);url=j.next;if(url&&!url.startsWith('https://api.octopus.energy/v1/products/'))throw Error('Unexpected pagination URL');}if(url)throw Error('Rate history truncated');return rows;}
async function tariff(a:Agreement,from:string,to:string):Promise<HistoricalTariff>{
 const product=a.tariff_code.slice(5,-2),root=`https://api.octopus.energy/v1/products/${encodeURIComponent(product)}/electricity-tariffs/${encodeURIComponent(a.tariff_code)}/`;
 const q=new URLSearchParams({period_from:from,period_to:to,page_size:'1500'});
 let rates=await allRates(`${root}standard-unit-rates/?${q}`),smartRates:Rate[]=[];
 if(!rates.length&&product.startsWith('IOG-')){const [day,night]=await Promise.all([allRates(`${root}day-unit-rates/?${q}`),allRates(`${root}night-unit-rates/?${q}`)]);rates=expandIntelligentRates(day,night,Date.parse(from),Date.parse(to));smartRates=night;}
 else smartRates=rates.filter(r=>offPeak(Date.parse(r.valid_from)+60000));
 return {code:a.tariff_code,from:a.valid_from,to:a.valid_to,rates,smartRates};
}
const cache=globalThis as typeof globalThis&{chargingHistoryCache?:{until:number;value?:ChargingHistory;pending?:Promise<ChargingHistory>}};
async function collect():Promise<ChargingHistory>{
 const now=new Date(),from=sixMonthsAgo(now),to=now.toISOString(),base={from,to,updated:to,sessions:[]};
 const e=process.env;
 if(!e.OCTOPUS_API_KEY||!e.OCTOPUS_ACCOUNT_NUMBER)return {...base,status:'unconfigured'};
 const file=path.join(e.ENV_FILE_PATH?path.dirname(e.ENV_FILE_PATH):path.join(process.cwd(),'runtime'),'charging-history.json');
 try{
  const auth=await gql('mutation($key:String!){obtainKrakenToken(input:{APIKey:$key}){token}}',{key:e.OCTOPUS_API_KEY});const token=auth.obtainKrakenToken.token;
  const deviceData=await gql('query($account:String!){devices(accountNumber:$account){id deviceType integrationDeviceId}}',{account:e.OCTOPUS_ACCOUNT_NUMBER},token);
  const devices=deviceData.devices.filter((d:{deviceType:string})=>d.deviceType==='ELECTRIC_VEHICLES');
  const device=devices.find((d:{id:string;integrationDeviceId:string})=>d.id===e.OCTOPUS_DEVICE_ID||d.integrationDeviceId===e.TESLA_VIN)??(devices.length===1?devices[0]:undefined);
  if(!device)throw Error('Select the vehicle for charging history');
  const records:ProviderCharge[]=[];let after=from,done=false;
  for(let page=0;page<30;page++){
   const j=await gql('query($account:String!,$device:String!,$after:DateTime!,$before:DateTime!){devices(accountNumber:$account,deviceId:$device){... on SmartFlexVehicle{chargingSessions(after:$after,before:$before,first:100){pageInfo{hasNextPage endCursor} edges{node{start end energyAdded{value unit} cost{amount currency} ... on SmartFlexChargingSession{type}}}}}}}',{account:e.OCTOPUS_ACCOUNT_NUMBER,device:device.id,after,before:to},token);
   const connection=j.devices?.[0]?.chargingSessions;if(!connection)throw Error('Missing session history');
   records.push(...connection.edges.map((edge:{node:ProviderCharge})=>edge.node));
   if(!connection.pageInfo?.hasNextPage){done=true;break;}
   const cursor=Date.parse(connection.pageInfo.endCursor);if(!Number.isFinite(cursor)||cursor<Date.parse(after))throw Error('Invalid history pagination');after=new Date(cursor+1).toISOString();
  }
  if(!done)throw Error('Charging history truncated');
  const account=await json(`https://api.octopus.energy/v1/accounts/${encodeURIComponent(e.OCTOPUS_ACCOUNT_NUMBER)}/`,{headers:{Authorization:'Basic '+Buffer.from(e.OCTOPUS_API_KEY+':').toString('base64')}});
  const meters=account.properties.flatMap((p:{electricity_meter_points?:{is_export:boolean;agreements:Agreement[]}[]})=>(p.electricity_meter_points??[]).filter(m=>!m.is_export));
  // Never guess which home's tariff to use for an account with multiple import meters.
  const agreements:Agreement[]=meters.length===1?meters[0].agreements.filter((a:Agreement)=>Date.parse(a.valid_from)<Date.parse(to)&&(!a.valid_to||Date.parse(a.valid_to)>Date.parse(from))):[];
  const tariffs=await Promise.all(agreements.map(async a=>{try{return await tariff(a,from,to)}catch{return null}}));
  const unique=new Map(records.filter(s=>Date.parse(s.end)<=now.getTime()).map(s=>[`${s.start}/${s.end}`,s]));
  const sessions=[...unique.values()].map(s=>evaluateCharge(s,tariffs.filter(t=>t!==null))).filter(s=>s!==null).sort((a,b)=>b.start.localeCompare(a.start));
  const value:ChargingHistory={...base,status:'ready',sessions,message:'Octopus home charging sessions. Estimated costs use reported energy and the historical SMART rate, including VAT. Charging losses and standing charges are excluded. Session periods can include pauses. Provider history may lag.'};
  try{await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(value),{mode:0o600});await rename(file+'.tmp',file)}catch{value.message+=' Local history backup could not be saved.'}
  return value;
 }catch{
  try{const saved:ChargingHistory=JSON.parse(await readFile(/* turbopackIgnore: true */file,'utf8'));return {...saved,status:'stale',from,to,sessions:saved.sessions.filter(s=>Date.parse(s.start)>=Date.parse(from)),message:'Showing saved history. Octopus could not be refreshed; costs remain estimates.'}}catch{return {...base,status:'unavailable',message:'Octopus charging history could not be loaded. Please try again later.'}}
 }
}
export async function chargingHistory():Promise<ChargingHistory>{const state=cache.chargingHistoryCache??(cache.chargingHistoryCache={until:0});if(state.value&&state.until>Date.now())return state.value;if(!state.pending)state.pending=collect().then(value=>{state.value=value;state.until=Date.now()+(value.status==='ready'?3600000:60000);return value}).finally(()=>{state.pending=undefined});return state.pending;}
