import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ShieldCheck } from "lucide-react";
import { MockLoginForm } from "@/components/auth/MockLoginForm";
import { isDebugEnabled } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { API_ENDPOINTS } from "@/config/endpoints";
import { notify } from "@/services/notify";
import {
  AUTH_NOTICE_SESSION_KEY,
  buildFacultyAuthorizeUrl,
  getPostLoginDestination,
  PROXY_INVITATION_SESSION_KEY,
  RETURN_DESTINATION_SESSION_KEY,
} from "@/services/session";

const Auth = () => {
  const isDevMode = isDebugEnabled();

  useEffect(() => {
    let reason: string | null;
    try {
      reason = sessionStorage.getItem(AUTH_NOTICE_SESSION_KEY);
      if (reason !== null) sessionStorage.removeItem(AUTH_NOTICE_SESSION_KEY);
    } catch { return; }
    if (reason === 'manual') notify.success('Signed out of Course Reserves. Close the browser to end your campus sign-in.');
    if (reason === 'expired') notify.error('Your session has ended. Sign in again to continue.');
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Course Reserves</CardTitle>
          <CardDescription>
            {isDevMode ? "Development Mode - Mock Authentication" : "Sign in to manage your course reserves"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDevMode ? (
            <DevModeView />
          ) : (
            <ProductionView />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Development mode - mock login
const DevModeView = () => (
  <div className="space-y-4">
    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm">
      ⚠️ <strong>Development Mode:</strong> Using mock authentication for testing. This will not be available in production.
    </div>
    <MockLoginForm />
  </div>
);

// Production mode - real SSO/authentication
const ProductionView = () => {
  const basename = import.meta.env.VITE_BASE_PATH || '/';
  let invitationToken: string | null = null;
  let savedDestination: string | null = null;
  try {
    invitationToken = sessionStorage.getItem(PROXY_INVITATION_SESSION_KEY);
    savedDestination = sessionStorage.getItem(RETURN_DESTINATION_SESSION_KEY);
  } catch { /* Session storage can be disabled. */ }
  const destination = getPostLoginDestination(invitationToken, savedDestination, basename);
  const authorizeUrl = buildFacultyAuthorizeUrl(
    `${API_ENDPOINTS.AUTH.BASE_URL}${API_ENDPOINTS.AUTH.FACULTY_AUTHORIZE}`,
    window.location.origin,
    basename,
    destination,
  );

  return (
    <div className="space-y-6 text-center py-4">
      <div className="flex justify-center">
        <ShieldCheck className="h-16 w-16 text-primary/60" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Authentication Required</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Please sign in with your institutional credentials to access the Course Reserves system.
        </p>
      </div>
      <Button asChild size="lg" className="mt-4">
        <a href={authorizeUrl}>Sign In with Shibboleth</a>
      </Button>
      <div className="text-xs text-muted-foreground pt-4">
        For assistance, contact your library administrator.
      </div>
    </div>
  );
};

export default Auth;
