# JRC XIV Roman Arena — Approved Implementation Spec

## Goal

Rebuild the legacy static JRC page as a premium Roman Empire × robotics competition platform with a cinematic public site and local participant/admin demo portal.

## Approach

Use Vite, React, TypeScript, Tailwind CSS, GSAP, Lenis, and a dynamically loaded React Three Fiber hero. Preserve `batu-knight.png` as a single authoritative transparent composition. Wide generated background derivatives extend only the source edges and never introduce duplicate architecture.

## Components

- Public site: gate, header, hybrid hero, competition explorer, schedule, history/J-Fest, partners, FAQ, CTA, and footer.
- Participant portal: local demo session, autosaved registration wizard, status, and review notes.
- Admin portal: filters, registration detail, review state transitions, notes, and CSV export.
- Data layer: typed content plus a localStorage repository that can later be replaced by Supabase.

## Data Flow

Public content is read from typed configuration. Portal UI talks only to `PortalRepository`; the local implementation persists versioned JSON in localStorage. No payment, real authentication, permanent uploads, email, or backend calls are included.

## Error Handling

Invalid local data resets to a seeded fixture. Form validation blocks invalid submission. WebGL failure keeps the complete static hero visible. Reduced-motion users receive final visual states without continuous animation.

## Testing Strategy

Use Vitest for content and repository behavior, Testing Library for route/UI interactions, and Playwright for desktop/mobile navigation, overflow, registration, admin review, reduced motion, and console errors.

## Out of Scope

Production deployment, Supabase integration, payment, real credentials, email, permanent document storage, and final official JRC XIV dates/fees.
