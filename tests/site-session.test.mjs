import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,generateKeyPairSync,sign} from 'node:crypto';
import {readSession,signSession,verifyTeslaIdentity,sessionSeconds,siteOriginAllowed,requestSiteOrigin,allowedSiteEmail,machineReadAccess} from '../lib/site-session.ts';
const secret='a'.repeat(43),now=1792750000000;
test('Collector credentials are limited to explicit read APIs and never grant page or control access',()=>{
 const env={METRICS_TOKEN:'metrics',DASHBOARD_READ_TOKEN:'development'};
 assert.equal(machineReadAccess('/api/metrics','GET','Bearer metrics',env),true);
 for(const path of ['/api/dashboard','/api/recording','/api/charging-history','/api/metrics'])assert.equal(machineReadAccess(path,'GET','Bearer development',env),true);
 for(const path of ['/','/connect/tesla','/api/tesla/register','/api/auth/logout'])assert.equal(machineReadAccess(path,'GET','Bearer development',env),false);
 assert.equal(machineReadAccess('/api/dashboard','GET','Bearer metrics',env),false);
 assert.equal(machineReadAccess('/api/dashboard','POST','Bearer development',env),false);
 assert.equal(machineReadAccess('/api/dashboard','GET','Bearer incorrect',env),false);
});
test('Site sessions are account-bound, signed, expire, and reject tampering',()=>{
 const cookie=signSession('owner',secret,now,'brianscott1980@gmail.com');
 assert.deepEqual(readSession(cookie,secret,'owner',now),{sub:'owner'});
 for(const [value,key,sub,time] of [[cookie,secret,'other',now],[cookie+'x',secret,'owner',now],[cookie,'b'.repeat(43),'owner',now],[cookie,secret,'owner',now+sessionSeconds*1000],[cookie,secret,'owner',now-60000],[undefined,secret,'owner',now],[cookie,undefined,'owner',now]])assert.equal(readSession(value,key,sub,time),null);
 assert.equal(readSession('eyJzdWIiOiJvd25lciJ9.fake',secret,'owner',now),null);
});
test('Only the two full owner email addresses are allowed',()=>{
 for(const email of ['brianscott1980@gmail.com','brianscott1980@googlemail.com',' BRIANSCOTT1980@GMAIL.COM '])assert.ok(allowedSiteEmail(email));
 for(const email of [undefined,null,'','other@gmail.com','brianscott1980+test@gmail.com','brian.scott1980@gmail.com','brianscott1980@gmail.com.evil.test','brianscott1980@googlemail.co'])assert.equal(allowedSiteEmail(email),null);
});
test('Legacy sessions and correctly signed sessions for disallowed emails are rejected',()=>{
 const signed=claim=>{const body=Buffer.from(JSON.stringify(claim)).toString('base64url');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');};
 for(const email of [undefined,'other@gmail.com'])assert.equal(readSession(signed({sub:'owner',email,iat:now/1000,exp:now/1000+sessionSeconds}),secret,'owner',now),null);
 assert.throws(()=>signSession('owner',secret,now,'other@gmail.com'));
 for(const email of ['brianscott1980@gmail.com','brianscott1980@googlemail.com'])assert.deepEqual(readSession(signSession('owner',secret,now,email),secret,'owner',now),{sub:'owner'});
});
test('Only known workstation origins may receive an authenticated handoff',()=>{
 const origin='http://localhost:3000';assert.equal(siteOriginAllowed('http://192.168.0.102:3000',origin),true);assert.equal(siteOriginAllowed('https://attacker.example',origin),false);assert.equal(siteOriginAllowed('http://192.168.0.102:3000.attacker.example',origin),false);
});
test('Bind addresses are not confused with the browser origin; arbitrary Host headers are rejected',()=>{
 const request=new Request('http://0.0.0.0:3000/api/auth/tesla/start',{headers:{host:'192.168.0.102:3000'}});
 assert.equal(requestSiteOrigin(request,'http://localhost:3000'),'http://192.168.0.102:3000');
 assert.throws(()=>requestSiteOrigin(new Request('http://attacker.example'),'http://localhost:3000'));
});
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const key={...publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256',use:'sig'};
const base={iss:'https://auth.tesla.com/oauth2/v3/nts',aud:'client',sub:'owner',nonce:'nonce',iat:Math.floor(now/1000),exp:Math.floor(now/1000)+300};
const jwt=(claims=base,header={alg:'RS256',kid:'test-key'})=>{const body=[header,claims].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');return body+'.'+sign('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');};
test('Tesla identity requires a genuine RSA signature and valid issuer, audience, nonce and expiry',()=>{
 assert.equal(verifyTeslaIdentity(jwt(),[key],'client','nonce',now),'owner');
 for(const claims of [{...base,iss:'https://evil.example'},{...base,aud:'other'},{...base,nonce:'wrong'},{...base,exp:base.iat-1},{...base,iat:base.iat+100},{...base,sub:''},{...base,aud:['client','other']}])assert.throws(()=>verifyTeslaIdentity(jwt(claims),[key],'client','nonce',now));
 assert.throws(()=>verifyTeslaIdentity(jwt(base,{alg:'none',kid:'test-key'}),[key],'client','nonce',now));
 assert.throws(()=>verifyTeslaIdentity(jwt(),[{...key,kid:'other'}],'client','nonce',now));
 const broken=jwt().split('.');broken[1]=Buffer.from(JSON.stringify({...base,sub:'attacker'})).toString('base64url');assert.throws(()=>verifyTeslaIdentity(broken.join('.'),[key],'client','nonce',now));
});
