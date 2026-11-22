# JRC Production Cutover Contract

This is the release gate and owner-input record. Blank, inferred, sample, staging, or default values are **not approval**. Organizer decisions are owner-only. Technical checks may be automated; production authority and business facts may not be guessed.

## Owner-only organizer input checklist

Deliver confidential values through a secure delivery channel: approved password manager or encrypted, access-controlled secret store; use a separately authenticated channel for access grants. Never use Git, tickets, chat, screenshots, build logs, or this file for secrets or personal data.

- [ ] Production origin; DNS owner/delegation; TLS and vhost authority
- [ ] Exact event identity; event day; timezone; schedule; venue/address
- [ ] Approved fees, currency, payment deadline; official bank beneficiary/account; official QRIS artifact/merchant identity
- [ ] Eligibility; team size/composition; quota; waitlist admission/promotion rules
- [ ] Refund, cancellation, dispute, chargeback, and no-show policy
- [ ] Registration document checklist, formats, limits, and correction rules
- [ ] Review SLA and payment SLA; escalation contacts and public/support contacts
- [ ] Privacy notice/controller; consent basis; data, document, audit-log, and backup retention/deletion periods
- [ ] Named staff identities and least-privilege roles (admin, reviewer, finance, gate, support)
- [ ] Scanner devices/browsers; physical camera owner; scanner network, fallback, and charging plan
- [ ] Alert recipients/escalation path; approved RTO and RPO

Record each decision in the organizer-controlled approval record. No default, prior event value, silence, or technical fallback is treated as approval.

## Candidate prerequisites and provenance

- [ ] Freeze one exact SHA. `RELEASE_SHA` is the full SHA and is not `unknown`; reject unset, shortened, mismatched, or `unknown` values.
- [ ] CI evidence for that exact SHA passes current frontend/backend unit and E2E suites, lint, typecheck, and builds. Preserve outputs, timestamps, versions, exit status; never rely on fixed test counts.
- [ ] Build/pull immutable API and migration image references. Record registry/repository digest for each; inspect `Config.Labels` from `docker image inspect`, verify the OCI revision label (`org.opencontainers.image.revision`), and require exact SHA equality. Record the pinned PostgreSQL digest. Resolved Compose must use those immutable images, not local tags.
- [ ] Render `docker compose config` with the approved environment. Redact secrets before archiving; reject accidental plaintext credentials or secret-bearing labels.
- [ ] Run a full resolved Apache-tree audit (`apache2ctl -t -D DUMP_RUN_CFG`, vhosts/modules, and every active `Include`/`IncludeOptional` target), not merely the repository vhost. Require configtest success, HTTPS/certificate, same-origin `/api`, private upstream, security headers, and query-free logs.

## Rehearsal evidence

- [ ] **Schema-first:** back up first; run the exact migration image against a production-equivalent restore; prove migration success/idempotency and schema compatibility before API start. Review irreversible/data-transforming migrations explicitly.
- [ ] Produce encrypted database plus private-storage backup. Restore both into an isolated empty target; verify manifest/checksums, row/file consistency, login, health, and representative private-file authorization. Record measured restore time against RTO/RPO.
- [ ] Run synthetic unique-marker requests containing query, `Authorization`, and `Cookie` canaries through HTTP redirect, HTTPS frontend, API success/failure, and proxy error paths. Search the full resolved Apache tree and all Apache/app/container/error/access logs. Any query/auth/cookie log leak fails the gate; destroy canary sessions afterward.
- [ ] Send through the production SMTP route to an external mailbox. Read back headers/body, correlate recipient/message and outbox terminal state/retries, redact evidence, and prove no secret-bearing link entered logs.
- [ ] On every approved scanner device/network, perform physical camera acceptance over the exact production HTTPS origin: permission prompt, rear-camera scan, invalid/valid/already-used ticket behavior, offline/error recovery, and readable staff feedback.

## Atomic cutover, canary, monitoring

1. Confirm maintenance window, change owner, rollback owner, previous immutable image/config, verified backup, and open decision channel.
2. Stop writes if required by the migration plan. Take the final consistent backup. Apply schema-first migration; verify migration table/schema. **Rollback decision:** stop on migration error, unexpected lock/duration, integrity discrepancy, or incompatible schema; do not start the new API or blindly down-migrate.
3. Start the exact API image privately. Canary health, anonymous denial, authentication/CSRF/cookies, registration, authorized private file, payment-review boundary, outbox, and scanner path. **Rollback decision:** restore prior API image if schema remains backward-compatible; otherwise execute only the pre-approved restore/recovery plan.
4. Perform one atomic switch of Apache upstream/static release. Validate externally from clean clients and DNS paths; keep old release addressable but not writable.
5. Complete monitoring activation before general traffic: uptime/readiness, HTTP 5xx/latency, DB/storage capacity, migration state, outbox failures/age, login/rate-limit anomalies, backup failures, and certificate expiry routed to approved alert recipients. Record the systemd monitor installation owner and monitor activation owner. Install, enable, start, and verify each monitor unit and timer; archive unit status and alert-delivery evidence.
6. Open a bounded canary cohort. Compare errors, latency, queue depth, registration/payment/check-in audit events, and support reports against thresholds. Expand only on explicit release-owner approval.

## Exact no-go criteria

No cutover, or immediate halt before wider traffic, if **any** item is true: organizer approval incomplete; authority/secure delivery unclear; `RELEASE_SHA` absent/short/mismatched/`unknown`; image reference mutable or digest/revision mismatch; required suite/build evidence failed or missing; Compose contains unintended exposure or secrets; migration/rehearsal failed, destructive step unapproved, or schema incompatible; backup missing or restore/checksum/application proof failed or exceeds approved RTO/RPO; resolved Apache audit/configtest/TLS/same-origin/log policy failed; any synthetic query, Authorization, Cookie, credential, or bearer marker appears in logs; external SMTP send/readback/outbox correlation failed; physical camera acceptance failed on an approved device/network; canary health/auth/private-file/payment/ticket checks failed; monitoring/alerts inactive; rollback owner, artifact, decision threshold, or recovery path unavailable.

## Organizer sign-off

No fabricated or placeholder values. Reference the controlled approval record rather than copying secrets.

| Approval | Name/role | Decision | UTC timestamp | Controlled record/evidence ID |
|---|---|---|---|---|
| Business/event inputs |  | Approve / Reject |  |  |
| Privacy/finance/policy |  | Approve / Reject |  |  |
| Technical release/cutover |  | Go / No-go |  |  |
| Rollback owner acknowledgment |  | Accepted / Rejected |  |  |