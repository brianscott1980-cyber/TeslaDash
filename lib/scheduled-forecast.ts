import type {ChargeForecast,ForecastRate} from './charge-forecast';
export function scheduledForecast(input:{now:number;added:number;currentRate:number|null;smartRate:number|null;slots:{start:string;end:string;type:string;kwh:number|null}[];rates:ForecastRate[]}):ChargeForecast|null{
 const {now,added,currentRate,smartRate}=input;
 if(currentRate===null||!Number.isFinite(currentRate)||!Number.isFinite(added)||added<0)return null;
 let remaining=0,remainingKwh=0,finish=now;
 const slots=input.slots.filter(s=>Date.parse(s.end)>now).sort((a,b)=>a.start.localeCompare(b.start));
 if(!slots.length)return null;
 for(const s of slots){const from=Date.parse(s.start),end=Date.parse(s.end),start=Math.max(now,from);if(!Number.isFinite(from)||!Number.isFinite(end)||end<=start||s.kwh===null||!Number.isFinite(s.kwh)||s.kwh<0||start<finish)return null;const kwh=s.kwh*(end-start)/(end-from);remainingKwh+=kwh;
  if(s.type==='SMART'){if(smartRate===null||!Number.isFinite(smartRate))return null;remaining+=kwh*smartRate/100;}
  else{let cursor=start;for(const r of input.rates){const a=Date.parse(r.valid_from),b=r.valid_to?Date.parse(r.valid_to):Infinity;if(b<=cursor)continue;if(a>cursor)break;const until=Math.min(end,b);remaining+=kwh*(until-cursor)/(end-start)*r.value_inc_vat/100;cursor=until;if(cursor>=end)break;}if(cursor<end)return null;}
  finish=end;
 }
 const soFar=added/.9*currentRate/100;
 return {total:soFar+remaining,soFar,remaining,remainingKwh,finish:new Date(finish).toISOString(),efficiency:.9};
}
