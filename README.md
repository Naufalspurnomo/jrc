# JRC XIV Frontend

Frontend for the JRC XIV public website, participant portal, and administration interface. Built with React, TypeScript, Vite, Tailwind CSS, GSAP, and Lenis.

## Requirements

- Node.js 22.12 or newer
- npm

## Development

```bash
npm install
npm run dev
```

## Available commands

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run typecheck
```

## Project structure

```text
src/
├── app/                    Route composition and page metadata
├── components/             Shared interface components
├── content/                Public event content
├── features/hero/          Hero rendering and asset contract
├── features/registration/  Registration model, repository contract, and local adapter
├── hooks/                  Motion and document behavior
├── pages/                  Public, participant, and administration routes
└── styles/                 Base, section, and system styles
```

## Routes

- `/` — public website
- `/perlombaan/:slug` — competition details
- `/portal/masuk` — participant sign-in demo
- `/portal` — participant dashboard
- `/portal/pendaftaran` — registration demo
- `/admin` — administration dashboard demo
- `/admin/pendaftaran/:registrationId` — registration review demo

## Backend integration

Participant and administration pages depend on `PortalRepository` from `src/features/registration/repository.ts`. The current singleton uses `LocalPortalRepository` and browser `localStorage` for demonstration data.

A production backend must provide authentication, registration persistence, document storage, payment processing, email delivery, and administration authorization. Replace the local adapter at `src/features/registration/index.ts` when the backend API is available.

Production assets are committed under `public/assets`. Preserve `THIRD_PARTY_NOTICES.txt` when redistributing attributed media.
