export interface SessionUser {
  iat: number;
  exp: number;
  username: string;
  role: string;
  id: string;
  full_name: string;
  email: string;
  institution: string;
  internal_id?: string;
}

export const RETURN_DESTINATION_SESSION_KEY = 'faculty-form-return-destination';
export const PROXY_INVITATION_SESSION_KEY = 'faculty-proxy-invitation-token';
export const AUTH_NOTICE_SESSION_KEY = 'faculty-form-auth-notice';
export const FACULTY_ACCESS_TOKEN_COOKIE = 'facultyAccessToken';
export type AuthNoticeReason = 'manual' | 'expired';

export const buildFacultyAccessCookieDeletion = (hostname: string, protocol: string): string => {
  const domainAttribute = hostname === 'libtools2.smith.edu' ? '; Domain=libtools2.smith.edu' : '';
  const secureAttribute = protocol === 'https:' ? '; Secure' : '';
  return `${FACULTY_ACCESS_TOKEN_COOKIE}=; Path=/${domainAttribute}${secureAttribute}; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Strict`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readCookieValue = (cookie: string, name: string): string | null => {
  const value = cookie.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (value === undefined) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

const decodeSessionToken = (token: string, now: number): SessionUser | null => {
  try {
    const [header, payloadPart, signature, ...extra] = token.split('.');
    if (!header || !payloadPart || !signature || extra.length || payloadPart.length % 4 === 1) return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (char) => char.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(claims) || typeof claims.username !== 'string' || !claims.username ||
        typeof claims.role !== 'string' || !claims.role || typeof claims.exp !== 'number' ||
        !Number.isFinite(claims.exp) || claims.exp <= now) return null;

    return {
      iat: typeof claims.iat === 'number' ? claims.iat : 0,
      exp: claims.exp,
      username: claims.username,
      role: claims.role,
      id: typeof claims.id === 'string' ? claims.id : claims.username,
      full_name: typeof claims.full_name === 'string' ? claims.full_name : '',
      email: typeof claims.email === 'string' ? claims.email : '',
      institution: typeof claims.institution === 'string' ? claims.institution : '',
      ...(typeof claims.internal_id === 'string' ? { internal_id: claims.internal_id } : {}),
    };
  } catch {
    return null;
  }
};

// These claims identify the UI session; the API still verifies each request.
export const readSessionFromCookie = (cookie: string, now: number): SessionUser | null => {
  const token = readCookieValue(cookie, FACULTY_ACCESS_TOKEN_COOKIE);
  return token ? decodeSessionToken(token, now) : null;
};

export const readSessionUsername = (cookie: string, now: number): string | null =>
  readSessionFromCookie(cookie, now)?.username ?? null;

const basenamePath = (basename: string): string => {
  const path = `/${basename.split('/').filter(Boolean).join('/')}`;
  return path === '/' ? '/' : path;
};

const pathnameOf = (path: string): string => path.split(/[?#]/, 1)[0] || '/';

export const isPathInBasename = (path: string, basename: string): boolean => {
  const pathname = pathnameOf(path);
  const base = basenamePath(basename);
  return base === '/' || pathname === base || pathname.startsWith(`${base}/`);
};

export const appPathForRoute = (route: string, basename: string): string => {
  const base = basenamePath(basename);
  const routePath = `/${route.split(/[?#]/, 1)[0].split('/').filter(Boolean).join('/')}`;
  const suffix = route.slice(routePath.length);
  return `${base === '/' ? '' : base}${routePath === '/' ? '/' : routePath}${suffix}` || '/';
};

export const routePathFromAppPath = (path: string, basename: string): string => {
  if (!isPathInBasename(path, basename)) return '/';
  const pathname = pathnameOf(path);
  const base = basenamePath(basename);
  const route = base === '/' ? pathname : pathname.slice(base.length) || '/';
  return `${route}${path.slice(pathname.length)}`;
};

export const buildReturnUrl = (origin: string, basename: string, destination: string | null): string => {
  const target = destination && isPathInBasename(destination, basename)
    ? destination
    : appPathForRoute('/', basename);
  return `${origin}${target}`;
};

export const buildFacultyAuthorizeUrl = (
  authorizeEndpoint: string,
  origin: string,
  basename: string,
  destination: string | null,
): string => `${authorizeEndpoint}?redirect=${encodeURIComponent(buildReturnUrl(origin, basename, destination))}`;

export const getPostLoginDestination = (
  invitationToken: string | null,
  savedDestination: string | null,
  basename: string,
): string => {
  if (invitationToken) return appPathForRoute(`/faculty/accept-proxy-invitation/${encodeURIComponent(invitationToken)}`, basename);
  return savedDestination && isPathInBasename(savedDestination, basename)
    ? savedDestination
    : appPathForRoute('/', basename);
};

export const isAuthAppPath = (path: string, basename: string): boolean =>
  pathnameOf(routePathFromAppPath(path, basename)) === '/auth';

export const mergeUserScopedState = <T extends object>(
  persisted: (Partial<T> & { ownerUsername?: string | null }) | undefined,
  current: T,
  username: string | null,
): T | null => {
  if (!username || persisted?.ownerUsername !== username) return null;
  return { ...current, ...persisted } as T;
};

export const stampUserScopedState = <T extends object>(
  state: T,
  username: string | null,
): T & { ownerUsername?: string } => username ? { ...state, ownerUsername: username } : state;
