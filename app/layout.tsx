import './globals.css';
import './consumer.css';
import './desktop-display.css';
import './themes.css';
import './charge-status.css';
import './journeys.css';
import './vehicle.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {title:'Volt · Tesla dashboard',description:'Your Tesla, energy and ownership costs in one place.'};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="en-GB" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:"try{var t=localStorage.getItem('volt-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}"}}/></head><body>{children}</body></html> }
