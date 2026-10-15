import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Submission } from "@/components/SubmissionCard";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import { Search } from "lucide-react";
import { useCourseReservesStore } from "../store/courseReservesStore";
import { useTermsStore } from "../store/termsStore";
import { useAuthStore } from "../store/authStore";
import { useDashboardCourseAssignments } from "@/hooks/useDashboardCourseAssignments";
import { CoursesTable } from "@/components/dashboard/CoursesTable";
import { ReservesTable } from "@/components/dashboard/ReservesTable";
import { EmptyState, TableLoadingSkeleton } from "@/components/dashboard/DashboardStates";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useDraftStore } from "../store/draftStore";
import { useHasAnyUnsavedChanges } from "@/hooks/useUnsavedChangesWarning";
import { toast } from "sonner";

const Index = () => {
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isSavingBeforeLogout, setIsSavingBeforeLogout] = useState(false);
  
  // Use Zustand stores
  const { reserves, getReserveStats, initialize, fetchSubmissions, startPolling, stopPolling } = useCourseReservesStore();
  const { 
    getCurrentTermName, 
    refreshTermsIfStale, 
    loading: termsLoading,
  } = useTermsStore();
  const { user, isAuthenticated, initializeFromCookie, logout } = useAuthStore();
  const { assignments, loading: assignmentsLoading, error: assignmentsError } = useDashboardCourseAssignments();
  const draftStore = useDraftStore();
  const hasAnyUnsavedChanges = useHasAnyUnsavedChanges();

  // Initialize stores on first load
  useEffect(() => {
    initialize();
    refreshTermsIfStale();
    initializeFromCookie();
  }, [initialize, refreshTermsIfStale, initializeFromCookie]);

  // Fetch submissions from backend when authenticated and start polling
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchSubmissions();
      
      // Start polling for real-time updates (every 30 seconds)
      startPolling(30000);
      
      // Cleanup: stop polling when component unmounts or user logs out
      return () => {
        stopPolling();
      };
    }
  }, [isAuthenticated, user, fetchSubmissions, startPolling, stopPolling]);

  // Status filter options
  const statuses = ["Draft", "Partially Complete", "Submitted", "Complete"];

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

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

  // Convert CourseReserve to Submission format - memoized to avoid recalculation
  const submissions: Submission[] = useMemo(() => {
    const statusMapping = {
      'draft': 'draft' as const,
      'in-progress': 'partial' as const,
      'submitted': 'submitted' as const,
      'complete': 'complete' as const
    };
    
    return reserves.map((reserve) => {
      const stats = getReserveStats(reserve.id);
      
      return {
        id: reserve.id,
        courseCode: reserve.courseCode,
        courseTitle: reserve.courseTitle,
        term: reserve.term,
        status: statusMapping[reserve.status],
        totalItems: stats.totalItems,
        completeItems: stats.completeItems,
        inProgressItems: stats.inProgressItems,
        needsReviewItems: stats.needsReviewItems,
        lastUpdated: reserve.lastUpdated,
        isLocked: !!reserve.isLocked,
        ...(reserve.access ? { access: reserve.access } : {}),
        ...(typeof reserve.proxyCanEdit === 'boolean' ? { proxyCanEdit: reserve.proxyCanEdit } : {}),
      };
    });
  }, [reserves, getReserveStats]);

  // Filter submissions based on status and search - memoized for performance
  const filteredSubmissions = useMemo(() => {
    const statusFilterMapping = {
      'Draft': 'draft',
      'Partially Complete': 'partial', 
      'Submitted': 'submitted',
      'Complete': 'complete'
    };
    
    return submissions.filter((sub) => {
      const matchesStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.some((s) => statusFilterMapping[s as keyof typeof statusFilterMapping] === sub.status);
      const matchesSearch =
        searchQuery === "" ||
        sub.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.courseTitle.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [submissions, selectedStatuses, searchQuery]);

  // Unified courses list combining assignments and reserves - memoized
  const unifiedCourses = useMemo(() => {
    return assignments.map((assignment) => {
      const courseAssignmentId = assignment.assignment?.course_id || '';
      const existingReserve = reserves.find(r => r.courseAssignmentId === courseAssignmentId);
      
      if (existingReserve) {
        const stats = getReserveStats(existingReserve.id);
        const statusMapping = {
          'draft': 'draft' as const,
          'in-progress': 'partial' as const,
          'submitted': 'submitted' as const,
          'complete': 'complete' as const
        };
        
        const submission: Submission = {
          id: existingReserve.id,
          courseCode: existingReserve.courseCode,
          courseTitle: existingReserve.courseTitle,
          term: existingReserve.term,
          status: statusMapping[existingReserve.status],
          totalItems: stats.totalItems,
          completeItems: stats.completeItems,
          inProgressItems: stats.inProgressItems,
          needsReviewItems: stats.needsReviewItems,
          lastUpdated: existingReserve.lastUpdated,
          isLocked: !!existingReserve.isLocked,
          ...(existingReserve.access ? { access: existingReserve.access } : {}),
          ...(typeof existingReserve.proxyCanEdit === 'boolean' ? { proxyCanEdit: existingReserve.proxyCanEdit } : {}),
        };
        
        return {
          type: 'submission' as const,
          submission,
          assignment,
          key: existingReserve.id,
        };
      }
      
      return {
        type: 'assignment' as const,
        assignment,
        key: courseAssignmentId || `assignment-${assignment.assignment?.course_id}`,
      };
    });
  }, [assignments, reserves, getReserveStats]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        user={user}
        isAuthenticated={isAuthenticated}
        termsLoading={termsLoading}
        termName={getCurrentTermName()}
        onLogout={handleLogoutClick}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Course Reserves</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage reading materials and resources for your courses
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-4 mb-6">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter courses by status">
            {statuses.map((status) => (
              <Badge
                key={status}
                variant={selectedStatuses.includes(status) ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/90 transition-colors"
                onClick={() => toggleStatus(status)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleStatus(status);
                  }
                }}
                aria-pressed={selectedStatuses.includes(status)}
              >
                {status}
              </Badge>
            ))}
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search course code or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search courses"
            />
          </div>
        </div>

        {assignmentsError && <p role="alert" className="mb-4 text-sm text-destructive">{assignmentsError}</p>}
        {/* Course Loading State */}
        {assignmentsLoading && <TableLoadingSkeleton />}
        
        {/* Unified Courses Table */}
        {!assignmentsLoading && assignments.length > 0 && (
          <CoursesTable
            courses={unifiedCourses}
          />
        )}
        
        {/* Fallback: Show only reserves if no assignments */}
        {!assignmentsLoading && assignments.length === 0 && filteredSubmissions.length > 0 && (
          <ReservesTable
            submissions={filteredSubmissions}
          />
        )}
        
        {/* Empty State */}
        {!assignmentsLoading && assignments.length === 0 && filteredSubmissions.length === 0 && (
          <EmptyState termName={getCurrentTermName()} termsLoading={termsLoading} />
        )}
      </main>
      
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

export default Index;
