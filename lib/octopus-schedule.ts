import 'server-only';
export type SmartSlot={start:string;end:string;type:string;kwh:number|null};
export type SmartSchedule={status:'ready'|'unavailable'|'unconfigured';device?:string;slots:SmartSlot[];updated:string};
let cached:{until:number;value:SmartSchedule}|undefined;
let auth:{key:string;token:string;until:number}|undefined;
async function query(query:string,variables:Record<string,string>,token?:string){
 const r=await fetch('https://api.octopus.energy/v1/graphql/',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:token}:{})},body:JSON.stringify({query,variables}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Octopus schedule unavailable');const j=await r.json();if(j.errors?.length||!j.data)throw Error('Octopus schedule unavailable');return j.data;
}
export async function smartSchedule():Promise<SmartSchedule>{
 const e=process.env;const updated=new Date().toISOString();
 if(!e.OCTOPUS_API_KEY||!e.OCTOPUS_ACCOUNT_NUMBER)return {status:'unconfigured',slots:[],updated};
 if(cached&&cached.until>Date.now())return cached.value;
 try{
  if(!auth||auth.key!==e.OCTOPUS_API_KEY||auth.until<Date.now()){const j=await query('mutation($key:String!){obtainKrakenToken(input:{APIKey:$key}){token}}',{key:e.OCTOPUS_API_KEY});auth={key:e.OCTOPUS_API_KEY,token:j.obtainKrakenToken.token,until:Date.now()+15*60000};}
  const j=await query('query($account:String!){devices(accountNumber:$account){id name deviceType integrationDeviceId}}',{account:e.OCTOPUS_ACCOUNT_NUMBER},auth.token);
  const devices=j.devices.filter((v:{deviceType:string})=>['ELECTRIC_VEHICLES','CHARGE_POINTS'].includes(v.deviceType));
  const selected=devices.find((v:{id:string;integrationDeviceId:string})=>v.id===e.OCTOPUS_DEVICE_ID||v.integrationDeviceId===e.TESLA_VIN)??(devices.length===1?devices[0]:undefined);
  if(!selected)throw Error('Select an Octopus device');
  const result=await query('query($device:String!){flexPlannedDispatches(deviceId:$device){start end type energyAddedKwh}}',{device:selected.id},auth.token);
  if(!Array.isArray(result.flexPlannedDispatches))throw Error('Missing dispatch response');
  const slots:SmartSlot[]=result.flexPlannedDispatches.filter((s:{start:string;end:string})=>Date.parse(s.end)>Date.parse(s.start)).map((s:{start:string;end:string;type:string;energyAddedKwh:string|null})=>({start:s.start,end:s.end,type:s.type,kwh:s.energyAddedKwh!==null&&Number.isFinite(Number(s.energyAddedKwh))?Math.abs(Number(s.energyAddedKwh)):null})).sort((a:SmartSlot,b:SmartSlot)=>a.start.localeCompare(b.start));
  const value:SmartSchedule={status:'ready',device:selected.name,slots,updated};cached={until:Date.now()+60000,value};return value;
 }catch{auth=undefined;return {status:'unavailable',slots:[],updated};}
}
