import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve(__dirname, '../scripts/monitor-runtime.sh');
const deploy = resolve(__dirname, '../deploy');
const sha = '0123456789abcdef0123456789abcdef01234567';
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'jrc-monitor-'));
  const curl = `#!/usr/bin/env bash
set -eu
url="\${!#}"; headers=''; body=''; data='';
while (($#)); do case "$1" in -D) headers=$2; shift 2;; -o) body=$2; shift 2;; -w) shift 2;; --data-binary) data=$2; shift 2;; *) shift;; esac; done
if [[ "$url" == https://alerts.invalid/* ]]; then
  [[ \${FAKE_WEBHOOK_FAIL:-0} == 0 ]] || exit 22
  printf '%s' "$data" >"$FAKE_WEBHOOK_PAYLOAD"; exit 0
fi
case "$url" in
  http://example.test|http://example.test:8080) code=301; ct=text/plain; content=''; extra="Location: \${FAKE_REDIRECT:-https://example.test}";;
  https://example.test|https://example.test:8443) code=200; ct=text/html; content='<html>JRC</html>'; extra="\${FAKE_ROOT_HEADERS:-}"; [[ -n "$extra" ]] || extra=$'Strict-Transport-Security: max-age=31536000; includeSubDomains\\nContent-Security-Policy: default-src \\'self\\'; object-src \\'none\\'; frame-ancestors \\'none\\'\\nPermissions-Policy: camera=(), microphone=(), geolocation=()\\nX-Content-Type-Options: nosniff\\nX-Frame-Options: DENY\\nReferrer-Policy: no-referrer';;
  */api/health/live) code=\${FAKE_LIVE_STATUS:-200}; ct=\${FAKE_LIVE_CT:-application/json}; content=\${FAKE_LIVE_BODY:-'{"status":"ok"}'}; extra='';;
  */api/health/ready) code=200; ct=application/json; content=\${FAKE_READY_BODY:-'{"status":"ok"}'}; extra='';;
  */release.json) code=200; ct=application/json; content=\${FAKE_RELEASE_BODY:-'{"sha":"${sha}"}'}; extra='';;
  *) exit 22;;
esac
[[ -z "$headers" ]] || printf 'HTTP/1.1 %s Test\\nContent-Type: %s\\n%s\\n\\n' "$code" "$ct" "$extra" >"$headers"
[[ -z "$body" || "$body" == /dev/null ]] || printf '%s' "$content" >"$body"
printf '%s' "$code"
`;
  const openssl = `#!/usr/bin/env bash
if [[ " $* " == *' s_client '* ]]; then [[ \${FAKE_TLS_STALL:-0} == 0 ]] || sleep 20; printf '%s\\n' CERT; exit 0; fi
if [[ " $* " == *' -checkhost '* ]]; then cat >/dev/null; exit \${FAKE_TLS_HOST_FAIL:-0}; fi
if [[ " $* " == *' -checkend '* ]]; then cat >/dev/null; exit \${FAKE_TLS_EXPIRY_FAIL:-0}; fi
exit 1
`;
  await writeFile(join(dir, 'curl'), curl); await chmod(join(dir, 'curl'), 0o755);
  await writeFile(join(dir, 'openssl'), openssl); await chmod(join(dir, 'openssl'), 0o755);
});
afterEach(async () => rm(dir, { recursive: true, force: true }));

function run(env: Record<string,string> = {}, args: string[] = []) {
  return spawnSync('bash', [script, ...args], { encoding: 'utf8', timeout: 8000, env: { ...process.env, PATH: `${dir}:/usr/bin:/bin`, JRC_PUBLIC_URL: 'https://example.test', JRC_EXPECTED_RELEASE_SHA: sha, JRC_PROBE_TIMEOUT_SECONDS: '2', JRC_CONNECT_TIMEOUT_SECONDS: '1', JRC_RETRIES: '1', ...env } });
}
function fails(env: Record<string,string>) { const r=run(env); expect(r.status).not.toBe(0); expect(r.stderr.trim().split('\n')).toHaveLength(1); }

describe('runtime monitor', () => {
  it('is silent healthy and concise verbose', () => { expect(run().stdout).toBe(''); expect(run().status).toBe(0); expect(run({},['--verbose']).stdout).toBe('JRC runtime monitor OK: https://example.test\n'); });
  it.each(['junk{"status":"ok"}','{"status":"ok"}junk','{"outer":{"status":"ok"}}','{"status":"ok","extra":1}','{"status":"bad"}','[]'])('strictly rejects health JSON %s', body => fails({FAKE_LIVE_BODY:body}));
  it.each([`junk{"sha":"${sha}"}`,`{"nested":{"sha":"${sha}"}}`,`{"sha":"${sha}","commit":"${sha}"}`,`{"sha":"${sha}","sha":"${sha}"}`,`{"sha":"${sha.toUpperCase()}"}`,`{"sha":"${sha}","extra":1}`])('strictly rejects release JSON %s', body => fails({FAKE_RELEASE_BODY:body}));
  it('requires expected release SHA', () => fails({JRC_EXPECTED_RELEASE_SHA:''}));
  it.each(['https://bad_host','https://-bad.test','https://bad-.test','https://example..test','https://example.test:0','https://example.test:65536','https://user@example.test','https://example.test/path','https://example.test?q=x','https://example.test#x'])('rejects invalid public origin %s', value => fails({JRC_PUBLIC_URL:value}));
  it('supports separate HTTP origin with custom HTTPS port', () => { const r=run({JRC_PUBLIC_URL:'https://example.test:8443',JRC_HTTP_ORIGIN:'http://example.test:8080',FAKE_REDIRECT:'https://example.test:8443'}); expect(r.status).toBe(0); });
  it('accepts the equivalent root-slash redirect only', () => { expect(run({FAKE_REDIRECT:'https://example.test/'}).status).toBe(0); fails({FAKE_REDIRECT:'https://example.test/path'}); });
  it('allows same-origin camera while denying microphone and geolocation', () => { const r=run({FAKE_ROOT_HEADERS:"Strict-Transport-Security: max-age=31536000; includeSubDomains\nContent-Security-Policy: default-src 'self'; object-src 'none'; frame-ancestors 'none'\nPermissions-Policy: camera=(self), microphone=(), geolocation=()\nX-Content-Type-Options: nosniff\nX-Frame-Options: DENY\nReferrer-Policy: no-referrer"}); expect(r.status).toBe(0); });
  it.each(['http://example.test:0','https://example.test','http://bad_host'])('rejects invalid HTTP origin %s', value => fails({JRC_HTTP_ORIGIN:value}));
  it.each(['0','999999999999999999999'])('rejects unsafe probe timeout %s', value => fails({JRC_PROBE_TIMEOUT_SECONDS:value}));
  it.each(['0','999999999999999999999'])('rejects unsafe TLS warning %s', value => fails({JRC_TLS_WARNING_SECONDS:value}));
  it.each(['0','999999999999999999999'])('rejects unsafe retries %s', value => fails({JRC_RETRIES:value}));
  it('bounds stalled TLS', () => { const r=run({FAKE_TLS_STALL:'1',JRC_PROBE_TIMEOUT_SECONDS:'1'}); expect(r.status).not.toBe(0); expect(r.signal).toBeNull(); expect(r.stderr).toContain('TLS'); });
  it.each([
    'Strict-Transport-Security: max-age=1; includeSubDomains',
    'Strict-Transport-Security: max-age=31536000',
    "Content-Security-Policy: default-src *; object-src 'none'; frame-ancestors 'none'",
    'Permissions-Policy: camera=*',
    'X-Content-Type-Options: sniff',
    'X-Frame-Options: ALLOWALL',
    'Referrer-Policy: unsafe-url',
    'X-Frame-Options: DENY\\nX-Frame-Options: SAMEORIGIN',
  ])('rejects unsafe or incomplete headers', line => fails({FAKE_ROOT_HEADERS:line}));
  it('rejects SPA health content type', () => fails({FAKE_LIVE_CT:'text/html',FAKE_LIVE_BODY:'<html/>'}));
  it.each(['http://alerts.invalid/h','https://user@alerts.invalid/h','https://bad_host/h'])('rejects unsafe webhook %s', value => fails({JRC_ALERT_WEBHOOK_URL:value,FAKE_LIVE_STATUS:'503'}));
  it('sends JSON-scrubbed alert and webhook failure never masks monitor failure', async () => { const payload=join(dir,'payload'); const r=run({FAKE_LIVE_STATUS:'503',JRC_ALERT_WEBHOOK_URL:'https://alerts.invalid/hook/secret-token',FAKE_WEBHOOK_PAYLOAD:payload}); expect(r.status).not.toBe(0); const raw=await readFile(payload,'utf8'); expect(JSON.parse(raw).message).toContain('live health'); expect(raw).not.toMatch(/secret-token|JRC_ALERT_WEBHOOK_URL|FAKE_LIVE_BODY/); fails({FAKE_LIVE_STATUS:'503',JRC_ALERT_WEBHOOK_URL:'https://alerts.invalid/h',FAKE_WEBHOOK_FAIL:'1',FAKE_WEBHOOK_PAYLOAD:payload}); });
});

describe('systemd contract', () => {
  it('is hardened, bounded, release-pinned, persistent, randomized', async () => { const service=await readFile(join(deploy,'jrc-monitor.service'),'utf8'); const timer=await readFile(join(deploy,'jrc-monitor.timer'),'utf8'); const env=await readFile(join(deploy,'jrc-monitor.env.example'),'utf8'); expect(service).toMatch(/User=jrc-monitor/); expect(service).toContain('Type=oneshot'); expect(service).toContain('EnvironmentFile=/etc/jrc/monitor.env'); expect(service).toContain('ExecStart=/opt/jrc/bin/monitor-runtime.sh'); expect(service).toMatch(/TimeoutStartSec=\d+/); expect(service).toContain('ProtectSystem=strict'); expect(timer).toContain('Persistent=true'); expect(timer).toContain('RandomizedDelaySec='); expect(env).toMatch(/^JRC_EXPECTED_RELEASE_SHA=[0-9a-f]{40}$/m); expect(env).toContain('useradd'); expect(env).not.toMatch(/password|secret-token/i); });
});
