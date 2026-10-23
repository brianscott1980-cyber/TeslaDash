import type {Trip,JourneyEnergyInterval} from './data';
import type {HistoricalCharge} from './charging-history-model';
export function latestJourneyIndex(trips:Trip[],now=Date.now()){
 if(!trips.length)return -1;
 let index=-1,latest=-Infinity;
 trips.forEach((trip,i)=>{const t=Date.parse(trip.end??trip.start??'');if(Number.isFinite(t)&&t<=now&&t>latest){latest=t;index=i}});
 if(index===-1)index=trips.findIndex(trip=>!trip.end&&!trip.start);
 return index;
}
export function journeyCost(trip:Trip|undefined,charges:HistoricalCharge[]){
 if(!trip)return null;
 if(trip.costGbp!==undefined&&Number.isFinite(trip.costGbp)&&trip.costGbp>=0)return {value:trip.costGbp,basis:trip.costBasis??'estimated',explanation:'Cost supplied with the journey record.'};
 if(trip.publicChargeStop)return null;
 const start=Date.parse(trip.start??'');if(!Number.isFinite(start)||trip.kwh===null||!Number.isFinite(trip.kwh)||trip.kwh<0)return null;
 const charge=charges.filter(c=>c.kwh!==null&&c.kwh>0&&Date.parse(c.end)<=start).sort((a,b)=>Date.parse(b.end)-Date.parse(a.end))[0];
 if(!charge||charge.cost===null)return null;
 return {value:trip.kwh*charge.cost/charge.kwh!,basis:'estimated' as const,explanation:'Estimated using journey energy and the preceding recorded charge’s unit cost. Battery energy may come from several charges; charging losses are excluded.'};
}
export function journeyIntervals(trip:Trip|undefined):JourneyEnergyInterval[]{
 if(!trip)return [];
 const start=Date.parse(trip.start??''),end=Date.parse(trip.end??'');
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];
 const intervals=(trip.energyTimeline??[]).filter(s=>Number.isFinite(s.kwh)&&Date.parse(s.start)>=start&&Date.parse(s.end)<=end&&Date.parse(s.end)>Date.parse(s.start)).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
 if(intervals.some((s,i)=>i>0&&Date.parse(s.start)<Date.parse(intervals[i-1].end)))return [];
 return intervals;
}

import type {LiveJourney} from './journey-live';
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
export function liveJourneyFacts(live:LiveJourney,charges:HistoricalCharge[],now=Date.now()){
 const trip=live.trip,age=now-Date.parse(live.sample.time),fresh=finite(age)&&age>=-30000&&age<=150000;
 const elapsed=Math.max(0,(Date.parse(trip.end??live.sample.time)-Date.parse(trip.start??''))/60000);
 const cost=journeyCost(trip,charges);
 const nav=live.sample.navigation;
 const remaining=fresh&&finite(nav?.minutesRemaining)&&nav.minutesRemaining>=0&&nav.minutesRemaining<1440?Math.max(0,nav.minutesRemaining-Math.max(0,age)/60000):null;
 const milesRemaining=fresh&&finite(nav?.milesRemaining)&&nav.milesRemaining>=0&&nav.milesRemaining<3000?nav.milesRemaining:null;
 const coverage=(trip.energyTimeline??[]).reduce((sum,x)=>sum+Math.max(0,Date.parse(x.end)-Date.parse(x.start)),0)/60000;
 const drivingMinutes=(trip.drivingSeconds??elapsed*60)/60;
 const canPredict=fresh&&live.driving&&trip.kwh!==null&&trip.kwh>0&&trip.miles>=1&&drivingMinutes>=1&&coverage/drivingMinutes>=.75&&milesRemaining!==null;
 const predictedKwh=canPredict?trip.kwh!*(1+milesRemaining!/trip.miles):null;
 const predictedCost=predictedKwh!==null&&cost&&trip.kwh!>0?predictedKwh*cost.value/trip.kwh!:null;
 return {fresh,elapsedMinutes:finite(elapsed)?elapsed:null,costSoFar:cost?.value??null,costExplanation:cost?.explanation,remainingMinutes:remaining,arrivalTime:remaining!==null?new Date(now+remaining*60000).toISOString():null,milesRemaining,predictedKwh,predictedCost,coverageMinutes:coverage};
}
