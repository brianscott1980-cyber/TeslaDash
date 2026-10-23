'use client';
import {useEffect,useMemo,useState} from 'react';
import {Clock,Gauge,Route,Zap} from 'lucide-react';
import type {Trip} from '../../lib/data';
import type {ChargingHistory} from '../../lib/charging-history-model';
import {journeyCost,latestJourneyIndex,liveJourneyFacts} from '../../lib/journey-facts';
import type {JourneyFeed} from '../../lib/journey-live';
import {journeyExamples} from '../../lib/journey-preview';
import {JourneyMap} from './journey-map';
import {GpsJourneyMap} from './gps-journey-map';
import {JourneyEnergyTimeline} from './journey-energy-timeline';
const money=(value:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value);
const time=(value:string)=>new Date(value).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'});
export function JourneysView({trips,history,feed}:{trips:Trip[];history:ChargingHistory|null;feed?:JourneyFeed|null}){
 const [preview,setPreview]=useState(false),[selected,setSelected]=useState<number|null>(null),[now,setNow]=useState(Date.now());
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);
 useEffect(()=>{setSelected(null);setPreview(false)},[feed?.live?.trip.id]);
 const live=!preview&&selected===null?feed?.live:undefined;
 const facts=live?liveJourneyFacts(live,history?.sessions??[],now):null;
 const list=preview?journeyExamples:trips;
 const focus=live?.trip??list[selected??latestJourneyIndex(list)];
 const cost=journeyCost(focus,preview?[]:history?.sessions??[]);
 const minutes=focus?.start&&focus?.end?(Date.parse(focus.end)-Date.parse(focus.start))/60000:null;
 const hasGps=!!focus?.coordinates?.length;
 const mapTrips=useMemo(()=>live?[live.trip]:trips,[live?.trip,trips]);
 return <div className={live?'journey-content live-journey-content':'journey-content'}>
 {!preview&&<div className={'journey-tracking '+(live&&facts?.fresh?'tracking-live':'')} role="status"><span className="tiny-dot"/><strong>{live?(facts?.fresh?(live.driving?'Journey in progress':'Journey paused'):'Last received journey readings'):feed?.tracking.status==='needs-permission'?'Connect journey recording':feed?.tracking.status==='ready'?'Ready for your next drive':'Journey recorder'}</strong><span>{live?.sample.navigation?.destination?'To '+live.sample.navigation.destination:feed?.tracking.message??'Checking the NAS recorder...'}</span>{feed?.tracking.status==='needs-permission'&&<a href="/connect/journeys">Connect Tesla location &rarr;</a>}{live&&<small>{facts?.fresh?'Updated '+time(live.sample.time):'Connection stale / '+time(live.sample.time)}</small>}</div>}
 {preview&&<div className="journey-demo-note">DESIGN PREVIEW / Fictional journey, energy readings and costs. Your recorded totals are unchanged.</div>}
 {live&&facts?<>
 <section className="metrics journey-facts live-journey-facts" aria-label="Live journey facts">
 <div className="panel metric"><span>Cost so far <Gauge size={16}/></span><strong>{facts.costSoFar!==null?money(facts.costSoFar):'—'} <em>est.</em></strong><small title={facts.costExplanation}>{focus?.partial?'Recorded samples / gaps in coverage':'Using the preceding recorded charge price'}</small></div>
 <div className="panel metric"><span>Predicted total <Zap size={16}/></span><strong>{facts.predictedCost!==null?money(facts.predictedCost):'—'} <em>est.</em></strong><small>{facts.predictedCost!==null?'Current driving efficiency to destination':!live.sample.navigation?'Set a destination in Tesla navigation':'Needs sufficient driving energy and price data'}</small></div>
 <div className="panel metric"><span>Time to destination <Clock size={16}/></span><strong>{facts.remainingMinutes!==null?Math.ceil(facts.remainingMinutes):'—'} <em>min</em></strong><small>{facts.milesRemaining!==null?facts.milesRemaining.toFixed(1)+' miles remaining':'Tesla navigation estimate'}</small></div>
 <div className="panel metric"><span>Estimated arrival <Route size={16}/></span><strong>{facts.arrivalTime?time(facts.arrivalTime):'—'}</strong><small>{live.sample.navigation?.destination??'Set a destination in the car'}</small></div>
 </section>
 <div className="live-drive-strip"><span><strong>{focus?.miles.toFixed(1)}</strong> miles travelled</span><span><strong>{focus?.kwh?.toFixed(2)??'—'}</strong> kWh used</span><span><strong>{facts.elapsedMinutes!==null?Math.floor(facts.elapsedMinutes):'—'}</strong> min elapsed</span><span><strong>{facts.fresh&&typeof live.sample.speed==='number'?Math.round(live.sample.speed):'—'}</strong> mph</span><span><strong>{typeof live.sample.batteryPercent==='number'?Math.round(live.sample.batteryPercent):'—'}</strong>% battery</span></div>
 </>:<section className="metrics journey-facts" aria-label="Journey facts"><div className="panel metric"><span>{selected===null?'Cost of last journey':'Journey cost'} <Gauge size={16}/></span><strong>{cost?money(cost.value):'—'} <em>{cost?.basis==='estimated'?'est.':''}</em></strong><small title={cost?.explanation}>{cost?(preview?'Example / 6.6p per kWh':cost.basis==='recorded'?'Recorded journey cost':'Estimated journey cost'):focus?'No matching recorded energy price':'Awaiting journey history'}</small></div><div className="panel metric"><span>Energy used <Zap size={16}/></span><strong>{focus?(focus.kwh?.toFixed(1)??'—'):'—'} <em>kWh</em></strong><small>{focus?.energyBasis==='power-samples'?'Estimated from recorded drive power':'Net energy used in this journey'}</small></div><div className="panel metric"><span>Journey distance <Route size={16}/></span><strong>{focus?focus.miles.toFixed(1):'—'} <em>mi</em></strong><small>{focus?`${focus.from} to ${focus.to}`:'No journeys recorded yet'}</small></div><div className="panel metric"><span>Journey time <Clock size={16}/></span><strong>{minutes!==null&&Number.isFinite(minutes)&&minutes>0?Math.round(minutes):'—'} <em>min</em></strong><small>{focus?focus.date:'Duration needs recorded start and end times'}</small></div></section>}
 <JourneyEnergyTimeline trip={focus} preview={preview}/>
 {!preview&&(live||trips.some(t=>t.coordinates?.length))?<GpsJourneyMap trips={mapTrips} selected={live?0:selected} onSelect={live?()=>{}:setSelected} live={live??undefined}/>:<JourneyMap trips={trips} preview={preview} onPreviewChange={value=>{setPreview(value);setSelected(null)}} selectedIndex={selected} onSelectionChange={setSelected} hidePreviewBanner/>}
 {live&&!hasGps&&<div className="notice">GPS coordinates have not arrived. No route is being invented.</div>}
 <footer><span>{preview?'Example journey design':live?'Live driving / sampled energy and historical charge pricing':'Recorded journeys only'} / {live?'Predictions depend on fresh Tesla navigation and measured driving efficiency.':'Costs and energy refer to the journey shown above.'}</span></footer></div>;
}
