import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { appPathForRoute, RETURN_DESTINATION_SESSION_KEY } from "@/services/session";

interface ProtectedRouteProps {
  children: ReactNode;
  /** If true, only allow unauthenticated users (redirect authenticated to /) */
  authOnly?: boolean;
}

/**
 * Route guard component that enforces authentication requirements.
 * - By default, requires authentication (redirects to /auth if not logged in)
 * - If authOnly=true, redirects authenticated users to / (for login page)
 */
export const ProtectedRoute = ({ children, authOnly = false }: ProtectedRouteProps) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  const basename = import.meta.env.VITE_BASE_PATH || '/';
  const [destinationSaved, setDestinationSaved] = useState(authOnly || isAuthenticated);

  // Save before redirecting so a full-page sign-in round trip returns here.
  useEffect(() => {
    if (authOnly || isAuthenticated) return;
    const destination = appPathForRoute(`${location.pathname}${location.search}${location.hash}`, basename);
    try { sessionStorage.setItem(RETURN_DESTINATION_SESSION_KEY, destination); } catch { /* Session storage can be disabled. */ }
    setDestinationSaved(true);
  }, [authOnly, basename, isAuthenticated, location.hash, location.pathname, location.search]);

  // Protected route: redirect unauthenticated users to /auth
  if (!authOnly && !isAuthenticated) {
    return destinationSaved ? <Navigate to="/auth" replace /> : null;
  }

  return <>{children}</>;
};
