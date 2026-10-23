import test from 'node:test';
import assert from 'node:assert/strict';
import {offPeak,expandIntelligentRates} from '../lib/octopus.ts';
const rate=value=>[{valid_from:'2026-01-01T00:00:00Z',valid_to:null,value_inc_vat:value}];
test('Intelligent Go uses UK local boundaries in summer and winter',()=>{
 for(const [time,expected] of [['2026-10-22T22:00:00Z',false],['2026-10-22T22:30:00Z',true],['2026-10-23T04:00:00Z',true],['2026-10-23T04:30:00Z',false],['2026-12-01T23:00:00Z',false],['2026-12-01T23:30:00Z',true],['2026-12-02T05:30:00Z',false]])assert.equal(offPeak(Date.parse(time)),expected,time);
});
test('Autumn DST repeated half-hours retain unique absolute intervals',()=>{
 const slots=expandIntelligentRates(rate(35),rate(6.6),Date.parse('2026-10-24T23:00:00Z'),Date.parse('2026-10-26T00:00:00Z'));
 assert.equal(slots.length,50);assert.equal(new Set(slots.map(s=>s.valid_from)).size,50);assert.equal(slots.filter(s=>s.value_inc_vat===6.6).length,14);
});
test('Missing night prices are omitted, never treated as free electricity',()=>{
 const slots=expandIntelligentRates(rate(35),[],Date.parse('2026-12-01T00:00:00Z'),Date.parse('2026-12-02T00:00:00Z'));
 assert.equal(slots.length,36);assert.ok(slots.every(s=>s.value_inc_vat===35));
});
