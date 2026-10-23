import test from 'node:test';
import assert from 'node:assert/strict';
import {vehicleName} from '../lib/vehicle-name.ts';
test('Uses vehicle_state name when display_name is missing or stale',()=>{assert.equal(vehicleName({display_name:null,vehicle_state:{vehicle_name:'Kitt'}}),'Kitt');assert.equal(vehicleName({display_name:'Old name',vehicle_state:{vehicle_name:'Kitt'}}),'Kitt')});
test('Falls back to display_name and then a neutral label',()=>{assert.equal(vehicleName({display_name:'Kitt',vehicle_state:{vehicle_name:''}}),'Kitt');assert.equal(vehicleName({}),'Your Tesla')});
