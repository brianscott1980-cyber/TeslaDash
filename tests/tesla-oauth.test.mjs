import test from 'node:test';
import assert from 'node:assert/strict';
import {oauthConfig,sameOriginPost,validOAuthState,authorizeUrl,connectionStatus} from '../lib/tesla-oauth.ts';
test('Configured callback is used exactly and unsafe callback URLs are rejected',()=>{
 assert.deepEqual(oauthConfig('http://127.0.0.1:3000/api/tesla/callback'),{callback:'http://127.0.0.1:3000/api/tesla/callback',origin:'http://127.0.0.1:3000',secure:false});
 assert.equal(oauthConfig('https://volt.example/api/tesla/callback').secure,true);
 assert.deepEqual(oauthConfig('https://mymedia.ddns.net:3000/api/tesla/callback'),{callback:'https://mymedia.ddns.net:3000/api/tesla/callback',origin:'https://mymedia.ddns.net:3000',secure:true});
 for(const url of ['http://192.168.0.102:3000/api/tesla/callback','https://name:pass@example.com/api/tesla/callback','https://example.com/other','https://example.com/api/tesla/callback?next=evil'])assert.throws(()=>oauthConfig(url));
});
test('OAuth writes require matching request origin and POST, blocking cross-site submissions',()=>{
 const origin='http://localhost:3000';
 assert.equal(sameOriginPost(new Request(origin+'/api/tesla/start',{method:'POST',headers:{origin}}),origin),true);
 for(const r of [new Request(origin+'/api/tesla/start',{method:'POST',headers:{origin:'https://evil.example'}}),new Request('http://192.168.0.102:3000/api/tesla/start',{method:'POST',headers:{origin}}),new Request(origin+'/api/tesla/start')])assert.equal(sameOriginPost(r,origin),false);
});
test('State validation rejects absent, malformed and mismatched browser state',()=>{
 const state='a'.repeat(64);assert.equal(validOAuthState(state,state),true);
 for(const actual of [null,'a'.repeat(63),'b'.repeat(64),'!'.repeat(64)])assert.equal(validOAuthState(state,actual),false);
 assert.equal(validOAuthState(undefined,state),false);
});
test('Authorization uses Tesla and only the vehicle-read and renewal scopes',()=>{
 const url=authorizeUrl('test-client','http://localhost:3000/api/tesla/callback','a'.repeat(64));
 assert.equal(url.origin,'https://auth.tesla.com');assert.equal(url.searchParams.get('redirect_uri'),'http://localhost:3000/api/tesla/callback');assert.equal(url.searchParams.get('scope'),'openid offline_access user_data vehicle_device_data vehicle_location');assert.equal(url.searchParams.has('client_secret'),false);
});
test('Token presence alone is not presented as a verified active connection',()=>{
 const env={TESLA_CLIENT_ID:'id',TESLA_CLIENT_SECRET:'secret',TESLA_ACCESS_TOKEN:'token'};
 assert.equal(connectionStatus(env,1000),'unknown');assert.equal(connectionStatus({...env,TESLA_TOKEN_EXPIRES_AT:'900'},1000),'expired');assert.equal(connectionStatus({...env,TESLA_TOKEN_EXPIRES_AT:'900',TESLA_REFRESH_TOKEN:'refresh'},1000),'refresh-available');assert.equal(connectionStatus({...env,TESLA_TOKEN_EXPIRES_AT:'2000'},1000),'connected');
});
