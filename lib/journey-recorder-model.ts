import type {Trip,JourneyEnergyInterval} from './data';
export type DriveSample={time:string;gear?:string|null;speed?:number;latitude?:number;longitude?:number;odometer?:number;powerKw?:number};
export type ActiveDrive={id:string;start:string;last:DriveSample;samples:DriveSample[];parkedAt?:string;partial:boolean};
export type JourneyStore={active?:ActiveDrive;previous?:DriveSample;trips:Trip[]};
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
export const hasGps=(s:DriveSample)=>finite(s.latitude)&&finite(s.longitude)&&Math.abs(s.latitude!)<=90&&Math.abs(s.longitude!)<=180;
export function gpsMiles(a:DriveSample,b:DriveSample){const r=Math.PI/180,dlat=(b.latitude!-a.latitude!)*r,dlon=(b.longitude!-a.longitude!)*r;const h=Math.sin(dlat/2)**2+Math.cos(a.latitude!*r)*Math.cos(b.latitude!*r)*Math.sin(dlon/2)**2;return 3958.7613*2*Math.asin(Math.sqrt(Math.min(1,h)));}
export function driveTrip(active:ActiveDrive,end=active.last.time):Trip{
 const samples=active.samples.filter(s=>Date.parse(s.time)<=Date.parse(end));
 const coordinates:NonNullable<Trip['coordinates']>=[],energyTimeline:JourneyEnergyInterval[]=[];let gpsDistance=0,partial=active.partial;
 for(let i=0;i<samples.length;i++){
  const s=samples[i],prev=samples[i-1],seconds=prev?(Date.parse(s.time)-Date.parse(prev.time))/1000:0;
  if(prev&&seconds>90)partial=true;
  if(prev&&seconds>0&&seconds<=60&&finite(prev.powerKw)&&finite(s.powerKw))energyTimeline.push({start:prev.time,end:s.time,kwh:(prev.powerKw+s.powerKw)/2*seconds/3600});
  if(hasGps(s)){const last=coordinates.at(-1),distance=last?gpsMiles(last,s):0,delta=last?(Date.parse(s.time)-Date.parse(last.time))/1000:0;
   if(last&&delta>0&&distance>Math.max(.2,delta/3600*160)){partial=true;continue;}
   const gap=!!last&&delta>90;if(gap)partial=true;else gpsDistance+=distance;
   if(!last||distance>.002||s.time===end)coordinates.push({latitude:s.latitude!,longitude:s.longitude!,time:s.time,gap});
  }
 }
 const odometers=samples.filter(s=>finite(s.odometer)&&s.odometer!>=0),distance=odometers.length>=2?odometers.at(-1)!.odometer!-odometers[0].odometer!:null;
 const validDistance=distance!==null&&distance>=0&&distance<2000;
 return {id:active.id,date:new Date(active.start).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),from:'Start of drive',to:'End of drive',start:active.start,end,miles:validDistance?distance:gpsDistance,distanceBasis:validDistance?'odometer':'gps-estimate',kwh:energyTimeline.length?energyTimeline.reduce((sum,s)=>sum+s.kwh,0):null,energyBasis:energyTimeline.length?'power-samples':undefined,energyTimeline,coordinates,partial:partial||coordinates.length<2};
}
export function updateDrive(store:JourneyStore,sample?:DriveSample,now=Date.now()):JourneyStore{
 const next:JourneyStore={trips:[...store.trips],previous:store.previous,active:store.active?{...store.active,samples:[...store.active.samples]}:undefined};
 const finish=(end:string,incomplete=false)=>{if(!next.active)return;const trip=driveTrip({...next.active,partial:next.active.partial||incomplete},end);if(trip.miles>=.03||trip.coordinates!.length>=3)next.trips=[trip,...next.trips.filter(t=>t.id!==trip.id)].slice(0,1000);next.active=undefined;};
 if(!sample){if(next.active&&now-Date.parse(next.active.last.time)>10*60000)finish(next.active.parkedAt??next.active.last.time,true);return next;}
 const time=Date.parse(sample.time);if(!Number.isFinite(time)||time>now+30000||time<=Date.parse(next.active?.last.time??next.previous?.time??''))return next;
 const driving=sample.gear==='D'||sample.gear==='R'||(finite(sample.speed)&&sample.speed>1);
 if(!next.active&&driving){const previous=next.previous&&time-Date.parse(next.previous.time)<=90000?next.previous:undefined;next.active={id:'drive-'+time,start:previous?.time??sample.time,last:sample,samples:previous?[previous,sample]:[sample],partial:!previous};}
 else if(next.active){const active=next.active;active.last=sample;
  if(driving){active.parkedAt=undefined;active.samples.push(sample);}
  else if(sample.gear==='P'){if(!active.parkedAt){active.parkedAt=sample.time;active.samples.push(sample);}else if(time-Date.parse(active.parkedAt)>=60000)finish(active.parkedAt);}
  else {active.samples.push(sample);if(time-Date.parse(active.samples.filter(s=>s.gear==='D'||s.gear==='R'||(s.speed??0)>1).at(-1)?.time??active.start)>5*60000)finish(sample.time,true);}
 }
 next.previous=sample;return next;
}
