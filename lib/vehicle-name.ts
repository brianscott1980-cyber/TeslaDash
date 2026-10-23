export function vehicleName(vehicle:{display_name?:unknown;vehicle_state?:{vehicle_name?:unknown}}):string{
 for(const name of [vehicle.vehicle_state?.vehicle_name,vehicle.display_name]){
  if(typeof name==='string'&&name.trim())return name.trim();
 }
 return 'Your Tesla';
}
