# Development and deployment

All development and previews run on this workstation. **Do not deploy to or restart NAS containers unless the user explicitly requests deployment.** The user authorized deployment on 23 October 2026. The current NAS app is `tesladash:20261023-public`, with Caddy on NAS port 3000 and a protected development data endpoint on LAN port 3001. External HTTPS completion is pending the router's manual port 80 validation rule and saving the prepared Tesla redirect settings.

Run `npm run dev`, then open http://192.168.0.102:3000 or http://127.0.0.1:3000. The dev server runs directly on this PC and listens on port 3000. The workstation has static IPv4 192.168.0.102/24. There must be no portproxy rule forwarding that workstation address to the NAS. The Windows firewall allows access from the home subnet 192.168.0.0/24.

192.168.0.101 belongs to the NAS. Its own TeslaDash instance will use NAS port 3000 when the user explicitly requests a deployment. Do not update or reconfigure that instance as part of routine development.

The workstation's ignored `.env.local` contains:

```dotenv
DASHBOARD_READ_PROXY=http://192.168.0.101:3001
DASHBOARD_READ_PROXY_TOKEN=<dedicated read-only credential>
```

The development dashboard, charging history and recording checks read the NAS backend with its dedicated read credential. Its recording endpoint queries NAS Prometheus. The machine credential permits only GET of dashboard/history/recording/metrics APIs; it grants no browser login or control access. This avoids a second vehicle collector or token refresh process on the workstation. Do not scrape the workstation's `/api/metrics`; the NAS is the collector.

The NAS disables SSH TCP forwarding. Do not change its SSH configuration or publish the Prometheus port for development. Direct diagnostic PromQL queries can be run through an ordinary SSH shell on the NAS, using its private Docker network address:

```sh
sudo docker inspect tesladash-prometheus --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
curl -G --data-urlencode 'query=up{job="tesladash"}' http://172.20.0.2:9090/api/v1/query
```

Use the current inspected IP if it changes. Check http://127.0.0.1:3000/api/recording for `recording` while testing the local UI.

Before an explicitly requested production deployment, build and verify locally, then publish on NAS port 3000 while preserving its config and Prometheus data. Never copy workstation refresh tokens or workstation-only proxy settings into the NAS config. Remove `DASHBOARD_READ_PROXY` from any production environment to avoid proxy loops.

Pending local changes include the last-charge panel and icon-only System / Light / Dark control. They are not deployed yet.

## Tesla sign-in protects dashboard access

The workstation now requires a verified Tesla sign-in for dashboard pages and data APIs. Open http://192.168.0.102:3000. Anonymous page requests redirect to `/login`; private APIs return 401. The public `/api/health` reports service availability only.

The site login uses the existing registered `TESLA_REDIRECT_URI` (currently localhost). It starts a ten-minute, single-use state/nonce/PKCE transaction on that origin, verifies Tesla's RS256 ID token against its published third-party keys, then returns a one-minute, single-use handoff to the original approved workstation origin. This preserves login cookies when starting at 192.168.0.102 while Tesla returns to localhost. Hostnames must match `SITE_ALLOWED_ORIGINS` or the configured callback origin; forwarded hosts and arbitrary redirect targets are not trusted.

The first verified login must share access to the configured `TESLA_VIN`. Its Tesla subject is then pinned in `TESLA_AUTH_SUBJECT` in ignored `.env.local`; subsequent logins must match that subject. A random `SITE_SESSION_SECRET` is created there automatically. The browser receives a signed, HttpOnly, SameSite=Lax session lasting seven days, Secure when served over HTTPS. The Sign out button clears that browser's session. Rotating the signing secret revokes all existing sessions. Removing the pinned subject permits enrollment again, so do that only deliberately.

Temporary owner email restriction: only `brianscott1980@googlemail.com` and `brianscott1980@gmail.com` are allowed. Site OAuth additionally requests `user_data` and reads `/api/1/users/me` server-side using that login's access token. Email must be supplied by Tesla, never a form, query parameter or unverified token claim. Missing/unreadable email fails closed. Signed sessions carry the checked email; the allowlist is rechecked on every private request. Old sessions and pending handoffs without an email are rejected and require a new login. Matching ignores letter case and outer whitespace, but does not expand dotted or plus-address Gmail aliases. The existing pinned subject check remains in force. This policy lives in `lib/site-session.ts` and remains until explicitly changed; no automatic expiry was requested.

Site login never saves, replaces or refreshes `TESLA_ACCESS_TOKEN` or `TESLA_REFRESH_TOKEN`. The existing NAS collector and proxy data source remain independent. OAuth transaction files under ignored `runtime/site-auth` contain short-lived state and PKCE values, never Tesla access/refresh tokens.

For a future explicitly authorized NAS deployment, configure and register an HTTPS callback that reaches that NAS instance, add its public/dashboard origin to `SITE_ALLOWED_ORIGINS`, and preserve its own API tokens. Do not copy the workstation's pinned account/session secret or rotating vehicle tokens to it automatically. No NAS changes have been made for this implementation.

`/api/metrics` also requires authentication. Prometheus should use a dedicated random `METRICS_TOKEN` stored in the app environment and the matching `config/metrics-token` file (owner 65534, mode 600), mounted read-only at `/etc/prometheus/metrics-token`. The prepared Prometheus config references that file. This bearer credential grants only GET `/api/metrics`, not dashboard/API access. Prepare those files before a future deployment; the running NAS configuration remains unchanged. Docker health checks use `/api/health` rather than a protected page.
