import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledForecast} from '../lib/scheduled-forecast.ts';
const now=Date.parse('2026-10-23T00:30:00Z');
const base={now,added:9,currentRate:6.6,smartRate:6.6,rates:[{valid_from:'2026-10-23T00:00:00Z',valid_to:null,value_inc_vat:35}]};
test('Schedule forecast respects pauses and SMART energy outside overnight window',()=>{
 const r=scheduledForecast({...base,slots:[{start:'2026-10-23T00:00:00Z',end:'2026-10-23T01:00:00Z',type:'SMART',kwh:7},{start:'2026-10-23T06:30:00Z',end:'2026-10-23T07:00:00Z',type:'SMART',kwh:3.5}]});
 assert.equal(r.remainingKwh,7);assert.ok(Math.abs(r.remaining-.462)<1e-10);assert.equal(r.finish,'2026-10-23T07:00:00.000Z');
});
test('Boost slots use published tariff rather than SMART discount',()=>{
 const r=scheduledForecast({...base,slots:[{start:'2026-10-23T06:30:00Z',end:'2026-10-23T07:00:00Z',type:'BOOST',kwh:3.5}]});assert.ok(Math.abs(r.remaining-1.225)<1e-10);
});
test('Missing energy and overlapping plans suppress unreliable predictions',()=>{
 const slot={start:'2026-10-23T06:30:00Z',end:'2026-10-23T07:00:00Z',type:'SMART',kwh:3.5};assert.equal(scheduledForecast({...base,slots:[{...slot,kwh:null}]}),null);assert.equal(scheduledForecast({...base,slots:[slot,slot]}),null);
});
