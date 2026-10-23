'use client';
import {VehicleView} from './components/vehicle-view';
import {useEffect,useRef,useState} from 'react';
import {Activity,ArrowRight,BatteryCharging,Car,Check,ChevronRight,Clock,Download,Expand,Gauge,LayoutDashboard,Lock,PlugZap,RefreshCw,Route,Settings,ShieldCheck,Thermometer,X,Zap} from 'lucide-react';
import {ChargingHistoryView,CategoryBadge} from './components/charging-history-view';
import {ChargeStatus} from './components/charge-status';
import {chargeFocus} from '../lib/charge-focus';
import {ThemeControl} from './components/theme-control';
import {JourneyMap} from './components/journey-map';
import {JourneysView} from './components/journeys-view';
import {useJourneyFeed} from './components/use-journey-feed';
import {drivingJourneyKey} from '../lib/journey-live';
import type {Dashboard,Session} from '../lib/data';
import {filterCharges,classifyCharge,type ChargingHistory} from '../lib/charging-history-model';
const money=(value:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value);
const navigation=[['Overview',LayoutDashboard],['Charging',PlugZap],['Journeys',Route],['Vehicle',Car]] as const;

export default function DashboardView(){
 const[data,setData]=useState<Dashboard|null>(null);
 const[view,setView]=useState('Overview');
 const {feed:journeyFeed,refresh:refreshJourneyFeed}=useJourneyFeed();
 const drivingKey=drivingJourneyKey(journeyFeed),driving=drivingKey!==null;
 const wasDriving=useRef<string|null>(null);
 useEffect(()=>{if(drivingKey&&drivingKey!==wasDriving.current)setView('Journeys');wasDriving.current=drivingKey;},[drivingKey]);
 const[period,setPeriod]=useState('Last 6 months');
 const[history,setHistory]=useState<ChargingHistory|null>(null);
 async function loadHistory(){try{const r=await fetch('/api/charging-history');if(r.status===401){window.location.assign('/login');return;}if(!r.ok)throw Error();setHistory(await r.json())}catch{setHistory(previous=>previous?{...previous,status:'stale',message:'Showing saved history. The latest refresh failed.'}:{status:'unavailable',from:'',to:'',updated:'',sessions:[],message:'Charging history could not be loaded.'})}}
 useEffect(()=>{void loadHistory();const id=setInterval(()=>void loadHistory(),3600000);return()=>clearInterval(id)},[]);
 const[settings,setSettings]=useState(false);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 const[recording,setRecording]=useState('');
 const[now,setNow]=useState<Date|null>(null);
 useEffect(()=>{setNow(new Date());const id=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(id)},[]);
 const dataRef=useRef(data);
 dataRef.current=data;
 const viewRef=useRef(view);
 viewRef.current=view;
 const lastPollRef=useRef(0);
 const busyRef=useRef(busy);
 busyRef.current=busy;

 const isCarAwake=(dashboard:Dashboard|null)=>{
  if(!dashboard)return true;
  if(dashboard.demo)return true;
  if(dashboard.vehicleConnection)return dashboard.vehicleConnection==='online';
  return dashboard.state!=='Unavailable';
 };

 async function refresh(manual=false){
  setBusy(true);
  lastPollRef.current=Date.now();
  if(viewRef.current==='Journeys'){refreshJourneyFeed();setBusy(false);return;}
  if(viewRef.current==='Charging'){
   try{
    const tasks:Promise<unknown>[]=[loadHistory()];
    if(manual||isCarAwake(dataRef.current)){
     tasks.push(fetch('/api/dashboard').then(async r=>{
      if(r.status===401){window.location.assign('/login');return;}
      if(r.ok){setData(await r.json());setError('');}
     }).catch(()=>{}));
    }
    await Promise.all(tasks);
   }catch{
    if(manual)setError('We could not refresh your charging records. Please try again.');
   }finally{
    setBusy(false);
   }
   return;
  }
  try{
   const r=await fetch('/api/dashboard');
   if(r.status===401){window.location.assign('/login');return;}
   if(!r.ok)throw Error();
   setData(await r.json());
   setError('');
  }catch{
   if(manual)setError('We could not refresh your car. Please try again.');
  }finally{
   setBusy(false);
  }
 }

 useEffect(()=>{
  void refresh();
  const check=()=>fetch('/api/recording').then(r=>r.json()).then(d=>setRecording(d.status==='recording'?'Connected and recording':d.status==='unconfigured'?'Connected':'Check recording connection')).catch(()=>setRecording('Check recording connection'));
  void check();
  const tryPoll=()=>{
   const onScreenAndFocused=typeof document!=='undefined'&&document.visibilityState==='visible'&&document.hasFocus();
   if(!onScreenAndFocused||busyRef.current)return;
   if(Date.now()-lastPollRef.current<30000)return;
   if(viewRef.current!=='Charging'&&!isCarAwake(dataRef.current))return;
   void refresh(false);
   void check();
  };
  const intervalId=setInterval(tryPoll,5000);
  const onFocusOrVisible=()=>tryPoll();
  window.addEventListener('focus',onFocusOrVisible);
  document.addEventListener('visibilitychange',onFocusOrVisible);
  return()=>{clearInterval(intervalId);window.removeEventListener('focus',onFocusOrVisible);document.removeEventListener('visibilitychange',onFocusOrVisible);};
 },[]);
 const d=data;
 const sessions:Session[]=d?.demo?d.sessions:filterCharges(history?.sessions??[],period).map(s=>({...s,date:new Date(s.start).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}),location:s.location||('Home / '+s.type.toLowerCase()),category:s.category??classifyCharge(s)}));
 const trips=filterCharges(journeyFeed?.trips??d?.trips??[],period);
 const spend=sessions.reduce((n,s)=>n+(s.cost??0),0),energy=sessions.reduce((n,s)=>n+(s.kwh??0),0),miles=trips.reduce((n,t)=>n+t.miles,0);
 const stale=!!(now&&d&&now.getTime()-Date.parse(d.updated)>180000);
 const vehicleAvailable=d&&d.state!=='Unavailable';
 const vehicleName=d?.vehicle?.values.name??d?.name;
 const vehicleOdometer=d?.vehicle?.values.odometer??(vehicleAvailable?d?.odometer:undefined);
 const charge=chargeFocus(d?.state,history?.sessions??[],now?.getTime()??Date.now());
 const isCharging=(d?.state==='Charging')||charge.active;
 const showVehicle=view==='Overview'||view==='Vehicle';
 function exportHistory(){if(!d)return;const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';const rows=['Start (UTC),End (UTC),Category,Location,Energy (kWh),Cost (GBP),Cost basis,Type',...sessions.map(s=>[quote(s.start??s.date),quote(s.end??''),quote(s.category??'Home'),quote(s.location),s.kwh??'',s.cost??'',quote(s.costBasis??'Example'),quote(s.type)].join(','))];const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='tesla-charging.csv';a.click();URL.revokeObjectURL(url)}
 return <div className={"shell consumer"+(view==='Overview'?' desktop-overview':view==='Charging'?(' history-view'+(isCharging?' has-live-charge':'')):view==='Journeys'?' journeys-view':view==='Vehicle'?' vehicle-view':'')}><aside><a className="brand" href="/"><span className="brand-icon"><Zap size={23} fill="currentColor"/></span>volt<span className="brand-dot">.</span></a><div className="workspace">YOUR GARAGE</div><nav>{navigation.map(([label,Icon])=><button key={label} title={label} className={view===label?'active':''} onClick={()=>setView(label)}><Icon size={19}/>{label}{view===label&&<span className="nav-dot"/>}</button>)}</nav><div className="sidebar-bottom"><div className="integration"><span className="tiny-dot"/>{vehicleName??'Your Tesla'}<span>{recording||'Connecting to your car'}</span></div><button className="settings" title="Connections and preferences" onClick={()=>setSettings(true)}><Settings size={18}/>Connections & preferences</button><div className="profile"><div className="avatar">ME</div><div>My garage<small>Made for your everyday</small></div><ChevronRight size={16}/></div></div></aside>
 <main><header><div className="breadcrumb">My garage <ChevronRight size={14}/><span>{view}</span></div><div className="header-right">{driving&&view!=='Journeys'&&<button className="refresh live-return" onClick={()=>setView('Journeys')}>Live journey</button>}<ThemeControl/><div className="display-clock"><strong>{now?.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})??''}</strong><span>{now?.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'Europe/London'})??''}</span></div><span className={"mode"+((view==='Charging'?(history?.status==='stale'||history?.status==='unavailable'):(view!=='Journeys'&&(stale||d?.state==='Unavailable')))?' status-warning':'')}><span className="tiny-dot"/>{view==='Charging'?(!history?'Loading history':history.status==='ready'?'History synced':history.status==='stale'?'Saved history':'History unavailable'):view==='Journeys'?(driving?(Number.isFinite(journeyFeed?.live?.sample.latitude)&&Number.isFinite(journeyFeed?.live?.sample.longitude)?'Driving / live GPS':'Driving / route unavailable'):journeyFeed?.tracking.status==='needs-permission'?'Location permission needed':trips.length?'Journey records':'Awaiting journeys'):d?.demo?'Demo garage':view==='Vehicle'?(d?.vehicleConnection==='asleep'?'Asleep / saved readings':d?.state==='Unavailable'?'Saved vehicle readings':'Vehicle readings'):d?.state==='Unavailable'?'Vehicle unavailable':stale?'Readings need refreshing':d?'Live':'Connecting'}</span><button className="icon-button" aria-label="Toggle fullscreen" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen().catch(()=>setError('Fullscreen is unavailable in this browser.'))}}><Expand size={16}/></button><form action="/api/auth/logout" method="post"><button className="refresh" type="submit">Sign out</button></form></div></header>
 <div className="content"><section className="page-heading"><div><div className="eyebrow">{view==='Charging'?'YOUR CHARGING HISTORY':view==='Journeys'?'YOUR JOURNEYS':'YOUR CAR. THE WHOLE PICTURE.'}</div><h1>{view==='Overview'?`${d?.name??'Your Tesla'}, at a glance.`:view==='Charging'?'Charging history':view==='Journeys'?(driving?'Live journey':'Journeys'):'Your vehicle.'}</h1><p>{view==='Overview'?'Your energy, your journeys and what they cost.':view==='Journeys'?'Energy, distance and the cost of each drive.':view==='Vehicle'?'The details behind your daily drive.':'Your recorded charging sessions, energy and historical costs.'}</p></div><div className="heading-actions"><button className="refresh" onClick={()=>void refresh(true)} disabled={busy}><RefreshCw size={14} className={busy?'spin':''}/>{busy?'Refreshing':'Refresh'}</button>{view!=='Vehicle'&&!(view==='Journeys'&&driving)&&<select aria-label="Reporting period" value={period} onChange={e=>setPeriod(e.target.value)}><option>Today</option><option>This week</option><option>This month</option><option>Last 6 months</option></select>}</div></section>
 {error&&view!=='Charging'&&view!=='Journeys'&&<div className="notice">{error}</div>}
 {view==='Charging'?<ChargingHistoryView history={history} period={period} data={d} now={now?.getTime()??Date.now()} onEstimates={()=>setSettings(true)}/>:view==='Journeys'?<JourneysView trips={trips} history={history} feed={journeyFeed}/>:view==='Vehicle'?(d?<VehicleView data={d}/>:<div className="panel empty">Loading saved vehicle details...</div>):!d?<div className="panel empty">Connecting to your garage...</div>:<>
 {d.demo&&<div className="demo-note">Demo garage / all figures are examples.</div>}
 {showVehicle&&<div className="hero-grid"><section className="panel vehicle"><div className="panel-top"><div><span className="eyebrow">YOUR DAILY DRIVE</span><h2>{d.name}</h2><p>Model 3 <span className="car-spec-divider">/</span> LFP battery <span className="car-spec-divider">/</span> Deep Blue Metallic</p></div><span className="badge"><span className="tiny-dot"/>{vehicleAvailable?d.state:'Not connected'}</span></div><div className={'vehicle-render'+(d.state==='Charging'?' is-charging':'')}><div className="energy-delivery" aria-hidden="true"><div className="energy-ground-glow"/><div className="energy-feed"><i/><i/><i/></div><div className="energy-wave wave-one"/><div className="energy-wave wave-two"/><div className="energy-wave wave-three"/><div className="energy-particles"><i/><i/><i/><i/><i/></div></div><img src="/vehicles/kitt-deep-blue.png" className="tesla-render" alt="Kitt, a Deep Blue Model 3 with black trim, satin-black alloys and rear privacy glass"/></div><div className="vehicle-bottom"><span><Gauge size={15}/>{vehicleAvailable?d.odometer.toLocaleString('en-GB',{maximumFractionDigits:0}):'—'} miles on the clock</span><button onClick={()=>setView('Vehicle')}>Explore your car <ArrowRight size={13}/></button></div></section>
 <ChargeStatus data={d} history={history} now={now?.getTime()??Date.now()} onEstimates={()=>setSettings(true)} onHistory={()=>setView('Charging')}/></div>}
 {view!=='Vehicle'&&<>
 {view==='Overview'?<section className="metrics live-metrics"><div className="panel metric"><span>Home charging rate <Zap size={16}/></span><strong>{d.rate?.toFixed(1)??'—'} <em>p/kWh</em></strong><small>Octopus / current rate</small></div><div className="panel metric"><span>{charge.active?'Added this charge':'Last charge energy'} <PlugZap size={16}/></span><strong>{charge.active?(vehicleAvailable?d.added.toFixed(1):'—'):(charge.last?.kwh?.toFixed(1)??'—')} <em>kWh</em></strong><small>{charge.active?'Tesla-reported energy added':'Last recorded home charge'}</small></div><div className="panel metric"><span>{charge.active?'Cost so far':'Last charge cost'} <Gauge size={16}/></span><strong>{charge.active?(d.forecast?money(d.forecast.soFar):'—'):(charge.last?.cost!=null?money(charge.last.cost):'—')} <em>{charge.active||charge.last?.costBasis==='estimated'?'est.':''}</em></strong><small>{charge.active?'Current session / at your home rate':charge.last?'Ended '+new Date(charge.last.end).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Awaiting completed charge history'}</small></div><div className="panel metric"><span>Odometer <Route size={16}/></span><strong>{vehicleAvailable?d.odometer.toLocaleString('en-GB',{maximumFractionDigits:0}):'—'} <em>mi</em></strong><small>Lifetime distance</small></div></section>:<section className="metrics"><div className="panel metric"><span>Charging cost / est. <PlugZap size={16}/></span><strong>{sessions.length?money(spend):'—'}</strong><small>{sessions.length?`${sessions.length} sessions / ${sessions.filter(s=>s.cost===null).length} unpriced`:'Charging history not available yet'}</small></div><div className="panel metric"><span>Energy charged <Zap size={16}/></span><strong>{sessions.length?energy.toFixed(1):'—'} <em>kWh</em></strong><small>{period} / recorded sessions</small></div><div className="panel metric"><span>Distance driven <Route size={16}/></span><strong>{trips.length?miles.toFixed(1):'—'} <em>mi</em></strong><small>{trips.length?`${trips.length} journeys`:'Journey recording not connected yet'}</small></div><div className="panel metric"><span>Charging cost per mile <Gauge size={16}/></span><strong>{miles&&spend?(spend/miles*100).toFixed(1):'—'} <em>p/mi</em></strong><small>Recorded charging spend / distance</small></div></section>}
 {view==='Overview'&&<JourneyMap trips={trips}/>}
 {view!=='Journeys'&&<div className="ownership-grid"><section className="panel history"><div className="panel-top"><div><span className="eyebrow">ENERGY WELL SPENT</span><h3>Past charging</h3></div><button className="text-button" disabled={!sessions.length} onClick={exportHistory}><Download size={14}/>Export</button></div><div className="history-context"><strong>{period} / {sessions.length} sessions</strong><span>{history?.message??(d.demo?"Example charging history.":"Loading your Octopus charging history...")}</span>{history?.updated&&<small>Synced {new Date(history.updated).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} / UK time</small>}</div>{sessions.length?<div className="table-scroll history-records"><table><thead><tr><th>CHARGING PERIOD / UK TIME</th><th>ENERGY ADDED</th><th>COST</th></tr></thead><tbody>{sessions.map((s,i)=><tr key={i}><td><div className="cell-location"><span className={'table-icon '+(s.category==='Supercharger'||s.type==='Supercharger'?'super':s.category==='Fast public'?'fast':s.category==='Slow public'?'slow':'')}><PlugZap size={16}/></span><div><div style={{display:'flex',alignItems:'center',gap:'6px'}}>{s.location}{s.category&&<CategoryBadge category={s.category}/>}</div><small>{s.date}{s.end&&<> to {new Date(s.end).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</>}</small></div></div></td><td>{s.kwh?.toFixed(1)??'—'} <small>kWh</small></td><td>{s.cost===null?'Unavailable':money(s.cost)}<small className="cost-basis">{s.costBasis==='estimated'?'estimate':s.costBasis==='provider'?'Octopus cost':s.cost===null?'Not enough tariff detail':''}</small></td></tr>)}</tbody></table></div>:<div className="consumer-empty"><PlugZap size={24}/><h4>{!history?'Loading your past charges...':history.status==='unavailable'?'History is temporarily unavailable.':'No sessions in this period.'}</h4><p>{!history?'Retrieving six months from Octopus.':'Try selecting Last 6 months to see the available history.'}</p><small>Only recorded charging sessions appear here.</small></div>}<div className="table-footer">Octopus home charging only / excludes charging losses, standing charges and public charging</div></section>
 <section className="panel tariff"><div className="panel-top"><div><span className="eyebrow">PLUG IN AT THE RIGHT TIME</span><h3>Your electricity rate</h3></div><span className="octopus-label">Octopus</span></div><div className="tariff-price">{d.rate?.toFixed(1)??'—'}<span>p/kWh</span><small>Current home charging rate / incl. VAT</small></div><div className="chart" aria-label="Upcoming electricity unit rates">{d.rates.map((r,i)=><div className="bar-wrap" key={i} title={`${r.time} / ${r.rate.toFixed(1)}p per kWh`}><div className={r.rate<=10?'bar cheap':'bar'} style={{height:`${Math.max(3,Math.abs(r.rate)/Math.max(...d.rates.map(r=>Math.abs(r.rate)),1)*100)}%`}}/></div>)}</div><div className="chart-labels"><span>{d.rates[0]?.time}</span><span>Next 24 hours</span><span>{d.rates.at(-1)?.time}</span></div><div className="legend"><span><i className="green"/>Lower rate</span><span><i/>Standard rate</span></div><p className="rate-footnote">Your smart plan can include additional lower-rate charging slots outside the overnight window.</p></section></div>}

 </>}

 <footer><span><span className="tiny-dot"/>{d.demo?'Demo data':'Connected to Tesla & Octopus'} / Updated {new Date(d.updated).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}</span><button onClick={()=>setSettings(true)}>Data & estimates <ChevronRight size={11}/></button></footer>
 </>}
 </div></main>
 {settings&&<div className="modal-backdrop" onClick={()=>setSettings(false)}><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="connection-title" onClick={e=>e.stopPropagation()}><button className="close icon-button" aria-label="Close preferences" onClick={()=>setSettings(false)}><X size={20}/></button><span className="eyebrow">YOUR CONNECTED GARAGE</span><h2 id="connection-title">A little clarity.</h2><h3><ShieldCheck size={17}/>Private by design</h3><p>Your credentials and recordings stay on your own Synology. This map design makes no requests to an external map service.</p><h3><PlugZap size={17}/>Charging estimates</h3><p>Predictions use your Octopus plan where available. Past energy added assumes 90% charging efficiency and the current rate. Planned smart energy uses the lowest available published rate. Actual delivered energy, earlier rates and bill adjustments can change the final cost.</p><h3><Route size={17}/>Journey maps</h3><p>Route overlays need recorded GPS points. Your existing readings contain no locations, so past journeys cannot be recovered from them. The route-design preview is illustrative and separate from your driving totals.</p><h3><Activity size={17}/>Connection details</h3><p>{recording||'Connection status is loading.'}</p>{d?.notices.map(n=><p key={n}>{n}</p>)}<p>Past home charging comes from Octopus vehicle sessions. Estimates use the historical SMART tariff; sessions without enough energy or tariff data remain unpriced. Journeys are not yet reconstructed from time-series readings. API credentials remain in the protected .env.local file.</p><button className="primary" onClick={()=>setSettings(false)}><Check size={15}/>Got it</button></section></div>}
 </div>;
}
