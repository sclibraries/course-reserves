import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useCourseAssignmentsStore } from "@/store/courseAssignmentsStore";
import { getSafeErrorFeedback, notify } from "@/services/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn } from "lucide-react";
import { DevTestAccounts } from "./DevTestAccounts";

export const MockLoginForm = () => {
  const { loading: authLoading, setMockUser } = useAuthStore();
  const { fetchCourseAssignments } = useCourseAssignmentsStore();
  const [customName, setCustomName] = useState("");
  const [internalId, setInternalId] = useState("");

  const handleLogin = async (name = customName, id = internalId) => {
    if (!name.trim() || !id.trim()) return;
    try {
      await setMockUser(name.trim(), id.trim());
      notify.success('Signed in');
      setCustomName("");
      setInternalId("");
      try {
        await fetchCourseAssignments();
      } catch (error) {
        const feedback = getSafeErrorFeedback(error, "Couldn't load course assignments");
        notify.error(feedback.message, { reference: feedback.reference });
      }
    } catch (error) {
      const feedback = getSafeErrorFeedback(error, "Couldn't sign in");
      notify.error(feedback.message, { reference: feedback.reference });
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
            onChange={(event) => setCustomName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && customName.trim() && internalId.trim() && !authLoading) handleLogin();
            }}
          />
        </div>
        <div>
          <Label htmlFor="internal-id">Internal ID</Label>
          <Input
            id="internal-id"
            placeholder="Enter internal ID"
            value={internalId}
            onChange={(event) => setInternalId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && customName.trim() && internalId.trim() && !authLoading) handleLogin();
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">Smith ID for course lookup</p>
        </div>
      </div>

      <Button
        onClick={() => handleLogin()}
        disabled={!customName.trim() || !internalId.trim() || authLoading}
        className="w-full flex items-center justify-center gap-2"
      >
        {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        {authLoading ? 'Logging in...' : 'Login as Mock User'}
      </Button>

      <DevTestAccounts disabled={authLoading} onSelect={(account) => handleLogin(account.fullName, account.internalId)} />

      <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded-md">
        💡 <strong>Mock Login:</strong> This uses the development or test API to issue a synthetic access token.
      </div>
    </div>
  );
};
