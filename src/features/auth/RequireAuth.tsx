import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { AuthRole } from '../registration/api';
import { useAuth } from './AuthProvider';

interface RequireAuthProps {
  roles: readonly AuthRole[];
  redirectTo: string;
  children?: ReactNode;
}

export function RequireAuth({ roles, redirectTo, children }: RequireAuthProps) {
  const { loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <p role="status">Memeriksa sesi…</p>;
  if (!user || !roles.includes(user.role)) {
    return <Navigate replace to={redirectTo} state={{ from: location }} />;
  }

  return children ?? <Outlet />;
}