'use client';
import {useState} from 'react';
import {Clock,Gauge,Route,Zap} from 'lucide-react';
import type {Trip} from '../../lib/data';
import type {ChargingHistory} from '../../lib/charging-history-model';
import {journeyCost,latestJourneyIndex} from '../../lib/journey-facts';
import {journeyExamples} from '../../lib/journey-preview';
import {JourneyMap} from './journey-map';
import {JourneyEnergyTimeline} from './journey-energy-timeline';
const money=(value:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value);
export function JourneysView({trips,history}:{trips:Trip[];history:ChargingHistory|null}){
 const [preview,setPreview]=useState(false),[selected,setSelected]=useState<number|null>(null);
 const list=preview?journeyExamples:trips;
 const focus=list[selected??latestJourneyIndex(list)];
 const cost=journeyCost(focus,preview?[]:history?.sessions??[]);
 const minutes=focus?.start&&focus?.end?(Date.parse(focus.end)-Date.parse(focus.start))/60000:null;
 return <>{preview&&<div className="journey-demo-note">DESIGN PREVIEW / Fictional journey, energy readings and costs. Your recorded totals are unchanged.</div>}
 <section className="metrics journey-facts" aria-label="Journey facts"><div className="panel metric"><span>{selected===null?'Cost of last journey':'Journey cost'} <Gauge size={16}/></span><strong>{cost?money(cost.value):'—'} <em>{cost?.basis==='estimated'?'est.':''}</em></strong><small title={cost?.explanation}>{cost?(preview?'Example / 6.6p per kWh':cost.basis==='recorded'?'Recorded journey cost':'Estimated journey cost'):focus?'No matching recorded energy price':'Awaiting journey history'}</small></div><div className="panel metric"><span>Energy used <Zap size={16}/></span><strong>{focus?(focus.kwh?.toFixed(1)??'—'):'—'} <em>kWh</em></strong><small>{focus?'Net energy used in this journey':'Awaiting recorded journey energy'}</small></div><div className="panel metric"><span>Journey distance <Route size={16}/></span><strong>{focus?focus.miles.toFixed(1):'—'} <em>mi</em></strong><small>{focus?`${focus.from} to ${focus.to}`:'No journeys recorded yet'}</small></div><div className="panel metric"><span>Journey time <Clock size={16}/></span><strong>{minutes!==null&&Number.isFinite(minutes)&&minutes>0?Math.round(minutes):'—'} <em>min</em></strong><small>{focus?focus.date:'Duration needs recorded start and end times'}</small></div></section>
 <JourneyEnergyTimeline trip={focus} preview={preview}/>
 <JourneyMap trips={trips} preview={preview} onPreviewChange={value=>{setPreview(value);setSelected(null)}} selectedIndex={selected} onSelectionChange={setSelected} hidePreviewBanner/>
 <footer><span>{preview?'Example journey design':'Recorded journeys only'} / Costs and energy refer to the journey shown above.</span></footer></>;
}
