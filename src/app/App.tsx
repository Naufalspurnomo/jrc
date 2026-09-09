import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  Link,
  matchPath,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import EntryGate, { shouldPlayEntryGate } from '../components/motion/EntryGate';
import { SiteFooter } from '../components/public/SiteFooter';
import { SiteHeader } from '../components/public/SiteHeader';
import { findCompetition } from '../content/jrc';
import { RequireAuth } from '../features/auth';
import HomePage from '../pages/HomePage';

const CompetitionPage = lazy(() => import('../pages/CompetitionPage'));
const PortalDashboardPage = lazy(() => import('../pages/portal/PortalDashboardPage'));
const PortalLoginPage = lazy(() => import('../pages/portal/PortalLoginPage'));
const PortalPaymentPage = lazy(() => import('../pages/portal/PortalPaymentPage'));
const PortalRegistrationPage = lazy(() => import('../pages/portal/PortalRegistrationPage'));
const PortalSignupPage = lazy(() => import('../pages/portal/PortalSignupPage'));
const PortalEmailVerificationPage = lazy(
  () => import('../pages/portal/PortalEmailVerificationPage'),
);
const PortalTicketPage = lazy(() => import('../pages/portal/PortalTicketPage'));
const PublicTicketVerificationPage = lazy(
  () => import('../pages/ticket/PublicTicketVerificationPage'),
);
const AdminLoginPage = lazy(() => import('../pages/admin/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const AdminRegistrationDetailPage = lazy(
  () => import('../pages/admin/AdminRegistrationDetailPage'),
);
const AdminFinancePage = lazy(() => import('../pages/admin/AdminFinancePage'));
const AdminScannerPage = lazy(() => import('../pages/admin/AdminScannerPage'));

function NotFoundPage() {
  return (
    <div className="site-page site-page--competition-not-found">
      <SiteHeader />
      <main className="competition-not-found site-shell page-shell">
        <p className="site-kicker kicker">JRC XIV</p>
        <h1>Halaman tidak ditemukan.</h1>
        <p>Periksa kembali alamat halaman atau kembali ke beranda.</p>
        <Link className="site-action site-action--primary button-primary" to="/">
          Kembali ke beranda
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

export function AppRoutes({ homeStartupReady = true }: { homeStartupReady?: boolean } = {}) {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HomePage startupReady={homeStartupReady} />} />
        <Route path="/perlombaan/:slug" element={<CompetitionPage />} />
        <Route path="/portal/masuk" element={<PortalLoginPage />} />
        <Route path="/portal/daftar" element={<PortalSignupPage />} />
        <Route path="/portal/verifikasi-email" element={<PortalEmailVerificationPage />} />
        <Route path="/ticket/verify" element={<PublicTicketVerificationPage />} />
        <Route
          element={<RequireAuth roles={['PARTICIPANT']} redirectTo="/portal/masuk" />}
        >
          <Route path="/portal" element={<PortalDashboardPage />} />

          <Route path="/portal/pendaftaran/baru" element={<PortalRegistrationPage />} />
          <Route
            path="/portal/pendaftaran/:registrationId"
            element={<PortalRegistrationPage />}
          />
          <Route
            path="/portal/pendaftaran/:registrationId/pembayaran"
            element={<PortalPaymentPage />}
          />
          <Route
            path="/portal/pendaftaran/:registrationId/tiket"
            element={<PortalTicketPage />}
          />
          <Route
            path="/portal/pendaftaran"
            element={<Navigate replace to="/portal/pendaftaran/baru" />}
          />
        </Route>
        <Route path="/admin/masuk" element={<AdminLoginPage />} />
        <Route
          element={(
            <RequireAuth
              roles={['SUPER_ADMIN', 'REGISTRATION_REVIEWER', 'SUPPORT']}
              redirectTo="/admin/masuk"
            />
          )}
        >
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route
            path="/admin/pendaftaran/:registrationId"
            element={<AdminRegistrationDetailPage />}
          />
        </Route>
        <Route
          element={<RequireAuth roles={['SUPER_ADMIN', 'FINANCE']} redirectTo="/admin/masuk" />}
        >
          <Route path="/admin/finance" element={<AdminFinancePage />} />
        </Route>
        <Route
          element={<RequireAuth roles={['SUPER_ADMIN', 'GATE_STAFF']} redirectTo="/admin/masuk" />}
        >
          <Route path="/admin/scanner" element={<AdminScannerPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

function RouteScrollManager() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    const targetId = hash ? decodeURIComponent(hash.slice(1)) : '';
    let frame = 0;

    const applyScroll = () => {
      if (!targetId) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        return;
      }

      document.getElementById(targetId)?.scrollIntoView({ block: 'start', behavior: 'auto' });
    };

    frame = window.requestAnimationFrame(applyScroll);
    const observer = targetId
      ? new MutationObserver(() => {
          if (!document.getElementById(targetId)) return;
          applyScroll();
          observer.disconnect();
        })
      : null;
    observer?.observe(document.body, { childList: true, subtree: true });
    const observerTimeout = observer
      ? window.setTimeout(() => observer.disconnect(), 1_000)
      : 0;

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.clearTimeout(observerTimeout);
    };
  }, [hash, pathname]);

  return null;
}

const indexedRobots = 'index,follow,max-image-preview:large';
const privateRobots = 'noindex,nofollow';

function getRouteMetadata(pathname: string) {
  if (pathname === '/') {
    return {
      title: 'JRC XIV — Imperium Machina',
      robots: indexedRobots,
    };
  }

  const competitionMatch = matchPath('/perlombaan/:slug', pathname);
  const competition = findCompetition(competitionMatch?.params.slug);
  if (competition) {
    return {
      title: `${competition.shortName} — Perlombaan JRC XIV`,
      robots: indexedRobots,
    };
  }

  if (pathname === '/ticket/verify') {
    return {
      title: 'Verifikasi Tiket — JRC XIV',
      robots: privateRobots,
    };
  }

  const isParticipantPortal = pathname === '/portal' || pathname.startsWith('/portal/');
  if (isParticipantPortal) {
    return {
      title: 'Portal Peserta — JRC XIV',
      robots: privateRobots,
    };
  }

  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  if (isAdmin) {
    return {
      title: 'Admin JRC XIV',
      robots: privateRobots,
    };
  }

  return {
    title: 'Halaman Tidak Ditemukan — JRC XIV',
    robots: privateRobots,
  };
}

function AppExperience() {
  const { pathname } = useLocation();
  const metadata = getRouteMetadata(pathname);
  const initialPathname = useRef(pathname);
  const initialGate = useRef(
    initialPathname.current === '/' && window.location.hash === '' && shouldPlayEntryGate(),
  );
  const [showsEntryGate, setShowsEntryGate] = useState(initialGate.current);
  const [startupReady, setStartupReady] = useState(!initialGate.current);

  useEffect(() => {
    if (pathname !== '/') {
      setShowsEntryGate(false);
      setStartupReady(true);
    }
  }, [pathname]);

  useEffect(() => {
    document.title = metadata.title;
    const robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    robotsMeta?.setAttribute('content', metadata.robots);
  }, [metadata.robots, metadata.title]);

  return (
    <>
      <RouteScrollManager />
      {showsEntryGate ? (
        <EntryGate
          onComplete={() => {
            setShowsEntryGate(false);
            setStartupReady(true);
            window.dispatchEvent(new Event('jrc:gate-complete'));
          }}
        />
      ) : null}
      <AppRoutes homeStartupReady={startupReady} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppExperience />
    </BrowserRouter>
  );
}
