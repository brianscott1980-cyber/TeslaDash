import test from 'node:test';
import assert from 'node:assert/strict';
import {updateDrive,driveTrip} from '../lib/journey-recorder-model.ts';
const base=Date.parse('2026-10-23T12:00:00Z');
const sample=(seconds,values={})=>({time:new Date(base+seconds*1000).toISOString(),gear:'D',speed:20,latitude:51.5,longitude:-.12+seconds*.00001,odometer:100+seconds*.001,powerKw:12,...values});
const apply=(store,s)=>updateDrive(store,s,Date.parse(s.time));
test('A drive survives restart, finishes only after confirmed parking, and records GPS, odometer and energy',()=>{
 let s=apply({trips:[]},sample(0,{gear:'P',speed:0,powerKw:0}));s=apply(s,sample(30));s=apply(s,sample(45));s=JSON.parse(JSON.stringify(s));s=apply(s,sample(60,{gear:'P',speed:0,powerKw:0}));assert.equal(s.trips.length,0);s=apply(s,sample(120,{gear:'P',speed:0,powerKw:0}));
 assert.equal(s.active,undefined);assert.equal(s.trips.length,1);const trip=s.trips[0];assert.ok(Math.abs(trip.miles-.06)<.0001);assert.ok(trip.coordinates.length>=3);assert.equal(trip.start,sample(0).time);assert.equal(trip.end,sample(60).time);assert.ok(Math.abs(trip.kwh-.125)<.00001);assert.equal(trip.energyBasis,'power-samples');
});
test('Traffic stops in Drive are not split into separate journeys; duplicates and stale readings do not advance it',()=>{
 let s=apply({trips:[]},sample(0));s=apply(s,sample(30,{speed:0}));s=apply(s,sample(90,{speed:0}));assert.ok(s.active);const duplicate=apply(s,sample(30));assert.deepEqual(duplicate,s);s=apply(s,sample(120));assert.equal(s.trips.length,0);
});
test('Missing power or GPS remains unknown instead of becoming a zero-energy or invented route',()=>{
 let s=apply({trips:[]},sample(0,{powerKw:undefined,latitude:undefined,longitude:undefined}));s=apply(s,sample(30,{powerKw:undefined,latitude:undefined,longitude:undefined}));const trip=driveTrip(s.active);assert.equal(trip.kwh,null);assert.deepEqual(trip.coordinates,[]);assert.equal(trip.partial,true);
});
test('Long gaps are flagged and never integrated as energy; regeneration stays signed',()=>{
 let s=apply({trips:[]},sample(0,{powerKw:-12}));s=apply(s,sample(15,{powerKw:-12}));s=apply(s,sample(300,{powerKw:100}));const t=driveTrip(s.active);assert.equal(t.energyTimeline.length,1);assert.equal(t.kwh,-.05);assert.equal(t.partial,true);assert.ok(t.coordinates.at(-1).gap);
 s=updateDrive(s,undefined,base+1000*1000);assert.equal(s.active,undefined);assert.equal(s.trips.length,1);assert.equal(s.trips[0].partial,true);
});
test('Implausible GPS jumps are not drawn as route segments',()=>{
 let s=apply({trips:[]},sample(0));s=apply(s,sample(15,{latitude:-20,longitude:130}));s=apply(s,sample(30));const trip=driveTrip(s.active);assert.equal(trip.coordinates.length,2);assert.equal(trip.partial,true);
});
