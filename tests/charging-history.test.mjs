import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCharge,sixMonthsAgo,filterCharges,classifyCharge} from '../lib/charging-history-model.ts';
const rate=(from,to,value)=>({valid_from:from,valid_to:to,value_inc_vat:value});
const charge={start:'2026-06-10T18:00:00Z',end:'2026-06-11T06:00:00Z',type:'SMART',energyAdded:{value:'25',unit:'KILOWATT_HOUR'},cost:null};
const tariffs=[{code:'E-1R-INTELLI-OLD-N',from:'2026-01-01',to:'2026-07-21',rates:[],smartRates:[rate('2026-06-10T22:30:00Z','2026-06-11T04:30:00Z',5.2)]},{code:'E-1R-IOG-NEW-N',from:'2026-07-21',to:null,rates:[],smartRates:[rate('2026-06-10','2026-11-01',6.6)]}];
test('Historical SMART cost uses the agreement at the session date, not today\'s tariff',()=>{const r=evaluateCharge(charge,tariffs);assert.equal(r.cost,1.3);assert.equal(r.costBasis,'estimated');assert.equal(r.tariff,'E-1R-INTELLI-OLD-N');assert.equal(r.category,'Home');});
test('Missing energy, unsupported units, BOOST and rate changes are left unpriced',()=>{
 for(const change of [{energyAdded:null},{energyAdded:{value:'10',unit:'UNKNOWN'}},{type:'BOOST'}])assert.equal(evaluateCharge({...charge,...change},tariffs).cost,null);
 const changed=[{...tariffs[0],smartRates:[...tariffs[0].smartRates,rate('2026-06-11T03:00:00Z','2026-06-11T04:30:00Z',7)]}];assert.equal(evaluateCharge(charge,changed).cost,null);
 assert.equal(evaluateCharge(charge,[]).cost,null);
});
test('Provider GBP cost is retained, and missing cost never becomes zero',()=>{assert.equal(evaluateCharge({...charge,cost:{amount:'2.45',currency:'GBP'}},[]).cost,2.45);assert.equal(evaluateCharge({...charge,energyAdded:{value:null,unit:'KILOWATT_HOUR'}},tariffs).kwh,null);});
test('Six-month window clamps month ends and today follows UK daylight saving time',()=>{assert.equal(sixMonthsAgo(new Date('2026-08-31T12:00:00Z')),'2026-02-28T12:00:00.000Z');assert.equal(filterCharges([{start:'2026-06-09T23:30:00Z'},{start:'2026-06-09T22:30:00Z'}],'Today',new Date('2026-06-10T10:00:00Z')).length,1);});
test('Differentiates Home, Superchargers, Fast public and Slow public chargers',()=>{
 assert.equal(classifyCharge({type:'SMART',location:'Home / Octopus'}),'Home');
 assert.equal(classifyCharge({type:'Off-peak',location:'Home'}),'Home');
 assert.equal(classifyCharge({type:'Supercharger',location:'Tesla Supercharger · London'}),'Supercharger');
 assert.equal(classifyCharge({type:'Supercharge',powerKw:150}),'Supercharger');
 assert.equal(classifyCharge({type:'DC Rapid',powerKw:120}),'Fast public');
 assert.equal(classifyCharge({type:'Fast public',location:'Instavolt · Oxford'}),'Fast public');
 assert.equal(classifyCharge({type:'CCS Rapid',powerKw:50}),'Fast public');
 assert.equal(classifyCharge({start:'2026-10-20T10:00:00Z',end:'2026-10-20T10:30:00Z',kwh:35}),'Fast public');
 assert.equal(classifyCharge({type:'Slow public',location:'Pod Point · Tesco'}),'Slow public');
 assert.equal(classifyCharge({location:'Public Destination',powerKw:7}),'Slow public');
});
