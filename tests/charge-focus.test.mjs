import test from 'node:test';
import assert from 'node:assert/strict';
import {chargeFocus} from '../lib/charge-focus.ts';
const session=(start,end,kwh=10)=>({id:start,start,end,kwh,cost:1,costBasis:'estimated',type:'SMART',location:'Home'});
const now=Date.parse('2026-10-23T10:00:00Z');
const completed=session('2026-10-22T20:00:00Z','2026-10-23T07:00:00Z');
test('Live charging takes priority over the last completed session',()=>{assert.equal(chargeFocus('Charging',[completed],now).active,true);assert.equal(chargeFocus('Stopped',[completed],now).active,false);});
test('Last charge uses latest completion, independent of input ordering or a newer zero-energy plug-in',()=>{const older=session('2026-10-21T20:00:00Z','2026-10-22T07:00:00Z');const zero=session('2026-10-23T08:00:00Z','2026-10-23T09:00:00Z',0);assert.equal(chargeFocus('Complete',[completed,zero,older],now).last,completed);});
test('Ongoing, future and malformed periods are excluded; unavailable vehicle retains completed history',()=>{const active=session('2026-10-23T09:00:00Z','2026-10-23T11:00:00Z');const malformed=session('invalid','invalid');assert.equal(chargeFocus('Unavailable',[active,malformed,completed],now).last,completed);assert.equal(chargeFocus('Stopped',[active,malformed],now).last,null);});
