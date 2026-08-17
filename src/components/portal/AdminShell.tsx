import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

interface AdminShellProps {
  children: ReactNode;
  onSignOut?: () => void;
}

export function AdminShell({ children, onSignOut }: AdminShellProps) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" to="/" aria-label="JRC XIV — beranda">
          <span aria-hidden="true">XIV</span><strong>JRC</strong>
        </Link>
        <div className="admin-sidebar__identity">
          <p>OFFICIUM</p><strong>Command Desk</strong><small>Data lokal</small>
        </div>
        <nav aria-label="Navigasi admin">
          <NavLink end to="/admin"><span>01</span> Pendaftaran</NavLink>
          <a aria-disabled="true" href="#agenda"><span>02</span> Agenda</a>
          <a aria-disabled="true" href="#arsip"><span>03</span> Arsip</a>
        </nav>
        {onSignOut && <button className="admin-signout" type="button" onClick={onSignOut}>Keluar dari meja</button>}
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <p><span aria-hidden="true" /> JRC XIV · OPERASI LOKAL</p>
          <span>Panitia JRC</span>
        </header>
        {children}
      </div>
    </div>
  );
}
