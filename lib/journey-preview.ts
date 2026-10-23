import type {Trip} from './data';
function samples(start:string,minutes:number,kwh:number[]){return kwh.map((value,i)=>({start:new Date(Date.parse(start)+i*minutes*60000).toISOString(),end:new Date(Date.parse(start)+(i+1)*minutes*60000).toISOString(),kwh:value}))}
// Fictional design examples; never inserted into live journey history.
export const journeyExamples:Trip[]=[
 {date:'Example / morning',from:'Home',to:'City centre',miles:12.4,kwh:2.8,start:'2026-10-20T07:15:00Z',end:'2026-10-20T07:43:00Z',costGbp:.1848,costBasis:'estimated',energyTimeline:samples('2026-10-20T07:15:00Z',4,[.4,.6,.55,.3,-.1,.65,.4]),route:[[115,320],[190,320],[245,270],[310,270],[355,220],[440,220],[495,160],[580,160]]},
 {date:'Example / afternoon',from:'City centre',to:'Riverside',miles:6.2,kwh:1.4,start:'2026-10-20T14:10:00Z',end:'2026-10-20T14:28:00Z',costGbp:.0924,costBasis:'estimated',energyTimeline:samples('2026-10-20T14:10:00Z',3,[.2,.25,.3,-.1,.35,.4]),route:[[580,160],[635,160],[680,210],[680,270],[735,320],[810,320]]},
 {date:'Example / evening',from:'Riverside',to:'Home',miles:15.1,kwh:3.3,start:'2026-10-20T17:05:00Z',end:'2026-10-20T17:40:00Z',costGbp:.2178,costBasis:'estimated',energyTimeline:samples('2026-10-20T17:05:00Z',5,[.35,.53,.4,.72,.65,-.12,.77]),route:[[810,320],[735,320],[680,370],[580,370],[510,320],[440,320],[385,370],[245,370],[190,320],[115,320]]}
];
