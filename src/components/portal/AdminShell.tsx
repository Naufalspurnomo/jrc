import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../../features/auth';
import type { AuthRole } from '../../features/registration/api';

interface AdminShellProps {
  children: ReactNode;
  onSignOut?: () => void;
}

const registrationRoles = new Set<AuthRole>([
  'SUPER_ADMIN',
  'REGISTRATION_REVIEWER',
  'SUPPORT',
]);
const financeRoles = new Set<AuthRole>(['SUPER_ADMIN', 'FINANCE']);
const scannerRoles = new Set<AuthRole>(['SUPER_ADMIN', 'GATE_STAFF']);

const roleLabels: Record<AuthRole, string> = {
  PARTICIPANT: 'Peserta',
  SUPER_ADMIN: 'Super Admin',
  REGISTRATION_REVIEWER: 'Peninjau Pendaftaran',
  FINANCE: 'Keuangan',
  GATE_STAFF: 'Petugas Gerbang',
  SUPPORT: 'Dukungan',
};

function safeDisplayName(displayName: string | undefined): string {
  const normalizedName = displayName?.replace(/\s+/g, ' ').trim().slice(0, 80);
  return normalizedName || 'Panitia JRC';
}

export function AdminShell({ children }: AdminShellProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const role = auth?.user?.role;
  const displayName = safeDisplayName(auth?.user?.displayName);
  const roleLabel = role ? roleLabels[role] : 'Panitia';

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await auth.logout();
    } catch {
      // AuthProvider clears the local session even when the API request fails.
    } finally {
      navigate('/admin/masuk', { replace: true });
    }
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" to="/" aria-label="JRC XIV — beranda">
          <span aria-hidden="true">XIV</span><strong>JRC</strong>
        </Link>
        <div className="admin-sidebar__identity">
          <p>WORKSPACE ADMIN</p><strong>Kontrol operasi</strong><small>JRC XIV</small>
        </div>
        <nav aria-label="Navigasi admin">
          {role && registrationRoles.has(role) && (
            <NavLink end to="/admin">Pendaftaran</NavLink>
          )}
          {role && financeRoles.has(role) && (
            <NavLink to="/admin/finance">Keuangan</NavLink>
          )}
          {role && scannerRoles.has(role) && (
            <NavLink to="/admin/scanner">Pemindai</NavLink>
          )}
        </nav>
        <button
          className="admin-signout"
          type="button"
          disabled={signingOut}
          aria-busy={signingOut}
          onClick={() => void signOut()}
        >
          {signingOut ? 'Sedang keluar…' : 'Keluar'}
        </button>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <p>JRC XIV · Sistem panitia</p>
          <span><strong>{displayName}</strong><small>{roleLabel}</small></span>
        </header>
        {children}
      </div>
    </div>
  );
}
