import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useCourseReservesStore } from "@/store/courseReservesStore";
import { useTermsStore } from "@/store/termsStore";
import { useDraftStore } from "@/store/draftStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Zap } from "lucide-react";
import { toast } from "sonner";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import { useHasAnyUnsavedChanges } from "@/hooks/useUnsavedChangesWarning";

interface UserInfoDisplayProps {
  /** Show quick action buttons (e.g., create test course, logout) */
  showActions?: boolean;
}

export const UserInfoDisplay = ({ showActions = true }: UserInfoDisplayProps) => {
  const navigate = useNavigate();
  const { user, logout, checkTokenExpiration } = useAuthStore();
  const { addReserve } = useCourseReservesStore();
  const { getNextTermName } = useTermsStore();
  const draftStore = useDraftStore();

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isSavingBeforeLogout, setIsSavingBeforeLogout] = useState(false);

  const hasAnyUnsavedChanges = useHasAnyUnsavedChanges();

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleConfirmLogout = () => {
    setLogoutDialogOpen(false);
    logout();
  };

  const handleSaveAndLogout = async () => {
    setIsSavingBeforeLogout(true);
    try {
      // Get all reserves with unsaved changes
      const reservesWithChanges = Object.keys(draftStore.hasUnsavedChanges)
        .filter(id => draftStore.hasUnsavedChanges[id]);

      // Save each draft (in real implementation, this would call the backend)
      for (const reserveId of reservesWithChanges) {
        const draft = draftStore.getDraft(reserveId);
        if (draft) {
          console.log('Saving draft before logout:', reserveId);
          // TODO: Call actual save API here
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      toast.success('All changes saved successfully');
      setLogoutDialogOpen(false);
      logout();
    } catch (error) {
      console.error('Failed to save drafts:', error);
      toast.error('Failed to save some changes');
    } finally {
      setIsSavingBeforeLogout(false);
    }
  };

  const handleQuickCreateCourse = () => {
    if (!user?.full_name) {
      toast.error("Please login first");
      return;
    }

    const nextTerm = getNextTermName();
    const timestamp = Date.now();
    
    // Create a test course with sample data
    const reserveId = addReserve({
      courseCode: `TEST-${timestamp % 1000}`,
      courseTitle: `Test Course ${new Date().toLocaleTimeString()}`,
      section: "01",
      instructors: user.full_name,
      term: nextTerm,
      status: "draft",
      items: [],
      folders: []
    });
    
    toast.success(`Created test course: TEST-${timestamp % 1000}`);
    
    // Navigate to the editor
    navigate(`/submission/${reserveId}/edit`);
  };

  if (!user) return null;

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><strong>Name:</strong> {user.full_name}</div>
          <div><strong>Role:</strong> <Badge variant="secondary">{user.role}</Badge></div>
          <div><strong>Institution:</strong> {user.institution}</div>
        </div>
        
        {showActions && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkTokenExpiration()}
            >
              Check Token
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={handleQuickCreateCourse}
              className="bg-green-600 hover:bg-green-700"
            >
              <Zap className="h-4 w-4 mr-1" />
              Quick Create Test Course
            </Button>
            
            <Button variant="destructive" onClick={handleLogoutClick} size="sm">
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        )}
      </div>
      
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirmLogout={handleConfirmLogout}
        onSaveAndLogout={handleSaveAndLogout}
        hasUnsavedChanges={hasAnyUnsavedChanges}
        isSaving={isSavingBeforeLogout}
      />
    </>
  );
};
