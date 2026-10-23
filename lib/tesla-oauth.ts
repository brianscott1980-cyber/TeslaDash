import {timingSafeEqual} from 'node:crypto';

export const teslaScopes=process.env.TESLA_SCOPES||'openid offline_access user_data vehicle_device_data vehicle_location';
export function oauthConfig(redirect=process.env.TESLA_REDIRECT_URI||'http://localhost:3000/api/tesla/callback'){
 const url=new URL(redirect);
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if((url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))||url.username||url.password||url.search||url.hash||url.pathname!=='/api/tesla/callback')throw Error('Invalid Tesla callback configuration');
 return {callback:url.href,origin:url.origin,secure:url.protocol==='https:'};
}
export function sameOriginPost(request:Request,origin:string){
 try{return request.method==='POST'&&request.headers.get('origin')===origin&&(request.headers.get('host')??new URL(request.url).host)===new URL(origin).host;}catch{return false;}
}
export function validOAuthState(expected:string|undefined,actual:string|null){
 return !!expected&&!!actual&&/^[a-f0-9]{64}$/.test(expected)&&/^[a-f0-9]{64}$/.test(actual)&&timingSafeEqual(Buffer.from(expected),Buffer.from(actual));
}
export function authorizeUrl(clientId:string,callback:string,state:string){
 const url=new URL('https://auth.tesla.com/oauth2/v3/authorize');
 url.search=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',scope:teslaScopes,state,locale:'en-GB',prompt_missing_scopes:'true'}).toString();return url;
}
export function connectionStatus(env:Record<string,string|undefined>,now=Date.now()){
 if(!env.TESLA_CLIENT_ID||!env.TESLA_CLIENT_SECRET)return 'not-configured';
 if(!env.TESLA_ACCESS_TOKEN)return 'not-connected';
 const expiry=Number(env.TESLA_TOKEN_EXPIRES_AT);
 if(!Number.isFinite(expiry)||expiry<=0)return 'unknown';
 if(expiry<=now)return env.TESLA_REFRESH_TOKEN?'refresh-available':'expired';
 return 'connected';
}
