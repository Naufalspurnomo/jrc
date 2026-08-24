# JRC XIV Client Handoff Audit

Audit date: 2026-08-23
Public preview: http://46.250.238.167:20131/

## Verdict

Release candidate passed the automated, functional, responsive, accessibility, dependency, and deployment gates listed below.

Official JRC XIV dates, fees, category rules, guidebooks, contacts, and partner identities remain intentionally marked as pending. The participant/admin flows are explicitly labeled as local demos and do not submit data to an official backend.

## Verified Gates

- ESLint: passed
- TypeScript: passed
- Vitest: 14 files, 53 tests passed
- Playwright: 8 passed, 2 intentional project skips
- Production build: passed
- Production dependency audit: 0 vulnerabilities
- Lighthouse mobile: Performance 65, Accessibility 100, Best Practices 100, SEO 100
- Lighthouse desktop: Performance 71, Accessibility 100, Best Practices 100, SEO 100
- Public routes: no horizontal overflow, no broken images, no console errors during E2E
- Reduced motion: static hero fallback verified, WebGL omitted
- Desktop WebGL: deferred until user interaction
- Mobile competition modal: bottom actions verified reachable after scrolling
- SPA detail-to-home hash return: verified

## Resolved Release Blockers

1. Fixed competition detail return to `/#perlombaan` with Lenis hash synchronization.
2. Fixed inaccessible mobile modal overflow; bottom actions can now be reached and used.
3. Fixed mobile navigation overlap and open-state labeling.
4. Fixed mobile and desktop contrast failures and accessible-name mismatches.
5. Lazy-loaded detail, participant, and admin routes.
6. Removed the unused React Query provider and dependency.
7. Split React from the Three.js chunk and kept HeroCanvas dynamic.
8. Deferred WebGL and desktop motion until interaction; static rendering remains complete.
9. Reduced the initial main bundle and optimized hero/portrait assets.
10. Added complete Wikimedia Commons attribution and a visible footer attribution link.
11. Added route-aware titles and `noindex,nofollow` for demo/admin/unknown routes.
12. Replaced the Vite preview process with Apache static production serving on port 20131.
13. Added immutable asset caching, gzip, CSP, Permissions Policy, Referrer Policy, MIME protection, and frame denial.
14. Fixed flaky EntryGate and portal registration tests.

## Deployment

- Document root: `/var/www/jrc`
- Source/build root: `/root/jrc`
- Server: Apache 2.4 on ports 20130 and 20131
- Service marker: `jrc.service` (`active (exited)` is expected for the static deployment)
- SPA fallback: enabled
- Hashed assets: one-year immutable cache
- HTML and robots: no-cache

## Required Client Inputs Before Official Launch

- Confirm or replace `Est. 2012`.
- Supply official JRC XIV dates and registration window.
- Approve final categories and participant levels.
- Supply official fees and guidebooks.
- Supply the official contact channel.
- Supply confirmed partner logos and permissions.
- Decide whether the local participant/admin demo remains visible.
- Supply a production domain and HTTPS certificate.
- Supply final social preview image, canonical URL, and official analytics requirements.

## Known Non-Blocking Constraint

The Three.js chunk remains large, but it is not part of the initial static load and mounts only after desktop interaction. Mobile and reduced-motion environments keep the static hero and never mount WebGL.

## Reproduction Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm audit --omit=dev --audit-level=moderate
```
