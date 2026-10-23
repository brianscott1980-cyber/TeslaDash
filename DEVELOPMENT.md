# Development and deployment

Develop and test on this workstation at **192.168.0.102:3000**. The NAS is **192.168.0.101**, with its own independent TeslaDash instance. Never forward the workstation address to the NAS. Deploy or restart NAS containers only when explicitly requested.

## Current NAS deployment

On 23 October 2026, the authorized deployment installed `tesladash:20261023-live-driving` and its independent journey worker. The app is behind Caddy on NAS port 3000; its protected LAN backend is port 3001. Prometheus remains on the private Docker network and continues recording. A stopped previous app container is retained for rollback. Configuration, rotating Tesla credentials, vehicle snapshots and journey data remain in persistent `/config` storage.

External hostname: `mymedia.ddns.net`, not `mymedia.ddns.nte`. The NAS callback is `https://mymedia.ddns.net:3000/api/tesla/callback`. Its allowed browser origin is `https://mymedia.ddns.net:3000`. Tesla Developer must retain the matching external callback before external authentication can work. At verification, the portal still displayed only the localhost callback after save attempts; a manual save was requested. A direct Tesla authorization check also returned its Access Denied page. Do not describe external login as verified until the provider accepts the callback and a real sign-in completes.

Trusted external HTTPS was deferred by the owner. The current certificate is not publicly trusted. Caddy HTTP certificate validation requires router TCP 80 forwarded to NAS port 8081; public application traffic uses TCP 3000 forwarded to NAS port 3000. Do not publish backend port 3001 or Prometheus to the internet.

## Workstation configuration

Keep all secrets in ignored `.env.local`:

```dotenv
DASHBOARD_READ_PROXY=http://192.168.0.101:3001
DASHBOARD_READ_PROXY_TOKEN=<NAS dedicated read credential>
JOURNEY_AUTH_RELAY_TOKEN=<NAS dedicated journey OAuth intake credential>
TESLA_REDIRECT_URI=http://localhost:3000/api/tesla/callback
SITE_ALLOWED_ORIGINS=http://192.168.0.102:3000,http://127.0.0.1:3000
```

The read credential permits only explicit read APIs, including journey history. It grants no browser session or vehicle commands. The OAuth relay credential permits only the NAS journey credential intake. Do not copy rotating vehicle tokens between instances. Do not scrape the workstation as another collector.

## Site authentication

Site login uses single-use state, nonce, PKCE, verified Tesla RS256 identity tokens, and a server-verified account email. Only the two owner email addresses in `lib/site-session.ts` are accepted. The approved Tesla subject is pinned in ignored configuration. Sessions are signed, HttpOnly and SameSite=Lax, and Secure for HTTPS. No vehicle tokens are saved by ordinary site sign-in.

The configured callback must be registered exactly with Tesla. A one-time handoff returns login to an explicitly allowed browser origin. Arbitrary Host/forwarded headers are not trusted. Callback dispatch matches the returned state, so abandoned journey-consent cookies cannot hijack ordinary login.

## GPS consent and worker

Vehicle Location is enabled in the Tesla developer app, but the NAS vehicle token at deployment did not include `vehicle_location`. This requires fresh owner consent through `/connect/journeys`; refreshing the existing token cannot add the grant. The recorder reports `needs-permission`. It can still record driving energy and distance with the existing Vehicle Information grant; precise location and navigation are requested only after Vehicle Location is granted. Scope hints recognize both array and space-delimited `scp` claims. They never substitute for provider validation of credentials and vehicle access.

The worker runs with the browser closed. It has a dedicated `JOURNEY_RECORDER_TOKEN` file mounted read-only and uses only the private app API. App and worker restarts preserve `/config/journeys`. After consent, verify fresh GPS and worker status before promising a recorded drive. Missing coordinates, stale samples and privacy-hidden shared vehicles must remain visible failures, rather than fabricated routes. Sampled energy is estimated.

## Validation and Git

Use Node 24. Run `node --test tests/*.test.mjs`, `npm.cmd run typecheck`, and a production build before deployment. The repository excludes `.env.local`, runtime data, operational deployment files, private keys and the separate verification-site checkout. Only the public Tesla verification key is published under `public/.well-known/appspecific/`.

The NAS disables SSH forwarding. Leave that setting and the private Prometheus network intact. Preserve NAS credentials and data during every explicitly authorized deployment. Check `/api/health` anonymously, private API rejection without credentials, protected read access, worker status and Prometheus target health afterwards.
