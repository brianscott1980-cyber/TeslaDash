'use client';
import {useCallback,useEffect,useState} from 'react';
import type {JourneyFeed} from '../../lib/journey-live';
export function useJourneyFeed(){
 const [feed,setFeed]=useState<JourneyFeed|null>(null);
 const [trigger,setTrigger]=useState(0);const refresh=useCallback(()=>setTrigger(x=>x+1),[]);
 useEffect(()=>{let stopped=false,busy=false;const controller=new AbortController();
  const read=async()=>{if(busy||document.visibilityState==='hidden')return;busy=true;try{
   const r=await fetch('/api/journeys',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
   if(r.status===401){window.location.assign('/login');return;}if(!r.ok)throw Error();const value=await r.json();if(!stopped)setFeed(value);
  }catch{if(!stopped)setFeed(previous=>({...previous,trips:previous?.trips??[],tracking:{...previous?.tracking,status:'unavailable',message:'Live connection interrupted. Showing the last saved journey readings.'}}));}finally{busy=false;}};
  void read();const id=setInterval(()=>void read(),10000);document.addEventListener('visibilitychange',read);
  return()=>{stopped=true;controller.abort();clearInterval(id);document.removeEventListener('visibilitychange',read);};
 },[trigger]);return {feed,refresh};
}
