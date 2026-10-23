import test from 'node:test';
import assert from 'node:assert/strict';
import {prometheusMetrics} from '../lib/prometheus.ts';
const data={updated:'2026-10-23T00:00:00Z',demo:false,state:'Charging',battery:64,limit:100,power:7,added:4,hours:3,range:158,odometer:12000,rate:6.6,schedule:{status:'ready',slots:[]},forecast:{total:2},vin:'PRIVATE',name:'PRIVATE'};
test('Exports numeric gauges without identifiers or misleading cumulative counters',()=>{const text=prometheusMetrics(data);assert.match(text,/tesladash_charger_power_kw 7\n/);assert.match(text,/# TYPE tesladash_session_energy_added_kwh gauge/);assert.ok(!text.includes('PRIVATE'));assert.match(text,/tesladash_predicted_session_cost_gbp 2\n/)});
test('Missing Tesla data does not export false zero vehicle readings',()=>{const text=prometheusMetrics({...data,state:'Unavailable',rate:null});assert.match(text,/tesladash_vehicle_up 0/);assert.ok(!text.includes('tesladash_battery_percent'));assert.ok(!text.includes('tesladash_unit_rate_pence_per_kwh'))});
test('Demo measurements cannot masquerade as recorded vehicle readings',()=>{const text=prometheusMetrics({...data,demo:true});assert.match(text,/tesladash_demo_mode 1/);assert.ok(!text.includes('tesladash_battery_percent'))});
test('Real-world range records only its own live reading, never rated or saved range',()=>{
 assert.match(prometheusMetrics({...data,realWorldRange:201.6}),/tesladash_real_world_range_miles 201.6\n/);
 assert.ok(!prometheusMetrics(data).includes('tesladash_real_world_range_miles'));
 assert.ok(!prometheusMetrics({...data,state:'Unavailable',realWorldRange:201.6}).includes('tesladash_real_world_range_miles'));
});
