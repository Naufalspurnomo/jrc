# Cloud migration runbook

## Target architecture

- Vercel hosts the Vite frontend. `VITE_API_ORIGIN` selects the verified API origin.
- Render runs `server/Dockerfile`; a persistent disk is mounted at `/var/data/jrc-storage`.
- Supabase Postgres supplies `DATABASE_URL`; no Render database is assumed.
- The current VPS remains the rollback floor until retirement is approved. Create and verify a fresh migration export before each cutover attempt.

**No DNS switch is permitted until the replacement API, frontend, database, storage, and email are verified.**

## Required provider configuration

- Vercel: `VITE_API_ORIGIN`.
- Render: all `sync: false` values in `render.yaml`, covering database, CORS, cookie/session security, public URLs, event pricing, payment, and SMTP delivery.
- Cross-site cookies: `COOKIE_SAME_SITE=none` requires `COOKIE_SECURE=true`; restrict `CORS_ORIGINS` to exact HTTPS frontend origins.

Never invent or pre-record project IDs, deployment URLs, credentials, or secret values.

## Ordered cutover gates

1. Preserve the VPS commit; capture fresh database and private-storage exports; verify checksums and restore procedure.
2. Activate owner-controlled Vercel, Render, and Supabase projects.
3. Apply existing migrations to empty Supabase Postgres; validate schema, backups, and access controls.
4. Create the Render service and disk; enter every required environment value.
5. Import a fresh database export and private files; compare row counts, file counts, and checksums.
6. Verify API live/ready health, authentication, CSRF, registration, uploads/downloads, finance review, tickets, and logout.
7. Send a real transactional email; verify provider acceptance and external mailbox delivery.
8. Deploy the reviewed frontend with the verified API origin; test SPA deep links and participant/staff browser flows.
9. Rehearse rollback; record owners, triggers, and observation window.
10. Compare final database and storage evidence. Approve DNS only when every replacement component passes.
11. Observe errors, auth, uploads, email, and data integrity. Retire the VPS only after the agreed window.

Retain timestamps, source commit, deployment identifiers, HTTP results, migration output, counts, checksums, and delivery evidence for each gate. Provider “deployed” status alone is insufficient.
