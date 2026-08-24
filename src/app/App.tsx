import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  Link,
  matchPath,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import EntryGate from '../components/motion/EntryGate';
import { SiteFooter } from '../components/public/SiteFooter';
import { SiteHeader } from '../components/public/SiteHeader';
import { findCompetition } from '../content/jrc';
import HomePage from '../pages/HomePage';

const CompetitionPage = lazy(() => import('../pages/CompetitionPage'));
const PortalDashboardPage = lazy(() => import('../pages/portal/PortalDashboardPage'));
const PortalLoginPage = lazy(() => import('../pages/portal/PortalLoginPage'));
const PortalRegistrationPage = lazy(() => import('../pages/portal/PortalRegistrationPage'));
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const AdminRegistrationDetailPage = lazy(
  () => import('../pages/admin/AdminRegistrationDetailPage'),
);

function NotFoundPage() {
  return (
    <div className="site-page site-page--competition-not-found">
      <SiteHeader />
      <main className="competition-not-found site-shell page-shell">
        <p className="site-kicker kicker">Error · CDIV</p>
        <h1>Arena tidak ditemukan.</h1>
        <p>Gerbang ini tidak tercatat dalam peta JRC XIV.</p>
        <Link className="site-action site-action--primary button-primary" to="/">
          Kembali ke beranda
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/perlombaan/:slug" element={<CompetitionPage />} />
        <Route path="/portal/masuk" element={<PortalLoginPage />} />
        <Route path="/portal" element={<PortalDashboardPage />} />
        <Route path="/portal/pendaftaran" element={<PortalRegistrationPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route
          path="/admin/pendaftaran/:registrationId"
          element={<AdminRegistrationDetailPage />}
        />
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

  const isParticipantPortal = ['/portal', '/portal/masuk', '/portal/pendaftaran'].includes(pathname);
  if (isParticipantPortal) {
    return {
      title: 'Portal Peserta Demo — JRC XIV',
      robots: privateRobots,
    };
  }

  const isAdmin = pathname === '/admin'
    || matchPath('/admin/pendaftaran/:registrationId', pathname) !== null;
  if (isAdmin) {
    return {
      title: 'Admin Demo — JRC XIV',
      robots: privateRobots,
    };
  }

  return {
    title: 'Arena Tidak Ditemukan — JRC XIV',
    robots: privateRobots,
  };
}

function AppExperience() {
  const { pathname } = useLocation();
  const metadata = getRouteMetadata(pathname);
  const initialPathname = useRef(pathname);
  const [showsEntryGate, setShowsEntryGate] = useState(initialPathname.current === '/');

  useEffect(() => {
    if (pathname !== '/') setShowsEntryGate(false);
  }, [pathname]);

  useEffect(() => {
    document.title = metadata.title;
    const robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    robotsMeta?.setAttribute('content', metadata.robots);
  }, [metadata.robots, metadata.title]);

  return (
    <>
      <RouteScrollManager />
      {showsEntryGate ? <EntryGate onComplete={() => setShowsEntryGate(false)} /> : null}
      <AppRoutes />
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
