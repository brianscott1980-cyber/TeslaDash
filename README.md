# TeslaDash

A full-screen Next.js dashboard for Tesla vehicle details, charging, journeys and Octopus Energy costs. Supports light, dark and system appearance.

## Development

Use Node.js 24:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

The development server listens on this workstation at `http://192.168.0.102:3000`. Keep credentials in ignored `.env.local`; never use `NEXT_PUBLIC_` for credentials. The workstation can read NAS data using `DASHBOARD_READ_PROXY` and its separate read-only credential. NAS deployment is a separate, explicitly requested step.

```powershell
node --test tests/*.test.mjs
npm.cmd run typecheck
npm.cmd run build
```

## Tesla sign-in and external access

Dashboard access requires Tesla sign-in and is restricted to the owner's two approved email addresses in `lib/site-session.ts`. Identity tokens are signature-verified; the account email is checked with Tesla. Site login is separate from the vehicle recorder's rotating credentials.

For the NAS, use **https://mymedia.ddns.net:3000** (`.net`, not `.nte`). Configure:

```dotenv
TESLA_REDIRECT_URI=https://mymedia.ddns.net:3000/api/tesla/callback
SITE_ALLOWED_ORIGINS=https://mymedia.ddns.net:3000
```

In Tesla Developer, save the exact allowed origin and callback above, preserving the workstation callback `http://localhost:3000/api/tesla/callback`. Scheme, hostname, port and path must match. A localhost callback cannot return an external phone to the NAS.

The site needs a publicly trusted HTTPS certificate. Router TCP 3000 forwards to NAS `192.168.0.101:3000`. Caddy's HTTP certificate validation requires TCP 80 forwarded to NAS `192.168.0.101:8081`; leave that rule available for renewal. A local/self-signed fallback certificate does not make external OAuth ready. Do not forward LAN backend port 3001 or Prometheus to the internet.

For local development, use the registered localhost callback and the explicitly allowed workstation origins from `.env.example`. Do not replace NAS rotating tokens with workstation tokens.

## Location and journey recording

`/connect/journeys` requests `openid offline_access vehicle_device_data vehicle_location` with PKCE, nonce and single-use state. Existing grants without Vehicle Location require fresh consent; refreshing a token cannot add permission. Tesla's `scp` claim can be an array or a space-delimited string. Shared vehicles with private location hidden cannot provide GPS even with the scope.

The recorder requests `location_data` explicitly. It records actual GPS points, odometer and sampled drive power; missing or stale GPS is reported rather than described as successful recording. The worker must run independently of the browser using `scripts/journey-worker.mjs`, its dedicated `JOURNEY_RECORDER_TOKEN`, and persistent `/config` storage. A grant alone does not start the worker. Workstation-assisted grants can be relayed to the NAS using a separate server-only `JOURNEY_AUTH_RELAY_TOKEN`; failed relay is reported as failure.

Polling is metered by Tesla. The worker waits without sending wake-up commands. Energy inferred from sampled power is an estimate; gaps are preserved. Historical routes cannot be recovered from old odometer readings. Route preview data is explicitly illustrative.

## Charging and storage

Octopus credentials and account/device identifiers belong in `.env.local`. The dashboard reads Intelligent Octopus schedules and available historical EV charging records. Historical estimates use the tariff applicable to the period; unsupported or missing prices remain unavailable. Standing charges are not attributed to the car. Forecasts are estimates rather than bills.

Vehicle snapshots retain the last known measurements while the car sleeps. Prometheus stores polling metrics on the NAS private Docker network. Persistent app configuration and journey files belong under `/config`, outside the image and Git. See [storage notes](monitoring/README.md) and [development workflow](DEVELOPMENT.md).

The Docker setup serves the app through Caddy on NAS port 3000 and exposes a protected LAN backend on port 3001 for workstation reads. Preserve existing NAS config, rotating tokens and Prometheus data during deployment.

References: [Tesla OAuth](https://developer.tesla.com/docs/fleet-api/authentication/third-party-tokens), [Tesla scopes](https://developer.tesla.com/docs/fleet-api/authentication/overview), [vehicle endpoints](https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints), [Octopus API](https://docs.octopus.energy/rest/guides/endpoints/).
