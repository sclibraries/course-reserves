import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { PROXY_INVITATION_SESSION_KEY } from '@/pages/AcceptProxyInvitation';

export const useResumeProxyInvitation = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      const token = sessionStorage.getItem(PROXY_INVITATION_SESSION_KEY);
      if (!token) return;
      sessionStorage.removeItem(PROXY_INVITATION_SESSION_KEY);
      if (location.pathname.startsWith('/faculty/accept-proxy-invitation/')) return;
      navigate(`/faculty/accept-proxy-invitation/${encodeURIComponent(token)}`, { replace: true });
    } catch { /* Session storage can be disabled. */ }
  }, [isAuthenticated, location.pathname, navigate]);
};
