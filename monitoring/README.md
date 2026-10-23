# Synology continuous recording

Installed and verified on 23 October 2026: both containers running, application health check healthy, live Kitt/Octopus data available, unattended scrape samples recorded, and stored samples retained after restarting Prometheus. All 14 local tests pass and the production Docker image built successfully on the NAS. The desktop development server was stopped after handoff.

TeslaDash and Prometheus run on Synology's Docker package, using the same `always` restart policy as Sonarr. No router forwarding or public publishing is configured. TeslaDash listens at `http://192.168.0.101:9006`; Prometheus is reachable only on the private `tesladash` Docker network.

Persistent NAS folders:

- `/volume1/docker/tesladash/config/.env.local`: Tesla and Octopus credentials and rotating tokens. Owned by container UID 1000, directory mode 700, file mode 600. Synology login credentials are excluded.
- `/volume1/docker/tesladash/prometheus`: time-series database, owned by UID 65534.
- `/volume1/docker/tesladash/source`: application source, Dockerfile and scrape configuration; no credentials.
- `/volume1/docker/tesladash/build.log`: build output.

Prometheus scrapes `/api/metrics` every 60 seconds, whether or not a browser is open. The dashboard and metrics route share a 60-second cache and a single in-flight provider request. Depending on timing, a scrape can reuse the preceding cached collection; `tesladash_poll_timestamp_seconds` identifies its original collection time. Data is retained for up to 365 days or 2GB of compacted blocks, whichever limit is reached first. WAL/head data uses additional disk. Docker log rotation is enabled. The NAS must stay powered on and awake; sleeping/offline vehicles produce availability samples, without wake-up commands.

Metrics include battery %, limit %, charging state, charging kW, current-session Tesla-added kWh, estimated range, odometer, current electricity rate, forecast cost and schedule availability. Labels contain no VIN, account number or credentials. The session-added kWh metric is a **gauge** that resets between sessions. Do not sum its samples or use `increase()` as if it were a monotonic counter. Prometheus snapshots are a basis for later graphs and session reconstruction; they do not yet populate the dashboard's charging/trip history tables or provide billed session totals. Whole-home energy is excluded.

Useful PromQL queries:

```promql
tesladash_battery_percent
tesladash_charger_power_kw
tesladash_session_energy_added_kwh
tesladash_predicted_session_cost_gbp
tesladash_vehicle_up
```

Initial install (after source and the initial filtered `.env.local` have been copied):

```sh
cd /volume1/docker/tesladash/source
sudo docker build -t tesladash:local .
sudo docker pull prom/prometheus:v3.15.1
sudo sh scripts/install-synology.sh
```

The install script refuses to replace existing named containers. Updates must preserve `config/` and `prometheus/`; rebuild the image, then replace only the application container using its existing settings. Never copy old desktop refresh tokens over the NAS's live config after deployment. Only the NAS should continuously refresh Tesla tokens. To reauthorize in the future, the currently registered OAuth callback remains `http://localhost:3000/api/tesla/callback`; stop any local server on port 3000, then use `ssh -L 3000:192.168.0.101:9006 brian@192.168.0.101` from this PC and open http://localhost:3000/connect/tesla, or explicitly configure an approved NAS callback before changing the login flow. Normal token refresh runs unattended and persists to the mounted config directory. The direct NAS setup page is not a remote OAuth login flow.

Back up `config/` securely and take filesystem-consistent backups of the Prometheus data directory while the recorder container is stopped. Replacing a container does not remove the bind-mounted database. A NAS reboot was not performed as part of installation.

For other Docker hosts, `compose.yml` supplies the equivalent services with `./runtime/config` and `./runtime/prometheus`. Create those directories, copy the initial app-only `.env.local`, and set UID ownership to 1000 and 65534 respectively before `docker compose up -d --build`.

Six-month home charging history now comes directly from Octopus SmartFlexVehicle.chargingSessions, paginated over a rolling six-month window. Historical account agreements select the applicable tariff, with historical SMART off-peak prices including VAT. Provider costs are retained when returned in GBP; otherwise estimates exclude charging losses and standing charges. Sessions that cross conflicting rates or lack enough energy/tariff data stay unpriced. Public charging is not included. This is separate from Prometheus and does not infer sessions from household electricity consumption. Responses are cached for one hour and saved atomically to config/charging-history.json (mode 600); a failed refresh can display that saved copy with a stale notice. Include this file in private config backups. The history table and CSV include UTC start/end timestamps, energy and cost basis; the display uses UK time.

Workstation LAN entry point corrected on 23 October 2026: this PC has persistent static IPv4 192.168.0.102/24, gateway 192.168.0.1 and DNS 192.168.0.101. Its own Node development server listens directly on port 3000. The obsolete NAS portproxy entry has been removed. Firewall rule TeslaDash-Home-LAN permits workstation port 3000 only from 192.168.0.0/24. Verified HTTP 200 from this PC and the NAS, and confirmed the listener process is node. The NAS has address 192.168.0.101; its production instance must only be updated when explicitly requested, and that next deployment will use NAS port 3000. The currently installed NAS port 9006 remains unchanged until then. See DEVELOPMENT.md.
