import test from 'node:test';
import assert from 'node:assert/strict';
import {teslaTokenScopes,journeyScopes} from '../lib/tesla-scopes.ts';
const jwt=claims=>'header.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
test('GPS permission is recognized for array and space-delimited Tesla scp claims',()=>{
 for(const claim of [{scp:['openid','vehicle_location']},{scp:'openid vehicle_location'},{scope:'openid vehicle_location'}])assert.deepEqual(teslaTokenScopes(jwt(claim)),['openid','vehicle_location']);
 assert.deepEqual(teslaTokenScopes(jwt({scp:'openid  vehicle_location\tvehicle_location'})),['openid','vehicle_location']);
});
test('Malformed claims and similarly named scopes cannot grant GPS permission',()=>{
 for(const token of ['', 'broken', 'a.bad.c',jwt(null),jwt({scp:5}),jwt({scp:[null,{},'vehicle_location_fake']}),jwt({scp:[],scope:'vehicle_location'})])assert.equal(teslaTokenScopes(token).includes('vehicle_location'),false);
});
test('Journey authorization explicitly requests location, renewal and vehicle data without command scopes',()=>{
 assert.deepEqual(journeyScopes.split(' '),['openid','offline_access','vehicle_device_data','vehicle_location']);
});
