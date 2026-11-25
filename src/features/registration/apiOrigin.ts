const API_PATH_PREFIX = '/api';
const ERROR_MESSAGE = 'VITE_API_ORIGIN must be an exact HTTPS origin';

export function normalizeApiOrigin(value: string | undefined): string {
  const candidate = value?.trim() ?? '';
  if (!candidate) return '';

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(ERROR_MESSAGE);
  }

  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
    || url.origin !== candidate.replace(/\/$/, '')
  ) {
    throw new Error(ERROR_MESSAGE);
  }

  return url.origin;
}

export function resolveApiOrigin(
  configuredOrigin: string | undefined,
  frontendOrigin: string | undefined,
): string {
  void frontendOrigin;
  const normalizedConfiguredOrigin = normalizeApiOrigin(configuredOrigin);
  if (normalizedConfiguredOrigin) return normalizedConfiguredOrigin;
  // Production routes /api through the current frontend host. Same-origin
  // sessions remain reliable even when browsers block third-party cookies.
  return '';
}

const BROWSER_ORIGIN = typeof window === 'undefined' ? undefined : window.location.origin;

export const API_ORIGIN = resolveApiOrigin(import.meta.env.VITE_API_ORIGIN, BROWSER_ORIGIN);

export function apiUrl(path: string, origin: string | undefined = API_ORIGIN): string {
  if (!path.startsWith(`${API_PATH_PREFIX}/`) && path !== API_PATH_PREFIX) return path;
  return `${normalizeApiOrigin(origin)}${path}`;
}
