import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

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
  const { isAuthenticated, initializeFromCookie } = useAuthStore();
  const location = useLocation();

  // Initialize auth from persisted state on mount
  useEffect(() => {
    initializeFromCookie();
  }, [initializeFromCookie]);

  // Auth-only route (e.g., /auth): redirect authenticated users to home
  if (authOnly && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Protected route: redirect unauthenticated users to /auth
  if (!authOnly && !isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
