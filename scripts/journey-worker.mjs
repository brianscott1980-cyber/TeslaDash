import {readFile} from 'node:fs/promises';
const root=process.env.JOURNEY_APP_URL||'http://tesladash:3000';
let stop=false;process.on('SIGTERM',()=>{stop=true});
while(!stop){let wait=60;
 try{const token=(await readFile(process.env.JOURNEY_TOKEN_FILE||'/run/journey-recorder-token','utf8')).trim();const response=await fetch(root+'/api/journeys/poll',{method:'POST',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error();const value=await response.json();wait=Math.max(15,Math.min(300,Number(value.nextPollSeconds)||60));console.log(new Date().toISOString()+' recorder: '+value.status);}catch{console.error(new Date().toISOString()+' recorder: sample unavailable; retrying');}
 await new Promise(resolve=>{const end=()=>{clearTimeout(timer);process.off('SIGTERM',end);resolve();};const timer=setTimeout(end,wait*1000);process.once('SIGTERM',end);});
}
