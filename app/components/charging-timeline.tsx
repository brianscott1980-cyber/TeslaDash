import type {SmartSchedule} from '../../lib/octopus-schedule';

const time=(t:number)=>new Date(t).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'});
const date=(t:number)=>new Date(t).toLocaleDateString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short'});
export function ChargingTimeline({schedule,updated}:{schedule:SmartSchedule|undefined;updated:string}){
 const now=Date.parse(updated);
 if(schedule?.status!=='ready')return <div className="smart-schedule"><div className="schedule-heading"><span>Octopus smart schedule</span></div><p>{schedule?.status==='unconfigured'?'Add Octopus account details to load your plan.':'Unable to retrieve the plan. Refresh to try again.'}</p></div>;
 const slots=schedule.slots.filter(s=>Number.isFinite(Date.parse(s.start))&&Date.parse(s.end)>Date.parse(s.start));
 if(!slots.length)return <div className="smart-schedule"><div className="schedule-heading"><span>Octopus smart schedule</span></div><p>No charging slots published by Octopus.</p></div>;
 const hour=3600000;
 const start=Math.floor(Math.min(now,...slots.map(s=>Date.parse(s.start)))/hour)*hour;
 const end=Math.max(start+2*hour,Math.ceil(Math.max(now,...slots.map(s=>Date.parse(s.end)))/hour)*hour);
 const position=(t:number)=>(t-start)/(end-start)*100;
 const active=slots.some(s=>Date.parse(s.start)<=now&&Date.parse(s.end)>now);
 return <div className="smart-schedule">
  <div className="schedule-heading"><span>Octopus smart schedule</span><small>{date(start)}{date(start)!==date(end)?' - '+date(end):''} / UK time</small></div>
  <div className="charge-timeline" role="group" aria-label="Octopus planned charging timeline">
   <div className="timeline-track">
    {Array.from({length:5},(_,i)=><i key={i} className="timeline-gridline" style={{left:`${i*25}%`}}/>)}
    {slots.map((s,i)=>{const a=Date.parse(s.start),b=Date.parse(s.end);const status=b<=now?'completed':a<=now?'active':'planned';const label=`${date(a)} ${time(a)} to ${time(b)}, ${s.type==='SMART'?'smart charge':'boost or other charge'}, ${status}`;return <div key={i} tabIndex={0} role="img" aria-label={label} title={label} className={`timeline-bar ${s.type==='SMART'?'smart':'boost'} ${status}`} style={{left:`${position(a)}%`,width:`${position(b)-position(a)}%`}}><span/></div>})}
    {now>=start&&now<=end&&<div className="timeline-now" style={{left:`${position(now)}%`}} title={`Now ${time(now)}`}><span>Now</span></div>}
   </div>
   <div className="timeline-axis">{Array.from({length:5},(_,i)=><span key={i} style={{left:`${i*25}%`}}>{time(start+(end-start)*i/4)}</span>)}</div>
  </div>
  <div className="timeline-key"><span><i className="smart"/>Smart charge</span>{slots.some(s=>s.type!=='SMART')&&<span><i className="boost"/>Boost / other</span>}<span><i className="pause"/>Paused</span></div>
  <small className="schedule-note">{active?'Inside a planned charging slot.':'Between planned charging slots.'} Gaps are pauses. Octopus can revise the plan.</small>
 </div>;
}
