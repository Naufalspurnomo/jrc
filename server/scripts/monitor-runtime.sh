#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage: monitor-runtime.sh [--verbose] [--help]
Probe the configured JRC public HTTPS origin.
EOF
}

verbose=false
case "${1:-}" in
  --help) usage; exit 0 ;;
  --verbose) verbose=true; shift ;;
  '') ;;
  *) printf 'JRC runtime monitor FAILED: invalid argument\n' >&2; exit 2 ;;
esac
(($# == 0)) || { printf 'JRC runtime monitor FAILED: invalid argument\n' >&2; exit 2; }

work=''
cleanup() { [[ -z "$work" ]] || rm -rf -- "$work"; }
trap cleanup EXIT

valid_https_url() {
  [[ "$1" =~ ^https://([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?)(:([0-9]{1,5}))?(/[^[:space:]?#]*)?$ ]] || return 1
  local name=${BASH_REMATCH[1]} port=${BASH_REMATCH[4]:-443}
  [[ "$name" != *..* && "$name" != .* && "$name" != *. && "$port" -ge 1 && "$port" -le 65535 ]]
}

alert_and_exit() {
  local message=$1 payload webhook=${JRC_ALERT_WEBHOOK_URL:-}
  printf 'JRC runtime monitor FAILED: %s\n' "$message" >&2
  if [[ -n "$webhook" ]] && valid_https_url "$webhook"; then
    payload=${message//\\/\\\\}; payload=${payload//\"/\\\"}
    payload=${payload//$'\n'/ }; payload=${payload//$'\r'/ }; payload=${payload//$'\t'/ }
    curl --silent --show-error --fail --max-time "${probe_timeout:-5}" --connect-timeout "${connect_timeout:-3}" \
      --retry "${retries:-1}" -H 'Content-Type: application/json' -X POST \
      --data-binary "{\"message\":\"JRC runtime monitor FAILED: $payload\"}" "$webhook" >/dev/null 2>&1 || true
  fi
  exit 1
}

for command in curl openssl grep sed mktemp rm timeout tr; do
  command -v "$command" >/dev/null 2>&1 || alert_and_exit "required command unavailable: $command"
done

bounded_integer() {
  local value=$1 minimum=$2 maximum=$3 label=$4
  [[ "$value" =~ ^[0-9]+$ ]] && ((10#$value >= minimum && 10#$value <= maximum)) || alert_and_exit "$label is invalid"
}

probe_timeout=${JRC_PROBE_TIMEOUT_SECONDS:-10}
connect_timeout=${JRC_CONNECT_TIMEOUT_SECONDS:-5}
retries=${JRC_RETRIES:-1}
tls_seconds=${JRC_TLS_WARNING_SECONDS:-}
if [[ -z "$tls_seconds" ]]; then
  if [[ -n "${JRC_TLS_WARNING_DAYS:-}" ]]; then
    bounded_integer "$JRC_TLS_WARNING_DAYS" 1 3650 JRC_TLS_WARNING_DAYS
    tls_seconds=$((10#$JRC_TLS_WARNING_DAYS * 86400))
  else
    tls_seconds=1209600
  fi
fi
bounded_integer "$probe_timeout" 1 300 JRC_PROBE_TIMEOUT_SECONDS
bounded_integer "$connect_timeout" 1 300 JRC_CONNECT_TIMEOUT_SECONDS
bounded_integer "$retries" 1 10 JRC_RETRIES
bounded_integer "$tls_seconds" 1 315360000 JRC_TLS_WARNING_SECONDS

url=${JRC_PUBLIC_URL:-}
[[ -n "$url" ]] || alert_and_exit 'JRC_PUBLIC_URL is required'
[[ "$url" =~ ^https://([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?)(:([0-9]{1,5}))?$ ]] || alert_and_exit 'JRC_PUBLIC_URL must be an HTTPS origin without credentials, path, query, or fragment'
host=${BASH_REMATCH[1]}; port=${BASH_REMATCH[4]:-443}
[[ "$host" != *..* && "$host" != .* && "$host" != *. && "$port" -ge 1 && "$port" -le 65535 ]] || alert_and_exit 'JRC_PUBLIC_URL is invalid'
http_origin=${JRC_HTTP_ORIGIN:-http://$host}
[[ "$http_origin" =~ ^http://([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?)(:([0-9]{1,5}))?$ ]] || alert_and_exit 'JRC_HTTP_ORIGIN must be an HTTP origin'
http_host=${BASH_REMATCH[1]}; http_port=${BASH_REMATCH[4]:-80}
[[ "$http_host" != *..* && "$http_port" -ge 1 && "$http_port" -le 65535 ]] || alert_and_exit 'JRC_HTTP_ORIGIN is invalid'

expected_sha=${JRC_EXPECTED_RELEASE_SHA:-}
[[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]] || alert_and_exit 'JRC_EXPECTED_RELEASE_SHA must be a full lowercase 40-character hexadecimal SHA'
marker=${JRC_RELEASE_MARKER_PATH:-/release.json}
[[ "$marker" =~ ^/[A-Za-z0-9._~/-]+$ && "$marker" != *'..'* ]] || alert_and_exit 'JRC_RELEASE_MARKER_PATH is invalid'
if [[ -n "${JRC_ALERT_WEBHOOK_URL:-}" ]] && ! valid_https_url "$JRC_ALERT_WEBHOOK_URL"; then
  alert_and_exit 'JRC_ALERT_WEBHOOK_URL is invalid'
fi

work=$(mktemp -d)
request() {
  local label=$1 endpoint=$2 expected_type=$3 headers body status content_type
  headers="$work/$label.headers"; body="$work/$label.body"
  status=$(curl --silent --show-error --max-time "$probe_timeout" --connect-timeout "$connect_timeout" --retry "$retries" -D "$headers" -o "$body" -w '%{http_code}' "$endpoint") || alert_and_exit "$label request failed"
  [[ "$status" == 200 ]] || alert_and_exit "$label returned HTTP $status"
  content_type=$(grep -i '^Content-Type:' "$headers" | sed -n '1s/^[^:]*:[[:space:]]*//p' | tr -d '\r')
  [[ "${content_type,,}" == "$expected_type" || "${content_type,,}" == "$expected_type;"* ]] || alert_and_exit "$label returned unexpected content type"
}

header_value() {
  local name=$1 file=$2 values count
  values=$(grep -i "^$name:" "$file" || true)
  count=$(printf '%s\n' "$values" | grep -c . || true)
  [[ "$count" == 1 ]] || return 1
  printf '%s' "$values" | sed 's/^[^:]*:[[:space:]]*//; s/\r$//'
}

request 'public root' "$url" 'text/html'
headers="$work/public root.headers"
hsts=$(header_value Strict-Transport-Security "$headers") || alert_and_exit 'public root missing or duplicated Strict-Transport-Security header'
[[ "$hsts" =~ ^max-age=([0-9]+)(\;[[:space:]]*includeSubDomains)(\;[[:space:]]*preload)?$ && ${BASH_REMATCH[1]} -ge 31536000 ]] || alert_and_exit 'public root has unsafe Strict-Transport-Security header'
csp=$(header_value Content-Security-Policy "$headers") || alert_and_exit 'public root missing or duplicated Content-Security-Policy header'
[[ "$csp" == *"default-src 'self'"* && "$csp" == *"object-src 'none'"* && "$csp" == *"frame-ancestors 'none'"* ]] || alert_and_exit 'public root has unsafe Content-Security-Policy header'
permissions=$(header_value Permissions-Policy "$headers") || alert_and_exit 'public root missing or duplicated Permissions-Policy header'
[[ "$permissions" == *'camera=()'* && "$permissions" == *'microphone=()'* && "$permissions" == *'geolocation=()'* ]] || alert_and_exit 'public root has unsafe Permissions-Policy header'
[[ "$(header_value X-Content-Type-Options "$headers")" == nosniff ]] || alert_and_exit 'public root has unsafe X-Content-Type-Options header'
[[ "$(header_value X-Frame-Options "$headers")" == DENY ]] || alert_and_exit 'public root has unsafe X-Frame-Options header'
[[ "$(header_value Referrer-Policy "$headers")" == no-referrer ]] || alert_and_exit 'public root has unsafe Referrer-Policy header'

redirect_headers="$work/redirect.headers"
redirect_status=$(curl --silent --show-error --max-time "$probe_timeout" --connect-timeout "$connect_timeout" --retry "$retries" -D "$redirect_headers" -o /dev/null -w '%{http_code}' "$http_origin") || alert_and_exit 'HTTP redirect request failed'
[[ "$redirect_status" =~ ^30[1278]$ ]] || alert_and_exit "HTTP origin returned HTTP $redirect_status"
[[ "$(header_value Location "$redirect_headers")" == "$url" ]] || alert_and_exit 'HTTP origin redirect target mismatch'

request 'live health' "$url/api/health/live" 'application/json'
live=$(tr -d ' \t\r\n' <"$work/live health.body")
case "$live" in
  '{"status":"ok"}'|'{"status":"up"}'|'{"status":"healthy"}') ;;
  *) alert_and_exit 'live health response is not healthy JSON' ;;
esac
request 'ready health' "$url/api/health/ready" 'application/json'
ready=$(tr -d ' \t\r\n' <"$work/ready health.body")
case "$ready" in
  '{"status":"ok"}'|'{"status":"up"}'|'{"status":"healthy"}') ;;
  *) alert_and_exit 'ready health response is not healthy JSON' ;;
esac

tls_cert="$work/tls.cert"
timeout "${probe_timeout}s" openssl s_client -connect "$host:$port" -servername "$host" </dev/null >"$tls_cert" 2>/dev/null || alert_and_exit 'TLS connection failed or timed out'
openssl x509 -noout -checkhost "$host" <"$tls_cert" >/dev/null 2>&1 || alert_and_exit 'TLS hostname verification failed'
openssl x509 -noout -checkend "$tls_seconds" <"$tls_cert" >/dev/null 2>&1 || alert_and_exit 'TLS certificate expiry threshold reached'

request 'release marker' "$url$marker" 'application/json'
release=$(tr -d ' \t\r\n' <"$work/release marker.body")
[[ "$release" == "{\"sha\":\"$expected_sha\"}" ]] || alert_and_exit 'release SHA mismatch or invalid release JSON'

if $verbose; then
  printf 'JRC runtime monitor OK: %s\n' "$url"
fi
