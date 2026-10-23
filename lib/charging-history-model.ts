import type {Rate} from './octopus';
export type ChargerCategory='Home'|'Supercharger'|'Fast public'|'Slow public';
export type HistoricalCharge={id:string;start:string;end:string;kwh:number|null;cost:number|null;costBasis:'estimated'|'provider'|'unavailable';type:string;location:string;category?:ChargerCategory;tariff?:string};
export function classifyCharge(s:{type?:string;location?:string;kwh?:number|null;start?:string;end?:string;powerKw?:number|null}):ChargerCategory{
 const t=(s.type||'').toLowerCase(),loc=(s.location||'').toLowerCase();
 if(t.includes('supercharger')||loc.includes('supercharger')||t==='supercharge')return 'Supercharger';
 if(t.includes('fast')||t.includes('rapid')||t.includes('ultra')||t.includes('ccs')||t.includes('dc')||loc.includes('fast public')||loc.includes('rapid')||loc.includes('ultra')||loc.includes('instavolt')||loc.includes('ionity')||loc.includes('gridserve')||loc.includes('osprey'))return 'Fast public';
 if(t.includes('slow')||t.includes('destination')||loc.includes('slow public')||loc.includes('pod point')||(loc.includes('public')&&!t.includes('fast')&&!t.includes('rapid')))return 'Slow public';
 if(t.includes('smart')||t.includes('home')||t.includes('off-peak')||loc.includes('home')||loc.includes('octopus'))return 'Home';
 if(s.powerKw!=null){
  if(s.powerKw>=22)return 'Fast public';
  if(s.powerKw>0&&loc&&!loc.includes('home')&&loc!=='unknown')return 'Slow public';
 }
 if(s.kwh&&s.start&&s.end){
  const hours=(Date.parse(s.end)-Date.parse(s.start))/3600000;
  if(hours>0){
   const avgKw=s.kwh/hours;
   if(avgKw>=22)return 'Fast public';
   if(loc&&!loc.includes('home')&&loc!=='unknown')return 'Slow public';
  }
 }
 return 'Home';
}
export type ChargingHistory={status:'ready'|'unavailable'|'unconfigured'|'stale';from:string;to:string;updated:string;sessions:HistoricalCharge[];message?:string};
export type HistoricalTariff={code:string;from:string;to:string|null;rates:Rate[];smartRates:Rate[]};
export type ProviderCharge={start:string;end:string;type?:string;energyAdded?:{value:string|null;unit:string}|null;cost?:{amount:string;currency:string}|null};
const numeric=(n:unknown)=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Number(n):null;
export function sixMonthsAgo(now:Date){const d=new Date(now);const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-6);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString();}
export function evaluateCharge(s:ProviderCharge,tariffs:HistoricalTariff[]):HistoricalCharge|null{
 const start=Date.parse(s.start),end=Date.parse(s.end);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return null;
 const raw=numeric(s.energyAdded?.value);
 const kwh=raw!==null&&raw>=0?(s.energyAdded?.unit==='KILOWATT_HOUR'?raw:s.energyAdded?.unit==='WATT_HOUR'?raw/1000:null):null;
 const result:HistoricalCharge={id:`${s.start}/${s.end}`,start:s.start,end:s.end,kwh,cost:null,costBasis:'unavailable',type:s.type??'Unknown',location:'Home / Octopus'};
 result.category=classifyCharge(result);
 const provider=numeric(s.cost?.amount);
 if(provider!==null&&provider>=0&&s.cost?.currency==='GBP'){result.cost=provider;result.costBasis='provider';return result;}
 const tariff=tariffs.find(t=>Date.parse(t.from)<=start&&(!t.to||Date.parse(t.to)>=end));
 if(!tariff||kwh===null)return result;
 result.tariff=tariff.code;
 // SMART sessions qualify for the historical intelligent off-peak rate.
 // No dispatch energy split means BOOST / mixed sessions cannot be priced reliably.
 if(s.type!=='SMART'||!/(INTELLI|IOG)/.test(tariff.code))return result;
 const overlapping=tariff.smartRates.filter(r=>Date.parse(r.valid_from)<end&&(!r.valid_to||Date.parse(r.valid_to)>start));
 const nextNight=tariff.smartRates.filter(r=>Date.parse(r.valid_from)>=start&&Date.parse(r.valid_from)<start+86400000).sort((a,b)=>a.valid_from.localeCompare(b.valid_from))[0];
 const candidates=overlapping.length?overlapping:nextNight?[nextNight]:[];
 const values=[...new Set(candidates.map(r=>r.value_inc_vat))];
 if(values.length!==1||!Number.isFinite(values[0]))return result;
 result.cost=kwh*values[0]/100;result.costBasis='estimated';return result;
}
export function filterCharges<T extends {start?:string}>(rows:T[],period:string,now=new Date()):T[]{
 const uk=(date:Date)=>date.toLocaleDateString('en-CA',{timeZone:'Europe/London'});
 return rows.filter(s=>{if(!s.start)return true;const dt=new Date(s.start);if(period==='Today')return uk(dt)===uk(now);if(period==='This week')return dt.getTime()>=now.getTime()-7*86400000;if(period==='This month')return uk(dt).slice(0,7)===uk(now).slice(0,7);return dt.getTime()>=Date.parse(sixMonthsAgo(now));});
}
