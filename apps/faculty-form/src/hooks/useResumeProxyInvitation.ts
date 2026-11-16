import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  appPathForRoute,
  getPostLoginDestination,
  isAuthAppPath,
  PROXY_INVITATION_SESSION_KEY,
  RETURN_DESTINATION_SESSION_KEY,
  routePathFromAppPath,
} from '@/services/session';

const getStoredValue = (key: string) => {
  try { return sessionStorage.getItem(key); } catch { return null; }
};

export const useResumeProxyInvitation = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  const navigate = useNavigate();
  const basename = import.meta.env.VITE_BASE_PATH || '/';

  useEffect(() => {
    if (!isAuthenticated) return;
    const invitation = getStoredValue(PROXY_INVITATION_SESSION_KEY);
    const saved = getStoredValue(RETURN_DESTINATION_SESSION_KEY);
    const current = appPathForRoute(`${location.pathname}${location.search}${location.hash}`, basename);
    if (!isAuthAppPath(current, basename) && !invitation && !saved) return;
    const destination = getPostLoginDestination(invitation, saved, basename);
    try {
      sessionStorage.removeItem(PROXY_INVITATION_SESSION_KEY);
      sessionStorage.removeItem(RETURN_DESTINATION_SESSION_KEY);
    } catch { /* Session storage can be disabled. */ }
    if (destination !== current) navigate(routePathFromAppPath(destination, basename), { replace: true });
  }, [basename, isAuthenticated, location.hash, location.pathname, location.search, navigate]);
};
