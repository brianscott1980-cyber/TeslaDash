'use client';
import {Battery,Gauge,ShieldCheck,Thermometer} from 'lucide-react';
import type {Dashboard} from '../../lib/data';
import {legacyVehicleValues,type VehicleValues} from '../../lib/vehicle-snapshot';

const readingTime=(value?:string)=>value?new Date(value).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Not recorded yet';
export function VehicleView({data:d}:{data:Dashboard}){
 const values=d.vehicle?.values??legacyVehicleValues(d),times=d.vehicle?.observedAt??{};
 const latest=Object.entries(times).filter(([key])=>!['name','vin','model','paint','wheels'].includes(key)).map(([,time])=>time!).sort().at(-1);
 const saved=d.state==='Unavailable'||(!!latest&&Date.now()-Date.parse(latest)>180000);
 const name=values.name??(d.name!=='Your Tesla'?d.name:'Your Tesla');
 const number=(key:keyof VehicleValues,digits=0)=>typeof values[key]==='number'?(values[key] as number).toLocaleString('en-GB',{maximumFractionDigits:digits}):'—';
 const rows:[string,React.ReactNode,(keyof VehicleValues)?][]=[['Name',name,'name'],['Model','Model 3'],['Battery chemistry','LFP · saved vehicle description'],['Software',values.software??'Not recorded yet','software'],['Vehicle identification',values.vin??'Not recorded yet','vin'],['Door locks',values.locked===undefined?'Not recorded yet':values.locked?'Locked':'Unlocked','locked'],['Sentry mode',values.sentry===undefined?'Not recorded yet':values.sentry?'Enabled':'Disabled','sentry']];
 return <div className="vehicle-page">
  <div className="vehicle-reading-note"><span className="tiny-dot"/><strong>{saved?'Last known vehicle readings':'Vehicle readings'}</strong><span>{latest?`Recorded ${readingTime(latest)} / UK time`:'Waiting for the first vehicle reading'}</span><small>{saved?'Readings stay available while your car sleeps. No wake-up requested.':'Details are saved automatically after successful vehicle readings.'}</small><a className="connection-link" href="/connect/tesla">Tesla connection →</a></div>
  <div className="vehicle-profile-grid"><section className="panel vehicle"><div className="panel-top"><div><span className="eyebrow">YOUR VEHICLE</span><h2>{name}</h2><p>Model 3 <span className="car-spec-divider">/</span> LFP <span className="car-spec-divider">/</span> Deep Blue Metallic</p></div><span className="badge">{d.vehicleConnection==='asleep'?'Asleep':d.vehicleConnection==='offline'?'Offline':saved?'Saved readings':'Connected'}</span></div><div className="vehicle-render"><img src="/vehicles/kitt-deep-blue.png" className="tesla-render" alt="Deep Blue Model 3 with black trim, satin-black alloys and tinted rear windows"/></div></section>
  <section className="vehicle-facts" aria-label="Last known vehicle statistics">{[
   {key:'odometer' as const,label:'Odometer',value:number('odometer'),unit:'mi',Icon:Gauge},
   {key:'battery' as const,label:'Battery level',value:number('battery'),unit:'%',Icon:Battery},
   {key:'range' as const,label:'Rated range',value:number('range',1),unit:'mi',Icon:ShieldCheck},
   {key:'temperature' as const,label:'Cabin temperature',value:number('temperature',1),unit:'°C',Icon:Thermometer}
  ].map(({key,label,value,unit,Icon})=>key==='range'?<div className="panel metric range-metric" key={key}><span>Range remaining<Icon size={17}/></span><div className="range-pair"><div><span>Rated range</span><strong>{value} <em>mi</em></strong><small>{readingTime(times.range)}</small></div><div title="Tesla’s estimate takes driving conditions into account."><span>Real-world estimate</span><strong>{number('realWorldRange',1)} <em>mi</em></strong><small>{times.realWorldRange?readingTime(times.realWorldRange):'Awaiting Tesla estimate'}</small></div></div></div>:<div className="panel metric" key={key}><span>{label}<Icon size={17}/></span><strong>{value} <em>{unit}</em></strong><small>{readingTime(times[key])}</small></div>)}</section></div>
  <div className="vehicle-information-grid">
   <section className="panel details"><span className="eyebrow">THE ESSENTIALS</span><h3>Vehicle details</h3>{rows.map(([label,value,key])=><div key={label} title={key?readingTime(times[key]):'Saved vehicle description'}><span>{label}</span><strong>{value}</strong></div>)}</section>
   <section className="panel details"><span className="eyebrow">BATTERY & TYRES</span><h3>Condition insights</h3><div><span>Battery health</span><strong>Not measured</strong></div><p className="vehicle-insight-note">Battery health needs capacity measurements and an original-capacity baseline. Your current recordings contain neither. Battery level and range are shown separately.</p><div className="tyre-grid">{([['Front left','tyreFL'],['Front right','tyreFR'],['Rear left','tyreRL'],['Rear right','tyreRR']] as const).map(([label,key])=><div key={key} title={readingTime(times[key])}><span>{label}</span><strong>{values[key]!==undefined?`${number(key,2)} bar`:'Not recorded'}</strong></div>)}</div><p className="vehicle-insight-note">Tyre pressures, locks and Sentry mode appear after Tesla supplies them. These are last observed readings.</p></section>
   <section className="panel details personal-details"><span className="eyebrow">MADE YOURS</span><h3>Your finishing touches</h3><div><span>Paint</span><strong>Deep Blue Metallic</strong></div><div><span>Trim</span><strong>Black exterior trim</strong></div><div><span>Wheels</span><strong>Satin-black alloys</strong></div><div><span>Glass</span><strong>Rear privacy tint</strong></div><p>Appearance and battery chemistry reflect your saved vehicle description.</p></section>
  </div>
 </div>;
}
