import test from 'node:test';
import assert from 'node:assert/strict';
import {drivingJourneyKey} from '../lib/journey-live.ts';
const now=Date.parse('2026-10-23T12:00:00Z');
const feed=(id,time=now,driving=true)=>({trips:[],live:{trip:{id},sample:{time:new Date(time).toISOString()},driving},tracking:{status:'needs-permission'}});
test('Each fresh drive has its own focus key, including energy-only drives before GPS consent',()=>{
 assert.equal(drivingJourneyKey(feed('one'),now),'one');assert.equal(drivingJourneyKey(feed('two'),now),'two');
 assert.equal(drivingJourneyKey(feed('one',now,false),now),null);assert.equal(drivingJourneyKey(null,now),null);
});
test('Stale or implausibly future readings cannot trigger automatic driving focus',()=>{
 assert.equal(drivingJourneyKey(feed('one',now-150001),now),null);assert.equal(drivingJourneyKey(feed('one',now+30001),now),null);assert.equal(drivingJourneyKey(feed('one',now-150000),now),'one');
});
