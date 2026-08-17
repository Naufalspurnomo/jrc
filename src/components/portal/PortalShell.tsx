import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

interface PortalShellProps {
  children: ReactNode;
  eyebrow?: string;
  onSignOut?: () => void;
}

export function PortalShell({ children, eyebrow = 'PORTA PARTICIPANTIUM', onSignOut }: PortalShellProps) {
  return (
    <div className="portal-shell">
      <header className="portal-header">
        <Link className="portal-brand" to="/" aria-label="JRC XIV — beranda">
          <span aria-hidden="true">XIV</span>
          <strong>JRC</strong>
        </Link>
        <p className="portal-header__eyebrow">{eyebrow}</p>
        <nav className="portal-nav" aria-label="Navigasi portal peserta">
          <NavLink end to="/portal">Ikhtisar</NavLink>
          <NavLink to="/portal/pendaftaran">Pendaftaran</NavLink>
          {onSignOut && <button type="button" onClick={onSignOut}>Keluar</button>}
        </nav>
      </header>
      {children}
      <footer className="portal-footer">
        <span>JRC XIV · IMPERIUM MACHINA</span>
        <span>Prototype lokal · tanpa pembayaran</span>
      </footer>
    </div>
  );
}
