import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ShieldCheck } from "lucide-react";
import { MockLoginForm } from "@/components/auth/MockLoginForm";
import { UserInfoDisplay } from "@/components/auth/UserInfoDisplay";
import { isDebugEnabled } from "@/lib/debug";
import { Button } from "@/components/ui/button";

const Auth = () => {
  const { isAuthenticated } = useAuthStore();
  const isDevMode = isDebugEnabled();

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
            {isAuthenticated 
              ? "You are currently logged in" 
              : isDevMode 
                ? "Development Mode - Mock Authentication" 
                : "Sign in to manage your course reserves"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAuthenticated ? (
            <AuthenticatedView />
          ) : isDevMode ? (
            <DevModeView />
          ) : (
            <ProductionView />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// View for authenticated users (should redirect via ProtectedRoute, but just in case)
const AuthenticatedView = () => (
  <div className="space-y-4">
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
      ℹ️ You are already logged in. You can view your courses on the dashboard.
    </div>
    <UserInfoDisplay showActions={true} />
  </div>
);

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
const ProductionView = () => (
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
    <Button size="lg" className="mt-4">
      Sign In with Shibboleth
    </Button>
    <div className="text-xs text-muted-foreground pt-4">
      For assistance, contact your library administrator.
    </div>
  </div>
);

export default Auth;
