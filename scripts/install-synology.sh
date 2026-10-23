#!/bin/sh
set -eu
# Run as root on DSM. Source and initial config must already have been copied.
base=/volume1/docker/tesladash
test -f "$base/config/.env.local"
test -s "$base/config/metrics-token"
test -f "$base/source/monitoring/prometheus.yml"
docker image inspect tesladash:local >/dev/null
for name in tesladash tesladash-prometheus; do
  if docker container inspect "$name" >/dev/null 2>&1; then
    echo "Container $name already exists; refusing to replace it automatically." >&2
    exit 1
  fi
done
mkdir -p "$base/prometheus"
chown 1000:1000 "$base/config" "$base/config/.env.local"
chmod 700 "$base/config"
chmod 600 "$base/config/.env.local"
chown 65534:65534 "$base/config/metrics-token"
chmod 600 "$base/config/metrics-token"
chown 65534:65534 "$base/prometheus"
if ! docker network inspect tesladash >/dev/null 2>&1; then docker network create tesladash; fi
docker run --rm --entrypoint /bin/promtool -v "$base/source/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro" -v "$base/config/metrics-token:/etc/prometheus/metrics-token:ro" prom/prometheus:v3.15.1 check config /etc/prometheus/prometheus.yml
docker run -d --name tesladash-prometheus --restart always --network tesladash \
  --log-opt max-size=10m --log-opt max-file=3 \
  -v "$base/source/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
  -v "$base/config/metrics-token:/etc/prometheus/metrics-token:ro" \
  -v "$base/prometheus:/prometheus" \
  prom/prometheus:v3.15.1 --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/prometheus
docker run -d --name tesladash --restart always --network tesladash \
  --log-opt max-size=10m --log-opt max-file=3 \
  -p 192.168.0.101:3001:3000 \
  -e PROMETHEUS_URL=http://tesladash-prometheus:9090 \
  -v "$base/config:/config" tesladash:local
echo 'TeslaDash application installed on protected LAN port 3001. Configure the HTTPS proxy on NAS port 3000 before external access; Prometheus stays private.'
