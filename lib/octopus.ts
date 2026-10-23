export type Rate={valid_from:string;valid_to:string|null;value_inc_vat:number};
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function offPeak(t:number){const [h,m]=clock.format(new Date(t)).split(':').map(Number);return h*60+m>=1410||h*60+m<330;}
export function expandIntelligentRates(day:Rate[],night:Rate[],from:number,to:number):Rate[]{
 const result:Rate[]=[];
 for(let t=Math.floor(from/1800000)*1800000;t<to;t+=1800000){const source=offPeak(t)?night:day;const r=source.find(r=>Date.parse(r.valid_from)<=t&&(!r.valid_to||Date.parse(r.valid_to)>t));if(r)result.push({valid_from:new Date(t).toISOString(),valid_to:new Date(t+1800000).toISOString(),value_inc_vat:r.value_inc_vat});}
 return result;
}
