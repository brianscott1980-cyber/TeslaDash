import test from 'node:test';
import assert from 'node:assert/strict';
import {liveJourneyFacts} from '../lib/journey-facts.ts';
const start='2026-10-23T12:00:00Z',end='2026-10-23T12:10:00Z',now=Date.parse(end);
const trip={date:'Today',from:'Start',to:'Destination',start,end,miles:10,kwh:2.5,energyTimeline:[{start,end,kwh:2.5}]};
const live={trip,sample:{time:end,gear:'D',navigation:{destination:'Destination',minutesRemaining:20,milesRemaining:20}},driving:true,paused:false};
const charges=[{id:'one',start:'2026-10-22T12:00:00Z',end:'2026-10-22T14:00:00Z',kwh:20,cost:2,costBasis:'provider',type:'SMART',location:'Home'}];
test('Live estimate prices measured energy using historical charging and projects the navigation distance',()=>{
 const x=liveJourneyFacts(live,charges,now);assert.equal(x.costSoFar,.25);assert.equal(x.predictedCost,.75);assert.equal(x.predictedKwh,7.5);assert.equal(x.remainingMinutes,20);assert.equal(x.arrivalTime,'2026-10-23T12:30:00.000Z');
});
test('Navigation countdown preserves the reported arrival time and expires when stale',()=>{
 const x=liveJourneyFacts(live,charges,now+60000);assert.equal(x.remainingMinutes,19);assert.equal(x.arrivalTime,'2026-10-23T12:30:00.000Z');
 const stale=liveJourneyFacts(live,charges,now+180000);assert.equal(stale.fresh,false);assert.equal(stale.remainingMinutes,null);assert.equal(stale.predictedCost,null);assert.equal(stale.costSoFar,.25);
});
test('Missing navigation, price, energy or sufficient coverage never becomes a fabricated prediction',()=>{
 assert.equal(liveJourneyFacts({...live,sample:{time:end}},charges,now).predictedCost,null);
 assert.equal(liveJourneyFacts(live,[],now).predictedCost,null);
 for(const change of [{kwh:null},{miles:0},{energyTimeline:[]},{energyTimeline:[{start,end:'2026-10-23T12:01:00Z',kwh:.1}]}])assert.equal(liveJourneyFacts({...live,trip:{...trip,...change}},charges,now).predictedCost,null);
 assert.equal(liveJourneyFacts({...live,driving:false},charges,now).predictedCost,null);
});

test('Known public charging prevents substituting an Octopus price for an unpriced public stop',()=>{
 const x=liveJourneyFacts({...live,trip:{...trip,publicChargeStop:true}},charges,now);assert.equal(x.costSoFar,null);assert.equal(x.predictedCost,null);
});
test('Known parking time is excluded from the driving coverage used for prediction',()=>{
 const longer={...trip,start:'2026-10-23T11:40:00Z',drivingSeconds:600};assert.equal(liveJourneyFacts({...live,trip:longer},charges,now).predictedCost,.75);
});
