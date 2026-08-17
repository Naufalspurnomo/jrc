# JRC XIV — Imperium Machina

Website lokal JRC XIV bertema Roman Empire × modern robotics. Dibangun dengan Vite, React, TypeScript, Three.js, GSAP, Lenis, dan Tailwind CSS.

## Menjalankan lokal

Persyaratan: Node.js 24 atau lebih baru.

```powershell
npm install
npm run assets:prepare
npm run dev
```

Build dan verifikasi:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Route utama

- `/` — website publik dan cinematic hero.
- `/perlombaan/:slug` — detail kategori perlombaan.
- `/portal/masuk` — demo login peserta.
- `/portal` — dashboard peserta.
- `/portal/pendaftaran` — wizard pendaftaran lokal.
- `/admin` — demo command desk panitia.
- `/admin/pendaftaran/:registrationId` — detail dan review pendaftaran.

Portal adalah prototype lokal. Session, draft, metadata dokumen, dan review disimpan di `localStorage`; autentikasi nyata, upload permanen, email, backend, dan pembayaran belum diaktifkan.

## Asset pipeline

Master outpaint disimpan di `asset/generated-source`. `npm run assets:prepare` menghasilkan AVIF/WebP responsif, depth hint, serta foreground composite dengan alpha feathering ke `public/assets`.
