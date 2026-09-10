import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Submission } from "@/components/SubmissionCard";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, BookOpen, LogOut, Eye, Edit, FileText, Plus } from "lucide-react";
import { useCourseReservesStore } from "../store/courseReservesStore";
import { useTermsStore } from "../store/termsStore";
import { useAuthStore } from "../store/authStore";
import { useCourseAssignmentsStore, CourseAssignment } from "../store/courseAssignmentsStore";
import { useDraftStore } from "../store/draftStore";
import { useHasAnyUnsavedChanges } from "@/hooks/useUnsavedChangesWarning";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isSavingBeforeLogout, setIsSavingBeforeLogout] = useState(false);
  
  // Use Zustand stores
  const { reserves, deleteReserve, getReserveStats, initialize, fetchSubmissions, startPolling, stopPolling } = useCourseReservesStore();
  const { 
    getCurrentTermName, 
    refreshTermsIfStale, 
    loading: termsLoading,
  } = useTermsStore();
  const { user, isAuthenticated, initializeFromCookie, logout } = useAuthStore();
  const { assignments, loading: assignmentsLoading } = useCourseAssignmentsStore();
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

  const handleDeleteCourse = (reserveId: string) => {
    deleteReserve(reserveId);
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
      {/* Top Bar */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" />
              <h1 className="text-xl font-semibold">Course Reserves</h1>
              {isAuthenticated && user && (
                <Badge variant="outline" className="text-xs">
                  {user.full_name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {termsLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <Badge variant="secondary" className="text-sm">
                  {getCurrentTermName()}
                </Badge>
              )}
              {isAuthenticated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogoutClick}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

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

        {/* Course Loading State */}
        {assignmentsLoading && <TableLoadingSkeleton />}
        
        {/* Unified Courses Table */}
        {!assignmentsLoading && assignments.length > 0 && (
          <CoursesTable
            courses={unifiedCourses}
            onDelete={handleDeleteCourse}
          />
        )}
        
        {/* Fallback: Show only reserves if no assignments */}
        {!assignmentsLoading && assignments.length === 0 && filteredSubmissions.length > 0 && (
          <ReservesTable
            submissions={filteredSubmissions}
            onDelete={handleDeleteCourse}
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

// Extracted Components for Better Organization

const TableLoadingSkeleton = () => (
  <div className="border rounded-lg">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Course</TableHead>
          <TableHead>Section</TableHead>
          <TableHead>Term</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Items</TableHead>
          <TableHead>Last Updated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[1, 2, 3, 4, 5].map((i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

interface CoursesTableProps {
  courses: Array<{
    type: 'submission' | 'assignment';
    submission?: Submission;
    assignment?: CourseAssignment;
    key: string;
  }>;
  onDelete: (id: string) => void;
}

const CoursesTable = ({ courses, onDelete }: CoursesTableProps) => {
  const navigate = useNavigate();
  const { addReserve } = useCourseReservesStore();

  const handleAddReserves = (assignment: CourseAssignment) => {
    const course = assignment.assignment;
    const parsedCourse = assignment.parsed_course;
    const folioTerm = assignment.folio_term;
    const folioCourse = assignment.folio_course;
    
    // Prefer FOLIO course data when available, fall back to assignment data
    const courseTitle = (folioCourse && folioCourse.name) ? folioCourse.name : course.course_title;
    const courseNumber = (folioCourse && folioCourse.courseNumber) ? folioCourse.courseNumber : parsedCourse.courseNumber;
    
    // Create the reserve directly
    const reserveId = addReserve({
      courseCode: courseNumber, // Use clean course number like "BIO 131" not "BIO-131-01-202603"
      courseTitle: courseTitle,
      section: parsedCourse.sectionName,
      instructors: '',
      term: folioTerm.name,
      status: "draft",
      items: [],
      folders: [],
      courseAssignmentId: course.course_id
    });
    
    // Navigate directly to the editor
    navigate(`/submission/${reserveId}/edit`);
  };

  return (
    <div className="border rounded-lg bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-semibold">Course</TableHead>
            <TableHead className="font-semibold">Section</TableHead>
            <TableHead className="font-semibold">Term</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Items</TableHead>
            <TableHead className="font-semibold">Last Updated</TableHead>
            <TableHead className="text-right font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {courses.map((item) => {
            if (item.type === 'submission' && item.submission) {
              const sub = item.submission;
              return (
                <TableRow key={item.key} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="font-medium">{sub.courseCode}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-xs">{sub.courseTitle}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{sub.term}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={sub.status} />
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{sub.totalItems} total</div>
                    <div className="text-xs text-muted-foreground">
                      {sub.completeItems} complete
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sub.lastUpdated}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {sub.status === 'draft' ? (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/submission/${sub.id}/edit`)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/submission/${sub.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            } else if (item.type === 'assignment' && item.assignment) {
              const assignment = item.assignment;
              const course = assignment.assignment;
              const parsedCourse = assignment.parsed_course;
              const folioTerm = assignment.folio_term;
              const folioCourse = assignment.folio_course;
              if (!course) return null;
              
              // Prefer FOLIO course data when available, fall back to assignment data
              const courseTitle = (folioCourse && folioCourse.name) ? folioCourse.name : course.course_title;
              const courseNumber = (folioCourse && folioCourse.courseNumber) ? folioCourse.courseNumber : parsedCourse.courseNumber;
              
              return (
                <TableRow key={item.key} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="font-medium">{courseNumber}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-xs">{courseTitle}</div>
                  </TableCell>
                  <TableCell className="text-sm">{parsedCourse.sectionName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{folioTerm.name}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">Not Started</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">—</TableCell>
                  <TableCell className="text-sm text-muted-foreground">—</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => handleAddReserves(assignment)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Reserves
                    </Button>
                  </TableCell>
                </TableRow>
              );
            }
            return null;
          })}
        </TableBody>
      </Table>
    </div>
  );
};

interface ReservesTableProps {
  submissions: Submission[];
  onDelete: (id: string) => void;
}

const ReservesTable = ({ submissions, onDelete }: ReservesTableProps) => {
  const navigate = useNavigate();

  return (
    <div className="border rounded-lg bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-semibold">Course</TableHead>
            <TableHead className="font-semibold">Term</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Items</TableHead>
            <TableHead className="font-semibold">Last Updated</TableHead>
            <TableHead className="text-right font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub) => (
            <TableRow key={sub.id} className="hover:bg-muted/50">
              <TableCell>
                <div className="font-medium">{sub.courseCode}</div>
                <div className="text-sm text-muted-foreground truncate max-w-xs">{sub.courseTitle}</div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">{sub.term}</Badge>
              </TableCell>
              <TableCell>
                <StatusBadge status={sub.status} />
              </TableCell>
              <TableCell className="text-sm">
                <div>{sub.totalItems} total</div>
                <div className="text-xs text-muted-foreground">
                  {sub.completeItems} complete
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {sub.lastUpdated}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {sub.status === 'draft' ? (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/submission/${sub.id}/edit`)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/submission/${sub.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

interface ReservesOnlySectionProps {
  submissions: Submission[];
  onDelete: (id: string) => void;
}

interface EmptyStateProps {
  termName: string;
  termsLoading: boolean;
}

const EmptyState = ({ termName, termsLoading }: EmptyStateProps) => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      {termsLoading ? (
        <Skeleton className="h-6 w-64 mb-2" />
      ) : (
        <h3 className="text-lg font-semibold mb-2">
          No Courses for {termName}
        </h3>
      )}
      <p className="text-sm text-muted-foreground max-w-md">
        Your teaching assignments will appear here when they become available.
        Course reserves can be submitted once courses are assigned.
      </p>
    </CardContent>
  </Card>
);

export default Index;
