export type ForecastRate={valid_from:string;valid_to:string|null;value_inc_vat:number};
export type ChargeForecast={total:number;soFar:number;remaining:number;remainingKwh:number;finish:string;efficiency:number};
export function forecastCharge(input:{now:number;added:number;power:number;hours:number;currentRate:number|null;rates:ForecastRate[];efficiency?:number}):ChargeForecast|null{
 const {now,added,power,hours,currentRate,rates}=input;const efficiency=input.efficiency??0.9;
 if(![now,added,power,hours,efficiency].every(Number.isFinite)||currentRate===null||!Number.isFinite(currentRate)||added<0||power<=0||hours<=0||hours>48||efficiency<=0||efficiency>1)return null;
 const end=now+hours*3600000;let cursor=now,remaining=0;
 const sorted=[...rates].sort((a,b)=>Date.parse(a.valid_from)-Date.parse(b.valid_from));
 for(const r of sorted){const from=Date.parse(r.valid_from),to=r.valid_to?Date.parse(r.valid_to):Infinity;if(!Number.isFinite(from)||!Number.isFinite(r.value_inc_vat)||to<=cursor)continue;if(from>cursor)break;const until=Math.min(end,to);remaining+=power*(until-cursor)/3600000*r.value_inc_vat/100;cursor=until;if(cursor>=end)break;}
 if(cursor<end)return null;
 const soFar=added/efficiency*currentRate/100;
 return {total:soFar+remaining,soFar,remaining,remainingKwh:power*hours,finish:new Date(end).toISOString(),efficiency};
}
