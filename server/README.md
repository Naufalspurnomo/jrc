# JRC Server Operations Guide

## Architecture and state invariants

JRC is a same-origin web application: Apache terminates HTTPS, serves the frontend, and proxies `/api` to the backend. PostgreSQL is the authoritative store. Private uploads stay outside the public web root and are returned only through authenticated, authorized API handlers. Email delivery uses a transactional outbox.

Preserve these invariants:

- Database migrations define the schema; never rely on application startup to invent or repair it.
- Registration, role, payment, attendance, and outbox state changes are committed transactionally.
- One account has one effective role. Server authorization remains authoritative.
- A payment becomes verified only after a reviewer matches it against bank history; an uploaded receipt alone is insufficient.
- Scanner submissions are idempotent. Repeated scans must not create duplicate check-ins.
- Session cookies are `HttpOnly`, `Secure` in production, and same-site. State-changing requests require CSRF validation.
- Browser API traffic remains same-origin. Do not expose the backend directly to browsers in production.
- Secrets, database dumps, logs, and private files never enter the frontend public tree.

## Role matrix

| Capability | Participant | Registration Reviewer | Finance | Gate Staff | Support | Super Admin |
|---|---:|---:|---:|---:|---:|---:|
| Manage own registrations and files | Yes | No | No | No | No | No |
| Review and decide registrations | No | Yes | No | No | Read only | Yes |
| Export safe registration CSV | No | Yes | No | No | Yes | Yes |
| View payment proof and mark payment | No | No | Yes | No | No | Yes |
| Inspect and redeem QR tickets | No | No | No | Yes | No | Yes |
| Access private registration documents | Own only | Yes | No | No | Yes | Yes |

## Local setup, environment, migrate, seed

From `/root/jrc/server`:

```bash
npm ci
cp .env.example .env
# Edit .env with local-only values. Never commit or paste secrets into documentation.
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

Use the example environment file as the variable contract. At minimum, provide the database connection, ticket secret, public origin, private-file path, payment instructions, and SMTP settings. For Compose, `POSTGRES_PASSWORD` is the raw database password while `COMPOSE_DATABASE_URL` contains the same password with reserved characters percent-encoded. Session and CSRF credentials are generated randomly by the server and stored only as hashes. Use distinct secrets and databases per environment.

## Tests

Unit suite only:

```bash
cd /root/jrc/server
RUN_E2E=0 npm test
```

E2E suite only, against its isolated test database:

```bash
cd /root/jrc/server
RUN_E2E=1 npm run test:e2e
```

Frontend suite:

```bash
cd /root/jrc
npm test
```

Do not point E2E tests at development or production data.

## Docker Compose: schema-first flow

From `/root/jrc`:

```bash
docker compose --env-file server/.env pull jrc-db
docker compose --env-file server/.env build jrc-migrate jrc-api
docker compose --env-file server/.env run --rm jrc-migrate npx tsx prisma/seed.ts  # first deployment or seed update
docker compose --env-file server/.env up -d
docker compose --env-file server/.env ps
```

`docker compose up -d` starts PostgreSQL, waits for readiness, runs `jrc-migrate`, then starts `jrc-api` only after migration success. For later releases, omit the explicit seed command unless the release requires an idempotent seed update. Migration failure blocks application rollout. Check resolved configuration before deployment:

```bash
docker compose --env-file server/.env config >/dev/null
```

## Apache HTTPS and scanner camera

Install `server/deploy/apache-jrc.conf`, enable the required modules, then validate and reload:

```bash
sudo a2enmod ssl proxy proxy_http headers rewrite
sudo a2ensite apache-jrc.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

Use a valid certificate, force HTTP to HTTPS, proxy `/api` to the private backend listener, and serve the frontend on the same origin. Set `TRUST_PROXY_HOPS=1` for this single local Apache hop so client IP-based rate limiting trusts only Apache. Keep the backend bound to loopback or the private Compose network; never expose it directly.

Camera access requires a secure context. Serve scanner pages over HTTPS, grant camera permission for the exact production origin, and test on the intended mobile browser. Do not embed the scanner cross-origin or add permissive camera/CORS headers. Keep `Referrer-Policy: no-referrer` and the query-free Apache access-log format: QR verification URLs contain an opaque bearer credential that the frontend removes from the address bar after capture.

## HttpOnly cookie, CSRF, same-origin API

- Authentication uses an `HttpOnly` session cookie; JavaScript must not read tokens.
- Production cookies use `Secure`, `SameSite=Lax`, `Path=/`, and explicit expiry.
- Every state-changing API request carries the server-issued CSRF token and is rejected on mismatch.
- Apache keeps frontend and `/api` under one HTTPS origin. Do not enable wildcard CORS or credentialed cross-origin access.
- Rotate session and CSRF secrets through the deployment secret store. Rotation may invalidate active sessions.

## Private files

Set the private-file directory to a persistent, non-public volume. Apache must not map or alias this directory. Downloads flow through an authenticated backend route that validates role, ownership, and record scope before streaming. Use generated storage names, preserve validated metadata separately, reject unsafe types and oversized files, and prevent path traversal. Include private files in backup and restore procedures.

## Manual payment: bank-history rule

A receipt upload creates evidence for review, not proof of payment. Finance or Admin must compare the claimed transfer against authoritative bank history using amount, destination account, timestamp/date, sender/reference where available, and uniqueness. Record reviewer, decision time, and audit note. Reject ambiguous, duplicated, reversed, or unmatched transfers. Never auto-verify from an image, filename, OCR result, or participant assertion alone.

## Gmail App Password and outbox

Use a dedicated Gmail account with 2-Step Verification and a Google App Password. Store the address and App Password only in the production secret store or protected environment file; never place them in source, Compose YAML, logs, screenshots, or this guide.

Configure SMTP for `smtp.gmail.com:587` with STARTTLS. The request transaction writes an outbox row; a worker sends it, records attempts, retries transient failures with backoff, and marks permanent failures for operator review. Delivery is at-least-once: a crash after SMTP acceptance but before the database SENT update can produce a duplicate notification, but it cannot duplicate payment or check-in state. Revoke and replace the App Password during credential rotation or suspected exposure.

## Backup and restore

Run from `/root/jrc/server`; inspect script usage before the first production run:

```bash
DATABASE_URL='postgresql://...' STORAGE_PATH=/srv/jrc/storage ./scripts/backup.sh
# Optional explicit destination:
DATABASE_URL='postgresql://...' STORAGE_PATH=/srv/jrc/storage ./scripts/backup.sh /srv/jrc/backups/release-001
```

Restore only into an empty or explicitly approved target:

```bash
DATABASE_URL='postgresql://...' STORAGE_PATH=/srv/jrc/storage \
  ./scripts/restore.sh /absolute/path/to/backup --confirm-restore
```

Keep encrypted off-host copies. Restrict permissions. Retain the database dump, private files, migration version, and manifest together. A backup is accepted only after restore testing and application health verification.

## Health

Check containers, Apache, backend health, and recent service logs:

```bash
cd /root/jrc
docker compose --env-file server/.env ps
curl --fail --silent --show-error https://YOUR_HOST/api/health/live
curl --fail --silent --show-error https://YOUR_HOST/api/health/ready
sudo apache2ctl configtest
docker compose --env-file server/.env logs --since=15m jrc-api
```

Healthy means HTTPS succeeds, the backend reports ready, database connectivity and migration state are current, required persistent volumes are mounted, and no crash/retry loop is present. Health responses must not expose secrets or internal stack traces.

## Deployment and rollback

1. Confirm backups and a recent restore test.
2. Validate production inputs and `docker compose config`.
3. Build/pull the intended release images.
4. Start the database, run migrations, then start application services.
5. Validate Apache, HTTPS, `/api/health`, runtime logs, authentication, payment review, scanner camera, private-file authorization, and outbox processing.
6. Keep the previous application image and configuration available until acceptance completes.

Rollback application code/config by restoring the previous image/configuration and restarting services. Do not blindly reverse a database migration. For incompatible schema changes, use the release-specific down migration only when proven safe; otherwise restore the pre-deployment database and private-file backup as one consistent set. Re-run health and the browser happy path after rollback.

## Production inputs

Provide through approved secret/configuration management:

- Public HTTPS hostname and canonical origin
- TLS certificate/key paths and renewal ownership
- PostgreSQL host/database/user/password and backup destination
- A strong `TICKET_SECRET`; changing it invalidates every active QR, so rotate only through a planned ticket reissue or dual-key migration. Server-generated session and CSRF credentials remain hashed in PostgreSQL
- Persistent private-file storage and PostgreSQL durability for the outbox
- Initial Admin bootstrap procedure, without embedding credentials
- Gmail SMTP address and App Password, if email is enabled
- Apache upstream address, trusted-proxy settings, cookie domain/path, and secure-cookie mode
- Retention, backup encryption, restore RTO/RPO, log retention, and monitoring destinations
- Scanner device/browser list and camera-permission ownership

## Verified evidence

Current acceptance evidence:

- Frontend unit tests: **59 passed**.
- Backend unit run: **88 passed**, with **7 E2E tests skipped** by design.
- Backend E2E run: **7 passed** separately.
- Browser happy path: verified.
- Migrations: verified.
- Backup and restore: verified.
- Runtime audit and health: verified.

Re-run and archive equivalent evidence for every production release; these counts describe the currently verified revision, not a permanent guarantee.
