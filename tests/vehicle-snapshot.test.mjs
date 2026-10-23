import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyVehicleValues,mergeVehicleSnapshot,recordedVehicle,chargeStateRanges} from '../lib/vehicle-snapshot.ts';
const time='2026-10-23T07:19:57.006Z';
test('Rated and real-world ranges are separate Tesla readings, without a rated-range fallback',()=>{
 assert.deepEqual(chargeStateRanges({battery_range:244.2,est_battery_range:201.6}),{range:244.2,realWorldRange:201.6});
 assert.deepEqual(chargeStateRanges({battery_range:244.2}),{range:244.2});
 assert.deepEqual(chargeStateRanges({battery_range:null,est_battery_range:0}),{realWorldRange:0});
 assert.deepEqual(chargeStateRanges({battery_range:NaN,est_battery_range:-1}),{});
 const saved=mergeVehicleSnapshot(undefined,chargeStateRanges({battery_range:244.2,est_battery_range:201.6}),time);
 const next=mergeVehicleSnapshot(saved,chargeStateRanges({battery_range:240}), '2026-10-23T08:00:00Z');
 assert.equal(next.values.realWorldRange,201.6);assert.equal(next.observedAt.realWorldRange,time);assert.equal(next.values.range,240);
 const recovered=recordedVehicle([{metric:{__name__:'tesladash_real_world_range_miles'},values:[[1792739997.006,'201.6']]}]);
 assert.equal(recovered.values.realWorldRange,201.6);assert.equal(recovered.observedAt.realWorldRange,time);
});
test('Sleeping or failed polls cannot replace last known readings with placeholder zeroes',()=>{
 const first=mergeVehicleSnapshot(undefined,{name:'Kitt',odometer:39690,battery:98,locked:true},time);
 const asleep={demo:false,state:'Unavailable',odometer:0,battery:0,name:'Your Tesla'};
 assert.deepEqual(mergeVehicleSnapshot(first,legacyVehicleValues(asleep),'2026-10-23T10:00:00Z'),first);
 assert.deepEqual(legacyVehicleValues({...asleep,demo:true,state:'Charging'}),{});
});
test('Partial updates preserve per-field reading times and legitimate zero or false',()=>{
 const first=mergeVehicleSnapshot(undefined,{odometer:39690,battery:98,locked:true},time);
 const next=mergeVehicleSnapshot(first,{battery:0,locked:false,software:undefined},'2026-10-23T08:00:00Z');
 assert.equal(next.values.odometer,39690);assert.equal(next.observedAt.odometer,time);
 assert.equal(next.values.battery,0);assert.equal(next.values.locked,false);
 assert.equal(next.observedAt.battery,'2026-10-23T08:00:00Z');
});
test('Old, malformed and missing measurements do not overwrite newer observations',()=>{
 const first=mergeVehicleSnapshot(undefined,{battery:98,temperature:-3,software:'2026.32'},time);
 assert.deepEqual(mergeVehicleSnapshot(first,{battery:40},'2026-10-22T00:00:00Z'),first);
 assert.deepEqual(mergeVehicleSnapshot(first,{battery:101,odometer:NaN,software:'—',temperature:null},time),first);
 assert.deepEqual(mergeVehicleSnapshot(first,{battery:50},'not-a-date'),first);
});
test('History recovery uses actual sample timestamps and never query time or missing zeros',()=>{
 const result=recordedVehicle([{metric:{__name__:'tesladash_odometer_miles'},values:[[1792739997.006,'39690.240268'],[1792700000,'39600']]},{metric:{__name__:'tesladash_battery_percent'},values:[[1792739997.006,'98']]},{metric:{__name__:'tesladash_range_miles'},values:[[1792739997.006,'NaN']]}]);
 assert.equal(result.values.odometer,39690.240268);assert.equal(result.observedAt.odometer,time);assert.equal(result.values.battery,98);assert.equal(result.values.range,undefined);
});
