import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useCourseAssignmentsStore } from "@/store/courseAssignmentsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn } from "lucide-react";

interface MockLoginFormProps {
  /** Called after successful login */
  onLoginSuccess?: () => void;
}

export const MockLoginForm = ({ onLoginSuccess }: MockLoginFormProps) => {
  const navigate = useNavigate();
  const { loading: authLoading, setMockUser } = useAuthStore();
  const { fetchCourseAssignments } = useCourseAssignmentsStore();

  const [customName, setCustomName] = useState("");
  const [internalId, setInternalId] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);

  const handleLogin = async () => {
    if (customName.trim() && internalId.trim()) {
      setLoginError(null);
      setLoginSuccess(null);
      
      try {
        await setMockUser(customName.trim(), internalId.trim());
        setLoginSuccess(`Successfully logged in as ${customName.trim()}!`);
        
        // Auto-fetch course assignments after successful login
        try {
          await fetchCourseAssignments();
          console.log('✅ Course assignments auto-fetched after login');
        } catch (assignmentError) {
          console.warn('⚠️ Could not fetch course assignments:', assignmentError);
          // Don't fail login if course assignments fail
        }
        
        setCustomName(""); // Clear input on success
        setInternalId(""); // Clear input on success
        
        // Clear success message after 3 seconds
        setTimeout(() => setLoginSuccess(null), 3000);
        
        // Callback and redirect
        onLoginSuccess?.();
        navigate("/");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Login failed';
        setLoginError(errorMessage);
      }
    } else {
      setLoginError('Please enter both full name and internal ID');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="custom-name">Full name</Label>
          <Input
            id="custom-name"
            placeholder="Enter full name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customName.trim() && internalId.trim() && !authLoading) {
                handleLogin();
              }
            }}
          />
        </div>
        <div>
          <Label htmlFor="internal-id">Internal ID</Label>
          <Input
            id="internal-id"
            placeholder="Enter internal ID"
            value={internalId}
            onChange={(e) => setInternalId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customName.trim() && internalId.trim() && !authLoading) {
                handleLogin();
              }
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Smith ID for course lookup
          </p>
        </div>
      </div>
      
      <Button
        onClick={handleLogin}
        disabled={!customName.trim() || !internalId.trim() || authLoading}
        className="w-full flex items-center justify-center gap-2"
      >
        {authLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        {authLoading ? 'Logging in...' : 'Login as Mock User'}
      </Button>
      
      {loginError && (
        <div className="p-3 border border-red-200 bg-red-50 rounded-md text-red-700 text-sm">
          <strong>Error:</strong> {loginError}
        </div>
      )}
      
      {loginSuccess && (
        <div className="p-3 border border-green-200 bg-green-50 rounded-md text-green-700 text-sm">
          ✅ {loginSuccess}
        </div>
      )}
      
      <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded-md">
        💡 <strong>Mock Login:</strong> This calls the backend mock-login endpoint to generate a real JWT token for testing. Token will be valid for 1 hour.
      </div>
    </div>
  );
};
