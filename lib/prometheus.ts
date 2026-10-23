import type {Dashboard} from './data';
export function prometheusMetrics(d:Dashboard){
 const lines:string[]=[];
 const gauge=(name:string,help:string,value:number|undefined)=>{if(value===undefined||!Number.isFinite(value))return;lines.push(`# HELP ${name} ${help}`,`# TYPE ${name} gauge`,`${name} ${value}`)};
 gauge('tesladash_poll_timestamp_seconds','Time of the latest provider collection.',Date.parse(d.updated)/1000);
 gauge('tesladash_demo_mode','Whether the sample represents demo data.',d.demo?1:0);
 const available=d.state!=='Unavailable';
 gauge('tesladash_vehicle_up','Whether Tesla returned vehicle data in this collection.',available?1:0);
 gauge('tesladash_octopus_up','Whether a current electricity unit rate is available.',d.rate!==null?1:0);
 if(available&&!d.demo){
  gauge('tesladash_battery_percent','Vehicle battery state of charge.',d.battery);
  gauge('tesladash_charge_limit_percent','Configured vehicle charge limit.',d.limit);
  gauge('tesladash_charging','Whether the vehicle reports active charging.',d.state==='Charging'?1:0);
  gauge('tesladash_charger_power_kw','Reported charging power in kilowatts.',d.power);
  gauge('tesladash_session_energy_added_kwh','Tesla energy added in the current or last session; resets between sessions. Gauge, not a cumulative counter.',d.added);
  gauge('tesladash_charge_remaining_hours','Tesla estimated remaining charging time.',d.hours);
  gauge('tesladash_range_miles','Tesla rated remaining range in miles.',d.range);
  gauge('tesladash_real_world_range_miles','Tesla driving-condition estimate of remaining range in miles.',d.realWorldRange);
  gauge('tesladash_odometer_miles','Vehicle odometer in miles.',d.odometer);
  gauge('tesladash_predicted_session_cost_gbp','Estimated session cost, not a billed total.',d.forecast?.total);
 }
 if(!d.demo){gauge('tesladash_unit_rate_pence_per_kwh','Current Octopus unit price including VAT.',d.rate??undefined);gauge('tesladash_smart_schedule_up','Whether the Octopus device schedule was retrieved.',d.schedule?.status==='ready'?1:0);gauge('tesladash_planned_slot_count','Number of published planned dispatch slots.',d.schedule?.status==='ready'?d.schedule.slots.length:undefined);}
 return lines.join('\n')+'\n';
}
