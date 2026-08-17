import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';

import EntryGate from '../components/motion/EntryGate';
import { SiteFooter } from '../components/public/SiteFooter';
import { SiteHeader } from '../components/public/SiteHeader';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminRegistrationDetailPage from '../pages/admin/AdminRegistrationDetailPage';
import CompetitionPage from '../pages/CompetitionPage';
import HomePage from '../pages/HomePage';
import PortalDashboardPage from '../pages/portal/PortalDashboardPage';
import PortalLoginPage from '../pages/portal/PortalLoginPage';
import PortalRegistrationPage from '../pages/portal/PortalRegistrationPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60_000,
    },
  },
});

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
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/perlombaan/:slug" element={<CompetitionPage />} />
      <Route path="/portal/masuk" element={<PortalLoginPage />} />
      <Route path="/portal" element={<PortalDashboardPage />} />
      <Route path="/portal/pendaftaran" element={<PortalRegistrationPage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/admin/pendaftaran/:registrationId" element={<AdminRegistrationDetailPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function RouteScrollManager() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (hash) {
          document
            .getElementById(decodeURIComponent(hash.slice(1)))
            ?.scrollIntoView({ block: 'start' });
          return;
        }

        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [hash, pathname]);

  return null;
}

function AppExperience() {
  const { pathname } = useLocation();
  const isOperationsRoute = pathname.startsWith('/portal') || pathname.startsWith('/admin');

  return (
    <>
      <RouteScrollManager />
      {!isOperationsRoute ? <EntryGate /> : null}
      <AppRoutes />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppExperience />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
