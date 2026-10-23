import type {HistoricalCharge} from './charging-history-model';
export function chargeFocus(state:string|undefined,sessions:HistoricalCharge[],now=Date.now()){
 const last=sessions.filter(s=>s.kwh!==0&&Number.isFinite(Date.parse(s.start))&&Date.parse(s.end)>Date.parse(s.start)&&Date.parse(s.end)<=now).sort((a,b)=>Date.parse(b.end)-Date.parse(a.end))[0]??null;
 return {active:state==='Charging',last};
}
