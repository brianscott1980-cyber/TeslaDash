'use client';
import {useEffect,useState} from 'react';
import {Monitor,Moon,Sun} from 'lucide-react';
type Theme='system'|'light'|'dark';
const valid=(value:string|null):Theme=>value==='light'||value==='dark'?value:'system';
export function ThemeControl(){
 const [theme,setTheme]=useState<Theme>('system');
 const [ready,setReady]=useState(false);
 useEffect(()=>{try{setTheme(valid(localStorage.getItem('volt-theme')))}catch{}setReady(true)},[]);
 useEffect(()=>{
  if(!ready)return;
  const media=matchMedia('(prefers-color-scheme: dark)');
  const apply=()=>{document.documentElement.dataset.theme=theme==='system'?(media.matches?'dark':'light'):theme};
  apply();media.addEventListener('change',apply);
  return()=>media.removeEventListener('change',apply);
 },[theme,ready]);
 useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key==='volt-theme')setTheme(valid(event.newValue))};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[]);
 const Icon=theme==='system'?Monitor:theme==='light'?Sun:Moon;
 const next:Theme=theme==='system'?'light':theme==='light'?'dark':'system';
 const name=(value:Theme)=>value[0].toUpperCase()+value.slice(1);
 const label=`Appearance: ${name(theme)}. Switch to ${name(next)}`;
 return <button type="button" className="theme-control" title={label} aria-label={label} onClick={()=>{setTheme(next);try{localStorage.setItem('volt-theme',next)}catch{}}}><Icon size={18} aria-hidden="true"/></button>;
}
