import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastCharge} from '../lib/charge-forecast.ts';
const now=Date.parse('2026-10-23T03:30:00Z');
const base={now,added:9,power:7,hours:2,currentRate:6.6,efficiency:.9};
test('Forecast splits remaining energy across a tariff change',()=>{
 const r=forecastCharge({...base,rates:[{valid_from:'2026-10-23T00:00:00Z',valid_to:'2026-10-23T04:30:00Z',value_inc_vat:6.6},{valid_from:'2026-10-23T04:30:00Z',valid_to:null,value_inc_vat:35}]});
 assert.ok(Math.abs(r.soFar-.66)<1e-10);assert.ok(Math.abs(r.remaining-2.912)<1e-10);assert.ok(Math.abs(r.total-3.572)<1e-10);assert.equal(r.remainingKwh,14);
});
test('Missing future rates do not silently underprice the session',()=>{assert.equal(forecastCharge({...base,rates:[{valid_from:'2026-10-23T00:00:00Z',valid_to:'2026-10-23T04:30:00Z',value_inc_vat:6.6}]}),null)});
test('Unknown rate and missing charging power suppress the prediction',()=>{assert.equal(forecastCharge({...base,currentRate:null,rates:[]}),null);assert.equal(forecastCharge({...base,power:0,rates:[]}),null)});
