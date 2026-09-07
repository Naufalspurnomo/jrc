# JRC Presentation QA Runbook

Use this checklist before every stakeholder presentation. Operational deployment details remain in `server/README.md`.

## No-go rule

Do not present if any item below fails, if the browser shows console errors, if `/api/health/ready` is not HTTP 200, if migrations are pending, if camera permission has not been tested on the actual HTTPS host/device, or if real SMTP and payment instructions are not configured for the target environment.

## Prerequisites

- Isolated PostgreSQL database; never rehearse against production data.
- Current frontend and backend build from the intended commit.
- HTTPS when testing a physical camera.
- Persistent private storage outside the public web root.
- Strong test-only credentials supplied through environment variables.
- Accounts for `SUPER_ADMIN`, `REGISTRATION_REVIEWER`, `FINANCE`, `GATE_STAFF`, and `SUPPORT`.
- One fresh participant email.

## Reset and seed

From `server/`, point `DATABASE_URL` at the isolated presentation database, then run:

```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
npx prisma migrate status
```

Supply event, fee, deadline, and staff seed variables documented in `server/.env.example`. Do not store presentation passwords in Git.

Expected:

- Three migrations applied.
- Six active competitions.
- Every configured staff role can authenticate.
- `/api/health/live` and `/api/health/ready` return HTTP 200.

## Participant rehearsal

1. Register a new participant account. Expected: redirect to `/portal`.
2. Create a registration. Expected: `DRAFT`.
3. Add a leader and member. Expected: first member `LEADER`, later members `MEMBER`.
4. Save edits to persisted members, then remove one non-leader. Reload and confirm persistence.
5. Upload a valid PDF/JPEG/PNG document. Expected: private metadata appears; no storage key appears.
6. Try submit without a document in a separate fixture. Expected: HTTP 400.
7. Submit the complete registration. Expected: `SUBMITTED`; controls become read-only.
8. Confirm dashboard status and registration number.

## Reviewer rehearsal

1. Login as `REGISTRATION_REVIEWER`.
2. Open the submitted registration and download its private document.
3. Move `SUBMITTED` to `UNDER_REVIEW`.
4. Request revision with a reason. Expected: `REVISION_REQUESTED`; participant sees the reason.
5. Login as participant, update data, save persisted members, then resubmit. Expected: `SUBMITTED`.
6. Login as reviewer, move to `UNDER_REVIEW`, then `APPROVED`.
7. Expected: one invoice is created atomically with payment status `UNPAID`.
8. In a separate fixture, reject a candidate with a reason. Expected: `REJECTED` and no invoice.

## Finance rehearsal

1. Login as participant and open payment instructions.
2. Upload payment proof. Expected: `PENDING_VERIFICATION`, never `PAID` automatically.
3. Login as `FINANCE`; open the proof and compare it with authoritative bank history.
4. Reject the first proof with a reason. Expected: `REJECTED`.
5. Login as participant; upload replacement proof. Expected: `PENDING_VERIFICATION`.
6. Login as finance; mark paid with a bank reference. Expected: `PAID`; finance queue removes the item; one ticket is issued.

## Ticket and gate rehearsal

1. Login as participant and open the ticket page. Expected: QR appears and token length is 43 base64url characters.
2. Open the public verification URL. Expected: `VALID`; query parameters disappear from the browser address bar after capture.
3. Confirm public output contains only team, institution, competition, registration number, and event.
4. Confirm public output excludes email, phone, member IDs, documents, payment proof, and storage keys.
5. Verify a forged token. Expected: `UNKNOWN`.
6. Verify the valid token with another event. Expected: `WRONG_EVENT`.
7. Login as `GATE_STAFF`; inspect the ticket. Expected: `VALID`.
8. Confirm check-in. Expected: `CHECKED_IN`.
9. Inspect the same QR again. Expected: `ALREADY_CHECKED_IN`; no second check-in audit.
10. Test camera start and stop on the actual HTTPS presentation device. Expected: permission prompt works, preview appears, all tracks stop when closed.

## Role isolation

- `SUPPORT`: registration list/detail/export only; review and finance actions return HTTP 403.
- `REGISTRATION_REVIEWER`: registration review only.
- `FINANCE`: finance queue/proof/payment decision only.
- `GATE_STAFF`: scanner inspect/redeem only.
- `SUPER_ADMIN`: all admin sections.
- Participant access to another participant registration returns HTTP 404.
- Every state-changing request without CSRF returns HTTP 403.

## Visual checks

Test these pages at 320, 360, 375, 768, and 1280 pixels:

- Participant login/signup/dashboard/registration/payment/ticket.
- Admin dashboard/detail/finance/scanner.
- Public ticket verification.

Expected:

- No horizontal document overflow.
- No clipped or overlapping controls.
- Tables become readable mobile cards or scroll only inside their container.
- Buttons remain at least 44 pixels tall.
- Error/status text remains visible.
- Camera controls remain reachable.

## Email, backup, and restore

- Send invoice, revision/rejection, payment rejection, and paid/ticket messages through the real presentation SMTP account.
- Confirm delivery and inspect the outbox for retries/failures.
- Run `server/scripts/backup.sh` against the isolated environment.
- Restore into another isolated database/storage path with `--confirm-restore`.
- Verify one database marker and one private file after restore.

## Ten-minute recovery

1. Keep the last known-good frontend build and Docker image locally.
2. Keep the presentation database backup and storage archive ready.
3. If data is dirty, restore the isolated backup or recreate the database and rerun migration/seed.
4. If camera permission fails, use scanner manual token input while fixing browser permission.
5. If SMTP is delayed, show the durable outbox state; never claim delivery that was not observed.
6. If any invariant fails, stop the demo rather than editing payment/ticket state directly in the database.

## Final evidence to record

- Commit SHA.
- Frontend/backend test totals.
- Migration status.
- Health responses.
- Mobile viewport report.
- Physical-camera result.
- SMTP delivery result.
- Final database status: registration, invoice, ticket, and exactly one check-in audit.
