#!/bin/sh
set -eu
endpoint=http://192.168.0.1:5000/ctl/IPConn
map_port() {
 external=$1
 internal=$2
 description=$3
 response=$(curl -fsS --connect-timeout 5 --max-time 15 --retry 2 -X POST "$endpoint" \
  -H 'Content-Type: text/xml; charset="utf-8"' \
  -H 'SOAPAction: "urn:schemas-upnp-org:service:WANIPConnection:1#AddPortMapping"' \
  -d "<?xml version=\"1.0\"?><s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\"><s:Body><u:AddPortMapping xmlns:u=\"urn:schemas-upnp-org:service:WANIPConnection:1\"><NewRemoteHost></NewRemoteHost><NewExternalPort>${external}</NewExternalPort><NewProtocol>TCP</NewProtocol><NewInternalPort>${internal}</NewInternalPort><NewInternalClient>192.168.0.101</NewInternalClient><NewEnabled>1</NewEnabled><NewPortMappingDescription>${description}</NewPortMappingDescription><NewLeaseDuration>0</NewLeaseDuration></u:AddPortMapping></s:Body></s:Envelope>")
 echo "$response" | grep -q AddPortMappingResponse || { echo "UPnP mapping failed for TCP $external" >&2; exit 1; }
 echo "Refreshed TCP $external -> 192.168.0.101:$internal ($description)"
}
if [ "${1:-}" = '--acme-only' ]; then
 map_port 80 8081 TeslaDash-ACME
else
 map_port 3000 3000 TeslaDash-HTTPS
fi
