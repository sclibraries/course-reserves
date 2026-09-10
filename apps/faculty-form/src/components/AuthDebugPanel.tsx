import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useCourseReservesStore } from "@/store/courseReservesStore";
import { useTermsStore } from "@/store/termsStore";
import { useCourseAssignmentsStore } from "@/store/courseAssignmentsStore";
import { useDraftStore } from "@/store/draftStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, LogOut, LogIn, Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import { CourseModal, CourseData } from "./CourseModal";
import { LogoutConfirmDialog } from "./LogoutConfirmDialog";
import { useHasAnyUnsavedChanges } from "@/hooks/useUnsavedChangesWarning";

export const AuthDebugPanel = () => {
  const navigate = useNavigate();
  
  const { 
    user, 
    isAuthenticated, 
    loading: authLoading, 
    setMockUser, 
    logout,
    checkTokenExpiration
  } = useAuthStore();

  const { addReserve } = useCourseReservesStore();
  const { getNextTermName } = useTermsStore();
  const { fetchCourseAssignments } = useCourseAssignmentsStore();

  const [customName, setCustomName] = useState("");
  const [internalId, setInternalId] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [selectedCourseData, setSelectedCourseData] = useState<CourseData | undefined>(undefined);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isSavingBeforeLogout, setIsSavingBeforeLogout] = useState(false);

  const hasAnyUnsavedChanges = useHasAnyUnsavedChanges();
  const draftStore = useDraftStore();

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

  const handleLogin = async () => {
    if (customName.trim() && internalId.trim()) {
      setLoginError(null);
      setLoginSuccess(null);
      
      try {
        await setMockUser(customName.trim(), internalId.trim());
        setLoginSuccess(`Successfully logged in as ${customName.trim()}!`);
        
        // Auto-fetch course assignments after successful login
        try {
          await fetchCourseAssignments(customName.trim(), internalId.trim());
          console.log('✅ Course assignments auto-fetched after login');
        } catch (assignmentError) {
          console.warn('⚠️ Could not fetch course assignments:', assignmentError);
          // Don't fail login if course assignments fail
        }
        
        setCustomName(""); // Clear input on success
        setInternalId(""); // Clear input on success
        
        // Clear success message after 3 seconds
        setTimeout(() => setLoginSuccess(null), 3000);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Login failed';
        setLoginError(errorMessage);
      }
    } else {
      setLoginError('Please enter both full name and internal ID');
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

  const handleSaveCourse = (courseData: CourseData) => {
    const reserveId = addReserve({
      courseCode: courseData.courseCode,
      courseTitle: courseData.courseTitle,
      section: courseData.section,
      instructors: courseData.instructors,
      term: courseData.term,
      status: "draft",
      items: [],
      folders: []
    });
    
    toast.success(`Created course: ${courseData.courseCode}`);
    setCourseModalOpen(false);
    
    // Navigate to the editor
    navigate(`/submission/${reserveId}/edit`);
  };

  return (
    <div className="space-y-4">
      {/* Authentication Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Authentication Debug
            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  checkTokenExpiration();
                }}
              >
                Check Token
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAuthenticated && user ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Name:</strong> {user.full_name}</div>
                <div><strong>Role:</strong> <Badge variant="secondary">{user.role}</Badge></div>
                <div><strong>Institution:</strong> {user.institution}</div>
              </div>
              
              <div className="space-y-3">
                {!internalId && (
                  <div className="p-3 border border-amber-200 bg-amber-50 rounded-md text-amber-700 text-sm">
                    ⚠️ <strong>Internal ID Not Set:</strong> To view course assignments, please logout and login again with your Internal ID.
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                  
                  <Button
                    variant="default"
                    onClick={handleQuickCreateCourse}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Zap className="h-4 w-4" />
                    Quick Create Test Course
                  </Button>
                  
                  <Button variant="destructive" onClick={handleLogoutClick} size="sm">
                    <LogOut className="h-4 w-4 mr-1" />
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="custom-name">Full name</Label>
                  <Input
                    id="custom-name"
                    placeholder="Enter full name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customName.trim() && !authLoading) {
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
                      if (e.key === 'Enter' && customName.trim() && !authLoading) {
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
                className="flex items-center gap-2"
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
              
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded-md">
                💡 <strong>Mock Login:</strong> This calls the backend mock-login endpoint to generate a real JWT token for testing. Token will be valid for 1 hour.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <CourseModal
        open={courseModalOpen}
        onOpenChange={setCourseModalOpen}
        onSave={handleSaveCourse}
        initialData={selectedCourseData}
      />
      
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirmLogout={handleConfirmLogout}
        onSaveAndLogout={handleSaveAndLogout}
        hasUnsavedChanges={hasAnyUnsavedChanges}
        isSaving={isSavingBeforeLogout}
      />
    </div>
  );
};
